import type { EffectDefinition } from '@yugi/shared';
import { EngineError, type EngineErrorCode } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type {
  CardInstance,
  ChainLink,
  ChainLinkSource,
  GameState,
  PendingPrompt,
  PlayerState,
} from '../../state/types.js';
import { activationCandidates } from '../../effects/activation-candidates.js';
import { pushLink, settle } from '../../effects/chain.js';
import { conditionsHold } from '../../effects/conditions.js';
import { payCosts, planCosts, type CostStep } from '../../effects/costs.js';
import { scriptFor } from '../../effects/effect-scripts/registry.js';
import { lacksSummonZones } from '../../effects/operations/special-summon.js';
import { spellSpeedOf } from '../../effects/spell-speed.js';
import { targetCandidates } from '../../effects/targets.js';
import { clearFieldZone } from '../../state/field-zone.js';
import type { ActionContext, ActivateEffectAction, ResolvePendingPromptAction } from '../types.js';

/*
 * Activating a Spell from the hand (task 3.2, chained in task 3.3) or a Set Trap / Quick-Play from the Spell/Trap Zone
 * (task 3.4; the card flips face-up and stays there until its link resolves). Validation (`prepare`) and the target
 * prompt are side-effect free. `activate` pays the cost, fixes the targets and pushes a chain link; the operations only run when
 * the chain resolves (`effects/chain.ts`). With nobody able to respond, the chain resolves in the same call.
 */

type Result = { state: GameState; events: GameEvent[] };

/** Where `ActivateEffect` finds a card: the hand, a Spell/Trap Zone or the Field Zone (trigger sources: task 3.5). */
type ActivationSource = Extract<
  ChainLinkSource,
  { zone: 'Hand' } | { zone: 'SpellTrapZone' } | { zone: 'FieldZone' }
>;

/** `PendingPrompt.payload` of kind `SelectEffectTarget`. */
export interface SelectEffectTargetPayload {
  readonly cardInstanceId: string;
  readonly effectId: string;
  readonly costInstanceIds: readonly string[];
  /** Instance ids the player may choose from (zone order). */
  readonly candidateInstanceIds: readonly string[];
  /** Exactly this many ids must be chosen. */
  readonly count: number;
}

interface Request {
  readonly playerIndex: 0 | 1;
  readonly cardInstanceId: string;
  readonly effectId: string;
  readonly costInstanceIds: readonly string[];
}

interface Prepared {
  readonly request: Request;
  readonly card: CardInstance;
  readonly source: ActivationSource;
  readonly effect: EffectDefinition;
  readonly spellSpeed: 1 | 2 | 3;
  readonly costPlan: readonly CostStep[];
  /** Candidate ids for the effect's `Card` target; null when the effect has no Card target. */
  readonly candidates: readonly string[] | null;
  readonly targetCount: number;
  /**
   * Where a Spell activated from the HAND is placed face-up at once because it stays on the field: an Equip (task 4.2c)
   * or Continuous Spell in a Spell/Trap Zone, a Field Spell in the Field Zone (task 4.3). null otherwise.
   */
  readonly placement: Placement | null;
}

type Placement = Extract<ChainLinkSource, { zone: 'SpellTrapZone' } | { zone: 'FieldZone' }>;

const fail = (code: EngineErrorCode, reason: string): never => {
  throw new EngineError(code, `ActivateEffect rejected: ${reason}`);
};

