import type { EffectDefinition } from '@yugi/shared';
import { EngineError, type EngineErrorCode } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type {
  CardInstance,
  ChainLink,
  GameState,
  PendingPrompt,
  PlayerState,
} from '../../state/types.js';
import { activationCandidates } from '../../effects/activation-candidates.js';
import { pushLink, settle } from '../../effects/chain.js';
import { conditionsHold } from '../../effects/conditions.js';
import { payCosts, planCosts, type CostStep } from '../../effects/costs.js';
import { targetCandidates } from '../../effects/targets.js';
import type { ActionContext, ActivateEffectAction, ResolvePendingPromptAction } from '../types.js';

/*
 * Activating a Spell from the hand (task 3.2, chained in task 3.3). Validation (`prepare`) and the target prompt are
 * side-effect free. `activate` pays the cost, fixes the targets and pushes a chain link; the operations only run when
 * the chain resolves (`effects/chain.ts`). With nobody able to respond, the chain resolves in the same call.
 */

type Result = { state: GameState; events: GameEvent[] };

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
  readonly effect: EffectDefinition;
  readonly spellSpeed: 1 | 2;
  readonly costPlan: readonly CostStep[];
  /** Candidate ids for the effect's `Card` target; null when the effect has no Card target. */
  readonly candidates: readonly string[] | null;
  readonly targetCount: number;
}

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
  // [RULE] Spells in the hand are activated on your own turn only (Quick-Play included).
  if (playerIndex !== state.turnPlayerIndex)
    fail('NOT_TURN_PLAYER', 'only the turn player may act.');
  if (state.phase !== 'Main1' && state.phase !== 'Main2') {
    fail('WRONG_PHASE', `only allowed in a Main Phase (current phase: ${state.phase}).`);
  }

  const player = state.players[playerIndex];
  const card = player.hand.find((c) => c.instanceId === cardInstanceId);
  if (!card) return fail('CARD_NOT_IN_HAND', `card ${cardInstanceId} is not in your hand.`);

  const definition = ctx.cardDefinitions(card.definitionId);
  if (!definition)
    return fail(
      'CARD_DEFINITION_NOT_FOUND',
      `card definition "${card.definitionId}" was not found.`,
    );
  if (definition.kind === 'Monster')
    return fail('NOT_A_SPELL_TRAP', `"${definition.name.en}" is not a Spell/Trap card.`);
  if (definition.kind === 'Trap') {
    // [DECISION] C11: a Trap must be Set first. Activating a Set Trap is task 3.4.
    return state.ruleset.allowTrapActivationFromHand
      ? fail('NOT_ACTIVATABLE', 'Trap activation is not supported yet.')
      : fail('TRAP_NOT_SET', `"${definition.name.en}" is a Trap: Set it first.`);
  }
  // Normal Spell = Ignition trigger, Spell Speed 1. Quick-Play Spell = Quick trigger, Spell Speed 2 [RULE].
  const kinds = {
    Normal: { trigger: 'Ignition', speed: 1 },
    QuickPlay: { trigger: 'Quick', speed: 2 },
  } as const;
  const kind =
    definition.subType === 'Normal' || definition.subType === 'QuickPlay'
      ? kinds[definition.subType]
      : null;
  if (!kind)
    return fail(
      'NOT_ACTIVATABLE',
      `only Normal and Quick-Play Spells can be activated for now (got ${definition.subType}).`,
    );

  const effect = definition.effects?.find((e) => e.id === effectId);
  if (!effect)
    return fail('EFFECT_NOT_FOUND', `"${definition.name.en}" has no effect "${effectId}".`);
  if (effect.trigger.kind !== kind.trigger)
    return fail(
      'NOT_ACTIVATABLE',
      `a ${effect.trigger.kind} effect cannot be activated from the hand as a ${definition.subType} Spell.`,
    );

  // [RULE] a chain link must be Spell Speed 2+ and at least the speed of the link it responds to.
  const top = state.chainStack.at(-1);
  if (top && (kind.speed < 2 || kind.speed < top.spellSpeed))
    fail(
      'SPELL_SPEED_TOO_LOW',
      `Spell Speed ${kind.speed} cannot respond to Spell Speed ${top.spellSpeed}.`,
    );

  const needsCardTarget = effect.operations.some((o) => o.kind === 'Destroy');
  if (needsCardTarget && effect.target?.kind !== 'Card')
    return fail('NOT_ACTIVATABLE', 'the effect destroys cards but declares no Card target.');

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
  return { request, card, effect, spellSpeed: kind.speed, costPlan, candidates, targetCount };
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
  const { request, card, effect, costPlan, spellSpeed } = prepared;
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

  const player = state.players[playerIndex];
  const withoutSpell: PlayerState = {
    ...player,
    hand: player.hand.filter((c) => c.instanceId !== card.instanceId),
  };
  let current: GameState = {
    ...state,
    players:
      playerIndex === 0 ? [withoutSpell, state.players[1]] : [state.players[0], withoutSpell],
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
