import type { EffectDefinition } from '@yugi/shared';
import { EngineError, type EngineErrorCode } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type { CardInstance, GameState, PendingPrompt, PlayerState } from '../../state/types.js';
import { conditionsHold } from '../../effects/conditions.js';
import { payCosts, planCosts, type CostStep } from '../../effects/costs.js';
import { OPERATION_HANDLERS } from '../../effects/operations/index.js';
import type { OperationContext } from '../../effects/operations/types.js';
import { targetCandidates } from '../../effects/targets.js';
import type { ActionContext, ActivateEffectAction, ResolvePendingPromptAction } from '../types.js';

/**
 * Task 3.2: activating a Normal Spell from the hand resolves IMMEDIATELY (no chain / priority window yet — task 3.3
 * wraps this in a chain without changing the action's payload). Nothing in `state` changes until every check passed:
 * validation and the target prompt are side-effect free; costs are paid and operations run in one final step.
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
  // Task 3.2 maps "a Normal Spell activated from the hand" onto the `Ignition` trigger.
  if (definition.subType !== 'Normal')
    return fail(
      'NOT_ACTIVATABLE',
      `only Normal Spells can be activated for now (got ${definition.subType}).`,
    );

  const effect = definition.effects?.find((e) => e.id === effectId);
  if (!effect)
    return fail('EFFECT_NOT_FOUND', `"${definition.name.en}" has no effect "${effectId}".`);
  if (effect.trigger.kind !== 'Ignition')
    return fail(
      'NOT_ACTIVATABLE',
      `a ${effect.trigger.kind} effect cannot be activated from the hand.`,
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
  return { request, card, effect, costPlan, candidates, targetCount };
}

/** Pays costs, moves the Spell out of the hand, runs the operations, then sends the Spell to the graveyard. */
function execute(
  state: GameState,
  prepared: Prepared,
  targetInstanceIds: readonly string[],
): Result {
  const { request, card, effect, costPlan } = prepared;
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

  // The Spell leaves the hand on activation; it reaches the graveyard once the effect is done.
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

  const opCtx: OperationContext = { controller: playerIndex, targetInstanceIds };
  for (const op of effect.operations) {
    if (current.winnerIndex !== null) break; // the duel ended mid-effect: later operations never run
    const handler = OPERATION_HANDLERS[op.kind] as (
      s: GameState,
      o: typeof op,
      c: OperationContext,
    ) => { state: GameState; events: GameEvent[] };
    const out = handler(current, op, opCtx);
    current = out.state;
    events.push(...out.events);
  }

  const owner = current.players[playerIndex];
  const spent: PlayerState = {
    ...owner,
    graveyard: [
      ...owner.graveyard,
      {
        instanceId: card.instanceId,
        definitionId: card.definitionId,
        ownerIndex: card.ownerIndex,
        position: null,
      },
    ],
  };
  current = {
    ...current,
    players: playerIndex === 0 ? [spent, current.players[1]] : [current.players[0], spent],
    version: state.version + 1,
  };
  events.push(
    {
      type: 'EffectResolved',
      playerIndex,
      instanceId: card.instanceId,
      definitionId: card.definitionId,
      effectId: effect.id,
    },
    {
      type: 'CardSentToGraveyard',
      ownerIndex: card.ownerIndex,
      instanceId: card.instanceId,
      definitionId: card.definitionId,
      from: 'Hand',
    },
  );

  // Keep "the duel is over" as the final word of the batch.
  const ordered = [
    ...events.filter((e) => e.type !== 'DuelEnded'),
    ...events.filter((e) => e.type === 'DuelEnded'),
  ];
  return { state: current, events: ordered };
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

  if (candidates === null) return execute(state, prepared, []);
  if (candidates.length === targetCount) return execute(state, prepared, candidates);

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

  return execute(base, prepared, chosen);
}