/** All validation, no state change. `state.pendingPrompt` must already be null. */
function prepare(state: GameState, request: Request, ctx: ActionContext): Prepared {
  const { playerIndex, cardInstanceId, effectId, costInstanceIds } = request;

  if (state.winnerIndex !== null) fail('DUEL_ENDED', 'the duel has already ended.');
  if (state.pendingPrompt !== null) fail('PENDING_PROMPT', 'a prompt is pending.');
  if (state.chainWindow !== null && state.chainWindow.priorityPlayer !== playerIndex)
    fail('NOT_PRIORITY_HOLDER', 'the other player holds priority in the chain window.');
  // [RULE] outside a chain window only the turn player acts; inside one, the priority holder (checked above).
  if (state.chainWindow === null && playerIndex !== state.turnPlayerIndex)
    fail('NOT_TURN_PLAYER', 'only the turn player may act.');

  const found = locate(state.players[playerIndex], cardInstanceId);
  if (!found) {
    // Task 3.6: a monster on the field is never activated; say why when the asked effect is Continuous.
    const monster = state.players[playerIndex].board.monsterZones.find(
      (c) => c?.instanceId === cardInstanceId,
    );
    const asked = monster
      ? ctx.cardDefinitions(monster.definitionId)?.effects?.find((e) => e.id === effectId)
      : undefined;
    if (asked?.trigger.kind === 'Continuous')
      fail(
        'CONTINUOUS_NOT_ACTIVATABLE',
        `effect "${effectId}" is Continuous: it applies by itself while the card is face-up.`,
      );
  }
  if (!found)
    return fail(
      'CARD_NOT_IN_HAND',
      `card ${cardInstanceId} is neither in your hand nor Set in your Spell/Trap Zone.`,
    );
  const { card, source } = found;

  const definition = ctx.cardDefinitions(card.definitionId);
  if (!definition)
    return fail(
      'CARD_DEFINITION_NOT_FOUND',
      `card definition "${card.definitionId}" was not found.`,
    );
  // Task 3.6 [RULE]: a Continuous effect is never activated; it holds while its card is face-up on the field.
  if (definition.effects?.find((e) => e.id === effectId)?.trigger.kind === 'Continuous')
    fail(
      'CONTINUOUS_NOT_ACTIVATABLE',
      `effect "${effectId}" of "${definition.name.en}" is Continuous: it applies by itself while the card is face-up.`,
    );
  if (definition.kind === 'Monster')
    return fail('NOT_A_SPELL_TRAP', `"${definition.name.en}" is not a Spell/Trap card.`);

  // Which trigger this card may activate from where it is [RULE]; null = not activatable from there (yet).
  let trigger: 'Ignition' | 'Quick' | null;
  if (source.zone === 'Hand') {
    // [RULE] a Spell in the hand is activated on your own turn only (Quick-Play included), even in a window.
    if (playerIndex !== state.turnPlayerIndex)
      fail('NOT_TURN_PLAYER', 'a card in the hand may only be activated on your own turn.');
    if (definition.kind === 'Trap') {
      // [DECISION] C11: a Trap must be Set first.
      return state.ruleset.allowTrapActivationFromHand
        ? fail('NOT_ACTIVATABLE', 'Trap activation from the hand is not supported.')
        : fail('TRAP_NOT_SET', `"${definition.name.en}" is a Trap: Set it first.`);
    }
    // Normal / Equip (task 4.2c) / Continuous / Field (task 4.3) Spell: Ignition, Main Phase only. Quick-Play Spell:
    // Quick, any phase of your turn.
    const mainPhaseOnly =
      definition.subType === 'Normal' ||
      definition.subType === 'Equip' ||
      definition.subType === 'Continuous' ||
      definition.subType === 'Field';
    trigger = mainPhaseOnly ? 'Ignition' : definition.subType === 'QuickPlay' ? 'Quick' : null;
    if (mainPhaseOnly && state.phase !== 'Main1' && state.phase !== 'Main2')
      fail('WRONG_PHASE', `only allowed in a Main Phase (current phase: ${state.phase}).`);
  } else {
    // A face-up card is on the chain, resolving, or staying on the field (Equip, Continuous, Field): it cannot be
    // activated again.
    if (card.position !== 'DefenseDown')
      fail('NOT_ACTIVATABLE', `"${definition.name.en}" is already face-up.`);
    if (definition.kind === 'Trap' || definition.subType === 'QuickPlay') {
      // Set Trap (Normal / Counter / Continuous, task 4.3) and Set Quick-Play: Quick trigger, any phase.
      trigger = 'Quick';
    } else if (
      definition.subType === 'Normal' ||
      definition.subType === 'Continuous' ||
      definition.subType === 'Field'
    ) {
      // Task 4.3 [RULE]: a Set Spell Speed 1 card is activated like from the hand — its controller's turn (even while
      // the other player holds priority in a window), Main Phase. A Set Equip Spell: not yet.
      if (playerIndex !== state.turnPlayerIndex)
        fail('NOT_TURN_PLAYER', 'a Set Spell may only be activated on your own turn.');
      if (state.phase !== 'Main1' && state.phase !== 'Main2')
        fail('WRONG_PHASE', `only allowed in a Main Phase (current phase: ${state.phase}).`);
      trigger = 'Ignition';
    } else {
      trigger = null;
    }
  }
  if (trigger === null)
    return fail(
      'NOT_ACTIVATABLE',
      `a ${definition.subType} ${definition.kind} cannot be activated from the ${source.zone} yet.`,
    );

  const effect = definition.effects?.find((e) => e.id === effectId);
  if (!effect)
    return fail('EFFECT_NOT_FOUND', `"${definition.name.en}" has no effect "${effectId}".`);
  if (effect.trigger.kind !== trigger)
    return fail(
      'NOT_ACTIVATABLE',
      `a ${effect.trigger.kind} effect cannot be activated as a ${definition.subType} ${definition.kind}.`,
    );
  if (effect.scriptId !== undefined && !scriptFor(effect.scriptId))
    return fail('UNKNOWN_SCRIPT', `script "${effect.scriptId}" is not registered.`);

  if (source.zone !== 'Hand' && card.setTurn === state.turnCount) {
    // [RULE] not on the turn it was Set: Traps per `ruleset.trapSetTurnDelay`, Quick-Play Spells always. Any other Set
    // Spell may be activated at once (task 4.3).
    if (definition.kind === 'Trap' && state.ruleset.trapSetTurnDelay)
      fail('TRAP_SET_THIS_TURN', `"${definition.name.en}" was Set this turn.`);
    if (definition.kind === 'Spell' && definition.subType === 'QuickPlay')
      fail('SPELL_SET_THIS_TURN', `"${definition.name.en}" was Set this turn.`);
  }

  // [RULE] a Spell that stays on the field is placed there when it is activated from the hand: an Equip (task 4.2c) or
  // Continuous Spell (task 4.3) in a Spell/Trap Zone ([ASSUMED] the lowest empty one), a Field Spell in the Field Zone.
  let placement: Placement | null = null;
  if (source.zone === 'Hand' && definition.kind === 'Spell') {
    const board = state.players[playerIndex].board;
    if (definition.subType === 'Field') {
      // [DECISION] it replaces the player's own Field Spell, unless the ruleset forbids replacing.
      if (board.fieldZone !== null && !state.ruleset.fieldSpellReplace)
        fail('FIELD_ZONE_OCCUPIED', 'your Field Zone already holds a card.');
      placement = { zone: 'FieldZone' };
    } else if (definition.subType === 'Equip' || definition.subType === 'Continuous') {
      const zoneIndex = board.spellTrapZones.findIndex((c) => c === null);
      if (zoneIndex === -1)
        fail('NO_FREE_SPELL_TRAP_ZONE', `no empty Spell/Trap Zone for "${definition.name.en}".`);
      placement = { zone: 'SpellTrapZone', zoneIndex };
    }
  }

  // [RULE] a chain link must be Spell Speed 2+ and at least the speed of the link it responds to.
  const spellSpeed = spellSpeedOf(definition, effect);
  const top = state.chainStack.at(-1);
  if (top && (spellSpeed < 2 || spellSpeed < top.spellSpeed))
    fail(
      'SPELL_SPEED_TOO_LOW',
      `Spell Speed ${spellSpeed} cannot respond to Spell Speed ${top.spellSpeed}.`,
    );

  const needsCardTarget = effect.operations.some((o) => o.kind === 'Destroy');
  if (needsCardTarget && effect.target?.kind !== 'Card')
    return fail('NOT_ACTIVATABLE', 'the effect destroys cards but declares no Card target.');
  if (lacksSummonZones(state, playerIndex, effect))
    fail('NO_FREE_MONSTER_ZONE', 'not enough empty Monster Zones for the Special Summon.');

  if (!conditionsHold(state, playerIndex, effect.condition))
    return fail('CONDITION_NOT_MET', "the effect's conditions are not met.");

  const costPlan = planCosts(state, playerIndex, cardInstanceId, effect.cost, costInstanceIds, ctx);

  let candidates: readonly string[] | null = null;
  let targetCount = 0;
  if (effect.target?.kind === 'Card') {
    targetCount = effect.target.count;
    candidates = targetCandidates(state, playerIndex, effect.target, ctx);
    if (candidates.length < targetCount)
      fail(
        'NO_VALID_TARGET',
        `needs ${targetCount} target(s), only ${candidates.length} available.`,
      );
  }
  return {
    request,
    card,
    source,
    effect,
    spellSpeed,
    costPlan,
    candidates,
    targetCount,
    placement,
  };
}

/** The card in `player`'s hand, in their Spell/Trap Zone, or (task 4.3) in their Field Zone. */
function locate(
  player: PlayerState,
  instanceId: string,
): { card: CardInstance; source: ActivationSource } | null {
  const inHand = player.hand.find((c) => c.instanceId === instanceId);
  if (inHand) return { card: inHand, source: { zone: 'Hand' } };
  const zoneIndex = player.board.spellTrapZones.findIndex((c) => c?.instanceId === instanceId);
  const onField = player.board.spellTrapZones[zoneIndex];
  if (onField) return { card: onField, source: { zone: 'SpellTrapZone', zoneIndex } };
  const inFieldZone = player.board.fieldZone;
  return inFieldZone?.instanceId === instanceId
    ? { card: inFieldZone, source: { zone: 'FieldZone' } }
    : null;
}

/** True when `seat` has at least one activation the engine would accept right now (dry run over the candidates). */
export function hasLegalActivation(state: GameState, seat: 0 | 1, ctx: ActionContext): boolean {
  for (const candidate of activationCandidates(state, seat, ctx)) {
    try {
      prepare(
        state,
        {
          playerIndex: seat,
          cardInstanceId: candidate.payload.cardInstanceId,
          effectId: candidate.payload.effectId,
          costInstanceIds: candidate.payload.costInstanceIds ?? [],
        },
        ctx,
      );
      return true;
    } catch (error) {
      if (!(error instanceof EngineError)) throw error;
    }
  }
  return false;
}

/**
 * The Spell leaves the hand, the cost is paid, the link (with its targets) goes on the chain, then priority is settled
 * (auto-passes; the chain resolves right away when nobody can respond). `version` +1 once.
 */
function activate(
  state: GameState,
  prepared: Prepared,
  targetInstanceIds: readonly string[],
  ctx: ActionContext,
): Result {
  const { request, card, effect, costPlan, spellSpeed, placement } = prepared;
  // A Spell that stays on the field goes face-up into its zone at once and waits there, like an activated Set card.
  const source: ChainLinkSource = placement ?? prepared.source;
  const { playerIndex } = request;
  const events: GameEvent[] = [
    {
      type: 'EffectActivated',
      playerIndex,
      instanceId: card.instanceId,
      definitionId: card.definitionId,
      effectId: effect.id,
    },
  ];

  // Task 4.3: a Field Spell from the hand first sends the player's own Field Spell to the graveyard.
  let current: GameState = state;
  if (placement?.zone === 'FieldZone') {
    const cleared = clearFieldZone(current, playerIndex);
    current = cleared.state;
    events.push(...cleared.events);
  }

  // From the hand the card leaves it (it lives in the link, or goes to its `placement`); a Set card flips face-up and
  // stays in its zone [RULE].
  const player = current.players[playerIndex];
  const leftHand =
    prepared.source.zone === 'Hand'
      ? player.hand.filter((c) => c.instanceId !== card.instanceId)
      : player.hand;
  const faceUp: CardInstance =
    placement === null
      ? { ...card, position: 'Attack' }
      : {
          instanceId: card.instanceId,
          definitionId: card.definitionId,
          ownerIndex: card.ownerIndex,
          position: 'Attack',
        };
  const board: PlayerState['board'] =
    source.zone === 'SpellTrapZone'
      ? {
          ...player.board,
          spellTrapZones: player.board.spellTrapZones.map((slot, i) =>
            i === source.zoneIndex ? faceUp : slot,
          ) as unknown as PlayerState['board']['spellTrapZones'],
        }
      : source.zone === 'FieldZone'
        ? { ...player.board, fieldZone: faceUp }
        : player.board;
  const activated: PlayerState = { ...player, hand: leftHand, board };
  current = {
    ...current,
    players: playerIndex === 0 ? [activated, current.players[1]] : [current.players[0], activated],
  };

  const paid = payCosts(current, playerIndex, costPlan);
  current = paid.state;
  events.push(...paid.events);

  const link: ChainLink = {
    linkId: `link-${state.turnCount}-${state.version}`,
    playerIndex,
    card: {
      instanceId: card.instanceId,
      definitionId: card.definitionId,
      ownerIndex: card.ownerIndex,
      position: null,
    },
    source,
    effectId: effect.id,
    spellSpeed,
    costInstanceIds: costPlan.flatMap((step) =>
      step.kind === 'Discard'
        ? step.cards.map((c) => c.instanceId)
        : step.kind === 'Tribute'
          ? step.cards.map((t) => t.card.instanceId)
          : [],
    ),
    lpPaid: costPlan.reduce((sum, step) => (step.kind === 'PayLP' ? sum + step.amount : sum), 0),
    targetInstanceIds,
  };
  const pushed = pushLink(current, link);
  events.push(...pushed.events);

  const settled = settle(pushed.state, ctx, (s, seat) => hasLegalActivation(s, seat, ctx));
  events.push(...settled.events);
  return { state: { ...settled.state, version: state.version + 1 }, events };
}

export function applyActivateEffect(
  state: GameState,
  action: ActivateEffectAction,
  ctx: ActionContext,
): Result {
  const request: Request = {
    playerIndex: action.payload.playerIndex,
    cardInstanceId: action.payload.cardInstanceId,
    effectId: action.payload.effectId,
    costInstanceIds: action.payload.costInstanceIds ?? [],
  };
  const prepared = prepare(state, request, ctx);
  const { candidates, targetCount } = prepared;

  if (candidates === null) return activate(state, prepared, [], ctx);
  if (candidates.length === targetCount) return activate(state, prepared, candidates, ctx);

  const payload: SelectEffectTargetPayload = {
    cardInstanceId: request.cardInstanceId,
    effectId: request.effectId,
    costInstanceIds: request.costInstanceIds,
    candidateInstanceIds: candidates,
    count: targetCount,
  };
  const prompt: PendingPrompt = {
    promptId: `effect-${state.turnCount}-${state.version}`,
    playerIndex: request.playerIndex,
    kind: 'SelectEffectTarget',
    payload,
  };
  return { state: { ...state, pendingPrompt: prompt, version: state.version + 1 }, events: [] };
}

/** Answer to a `SelectEffectTarget` prompt: everything is re-validated against the (unchanged) state. */
export function resolveSelectEffectTarget(
  state: GameState,
  prompt: PendingPrompt,
  action: ResolvePendingPromptAction,
  ctx: ActionContext | undefined,
): Result {
  if (!ctx)
    throw new EngineError(
      'NO_CARD_RESOLVER',
      'ResolvePendingPrompt needs an ActionContext with cardDefinitions.',
    );
  const saved = prompt.payload as SelectEffectTargetPayload;
  const base: GameState = { ...state, pendingPrompt: null };
  const prepared = prepare(
    base,
    {
      playerIndex: prompt.playerIndex,
      cardInstanceId: saved.cardInstanceId,
      effectId: saved.effectId,
      costInstanceIds: saved.costInstanceIds,
    },
    ctx,
  );

  const chosen = action.payload.cardInstanceIds;
  const allowed = new Set(prepared.candidates ?? []);
  const bad = (reason: string): never => {
    throw new EngineError('INVALID_EFFECT_TARGET', `ResolvePendingPrompt rejected: ${reason}`);
  };
  if (chosen.length !== prepared.targetCount)
    bad(`choose exactly ${prepared.targetCount} target(s), got ${chosen.length}.`);
  if (new Set(chosen).size !== chosen.length) bad('duplicate target ids.');
  for (const id of chosen) if (!allowed.has(id)) bad(`${id} is not a legal target.`);

  return activate(base, prepared, chosen, ctx);
}
