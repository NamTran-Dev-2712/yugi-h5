import type { EffectDefinition } from '@yugi/shared';
import type { ActionContext } from '../actions/types.js';
import { EngineError } from '../errors.js';
import type { GameEvent } from '../events/types.js';
import type {
  CardInstance,
  ChainLink,
  ChainLinkSource,
  GameState,
  PendingPrompt,
} from '../state/types.js';
import { openReactionWindow, pushLink, type CanActivate } from './chain.js';
import { conditionsHold } from './conditions.js';
import { payCosts, planCosts, type CostStep } from './costs.js';
import { scriptFor } from './effect-scripts/registry.js';
import { spellSpeedOf } from './spell-speed.js';
import { targetCandidates } from './targets.js';

/*
 * Trigger effects (task 3.5), pure helpers. A trigger is not activated by an action: it fires from what just happened
 * (the events of the step), read from the card's own `EffectDefinition`:
 * - `OnSummon`: the card was Normal Summoned (Tribute Summon included; a Set is not a Summon) [RULE].
 * - `OnDestroyed`: the card was destroyed (battle or effect) and is in its owner's graveyard.
 * A `mandatory` trigger goes on the chain by itself; an optional one asks its owner (`TriggerActivation` prompt), and so
 * does a trigger with more target candidates than it needs. Links use the ordinary chain (`pushLink`); the caller then
 * settles priority. Order [RULE]: the turn player's triggers first, then the opponent's; [ASSUMED] G15 within one
 * player, the order of the events. None of these bump `version`.
 */

type Result = { state: GameState; events: GameEvent[] };

/** A trigger that fired and waits to be put on the chain (or offered to its owner). Serializable (stored in prompts). */
export interface PendingTrigger {
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly effectId: string;
  readonly source: Extract<ChainLinkSource, { zone: 'MonsterZone' } | { zone: 'Graveyard' }>;
}

/** What to do once every trigger was handled and none went on the chain (task 3.4c Summon reaction window). */
export type TriggerAfterward = {
  readonly kind: 'SummonReaction';
  readonly responder: 0 | 1;
} | null;

/** `PendingPrompt.payload` of kind `TriggerActivation`. */
export interface TriggerActivationPayload {
  readonly trigger: PendingTrigger;
  /** false = mandatory (asked only to choose targets): `decline` is not allowed. */
  readonly optional: boolean;
  /** Target candidates (zone order); empty when the effect has no Card target. */
  readonly candidateInstanceIds: readonly string[];
  /** Exactly this many ids must be chosen (0 = no target). */
  readonly count: number;
  /** Triggers still to handle after this one, in chain order. */
  readonly remaining: readonly PendingTrigger[];
  readonly afterward: TriggerAfterward;
}

/** Everything needed to put one trigger on the chain now, or null when it cannot activate (card gone, condition...). */
export interface ReadyTrigger {
  readonly effect: EffectDefinition;
  readonly spellSpeed: 1 | 2 | 3;
  readonly optional: boolean;
  readonly costPlan: readonly CostStep[];
  /** null = no Card target. */
  readonly candidates: readonly string[] | null;
  readonly count: number;
}

function effectsOf(
  definitionId: string,
  kind: 'OnSummon' | 'OnDestroyed',
  ctx: ActionContext,
): EffectDefinition[] {
  return (ctx.cardDefinitions(definitionId)?.effects ?? []).filter((e) => e.trigger.kind === kind);
}

/** Triggers fired by `events`, in chain order (turn player first, then event order). Cards without triggers: none. */
export function collectTriggers(
  state: GameState,
  events: readonly GameEvent[],
  ctx: ActionContext,
): PendingTrigger[] {
  if (state.winnerIndex !== null) return [];
  const fired: PendingTrigger[] = [];
  for (const event of events) {
    if (event.type === 'NormalSummoned') {
      for (const effect of effectsOf(event.definitionId, 'OnSummon', ctx)) {
        fired.push({
          playerIndex: event.playerIndex,
          instanceId: event.instanceId,
          definitionId: event.definitionId,
          effectId: effect.id,
          source: { zone: 'MonsterZone', zoneIndex: event.zoneIndex },
        });
      }
    } else if (event.type === 'MonsterDestroyed' || event.type === 'SpellTrapDestroyed') {
      for (const effect of effectsOf(event.definitionId, 'OnDestroyed', ctx)) {
        fired.push({
          playerIndex: event.ownerIndex,
          instanceId: event.instanceId,
          definitionId: event.definitionId,
          effectId: effect.id,
          source: { zone: 'Graveyard' },
        });
      }
    }
  }
  const turn = state.turnPlayerIndex;
  return [
    ...fired.filter((t) => t.playerIndex === turn),
    ...fired.filter((t) => t.playerIndex !== turn),
  ];
}

/** Is the trigger's card still where it fired from (face-up on the field / in its owner's graveyard)? */
function stillThere(state: GameState, trigger: PendingTrigger): boolean {
  const owner = state.players[trigger.playerIndex];
  if (trigger.source.zone === 'MonsterZone') {
    const card = owner.board.monsterZones[trigger.source.zoneIndex];
    return card?.instanceId === trigger.instanceId && card.position !== 'DefenseDown';
  }
  return owner.graveyard.some((c) => c.instanceId === trigger.instanceId);
}

/** Checks the trigger against the CURRENT state (condition, cost, targets); null = it does not activate. */
export function readyTrigger(
  state: GameState,
  trigger: PendingTrigger,
  ctx: ActionContext,
): ReadyTrigger | null {
  if (state.winnerIndex !== null || !stillThere(state, trigger)) return null;
  const definition = ctx.cardDefinitions(trigger.definitionId);
  const effect = definition?.effects?.find((e) => e.id === trigger.effectId);
  if (!definition || !effect) return null;
  if (effect.trigger.kind !== 'OnSummon' && effect.trigger.kind !== 'OnDestroyed') return null;
  // Task 3.6: a script nobody registered never activates (as in ActivateEffect's UNKNOWN_SCRIPT).
  if (effect.scriptId !== undefined && !scriptFor(effect.scriptId)) return null;
  if (!conditionsHold(state, trigger.playerIndex, effect.condition)) return null;

  let costPlan: CostStep[];
  try {
    costPlan = planCosts(state, trigger.playerIndex, trigger.instanceId, effect.cost, [], ctx);
  } catch (error) {
    if (!(error instanceof EngineError)) throw error;
    return null; // [RULE] a cost that cannot be paid: the effect does not activate
  }

  let candidates: string[] | null = null;
  let count = 0;
  if (effect.target?.kind === 'Card') {
    count = effect.target.count;
    candidates = targetCandidates(state, trigger.playerIndex, effect.target, ctx);
    if (candidates.length < count) return null; // [RULE] no legal target: it does not activate
  } else if (effect.operations.some((o) => o.kind === 'Destroy')) {
    return null; // malformed effect (Destroy without a Card target), as in ActivateEffect
  }
  return {
    effect,
    spellSpeed: spellSpeedOf(definition, effect),
    optional: effect.trigger.mandatory !== true,
    costPlan,
    candidates,
    count,
  };
}

/** Activates the trigger: `EffectActivated`, cost, then a chain link (the card stays where it is). */
export function pushTriggerLink(
  state: GameState,
  trigger: PendingTrigger,
  ready: ReadyTrigger,
  targetInstanceIds: readonly string[],
): Result {
  const { playerIndex } = trigger;
  const events: GameEvent[] = [
    {
      type: 'EffectActivated',
      playerIndex,
      instanceId: trigger.instanceId,
      definitionId: trigger.definitionId,
      effectId: trigger.effectId,
    },
  ];
  const paid = payCosts(state, playerIndex, ready.costPlan);
  events.push(...paid.events);
  const card: CardInstance = {
    instanceId: trigger.instanceId,
    definitionId: trigger.definitionId,
    ownerIndex: playerIndex,
    position: null,
  };
  const link: ChainLink = {
    // Several triggers can be pushed in one step: the chain index keeps ids unique.
    linkId: `trigger-${state.turnCount}-${state.version}-${state.chainStack.length + 1}`,
    playerIndex,
    card,
    source: trigger.source,
    effectId: trigger.effectId,
    spellSpeed: ready.spellSpeed,
    costInstanceIds: [],
    lpPaid: ready.costPlan.reduce((sum, s) => (s.kind === 'PayLP' ? sum + s.amount : sum), 0),
    targetInstanceIds,
  };
  const pushed = pushLink(paid.state, link);
  events.push(...pushed.events);
  return { state: pushed.state, events };
}

/**
 * Handles `queue` in order: a trigger that needs nobody's input goes on the chain; the first one that needs its owner
 * (optional, or a target to choose) becomes a `TriggerActivation` prompt carrying the rest. Once the queue is done and
 * nothing went on the chain, `afterward` runs (the Summon reaction window). The caller settles priority afterwards.
 */
export function runTriggers(
  state: GameState,
  queue: readonly PendingTrigger[],
  afterward: TriggerAfterward,
  ctx: ActionContext,
  canActivate?: CanActivate,
): Result {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < queue.length; i++) {
    const trigger = queue[i]!;
    const ready = readyTrigger(current, trigger, ctx);
    if (ready === null) continue;
    const candidates = ready.candidates ?? [];
    if (!ready.optional && candidates.length === ready.count) {
      const out = pushTriggerLink(current, trigger, ready, candidates);
      current = out.state;
      events.push(...out.events);
      continue;
    }
    const payload: TriggerActivationPayload = {
      trigger,
      optional: ready.optional,
      candidateInstanceIds: candidates,
      count: ready.count,
      remaining: queue.slice(i + 1),
      afterward,
    };
    const prompt: PendingPrompt = {
      promptId: `trigger-${current.turnCount}-${current.version}`,
      playerIndex: trigger.playerIndex,
      kind: 'TriggerActivation',
      payload,
    };
    return { state: { ...current, pendingPrompt: prompt }, events };
  }

  if (afterward !== null && current.chainStack.length === 0) {
    if (!canActivate) throw new Error('runTriggers: a Summon reaction window needs canActivate.');
    const opened = openReactionWindow(
      current,
      afterward.responder,
      { kind: 'Summon' },
      canActivate,
    );
    if (opened !== null) current = opened;
  }
  return { state: current, events };
}

/** Collects the triggers fired by `events` and runs them (no `afterward`). */
export function fireTriggers(
  state: GameState,
  events: readonly GameEvent[],
  ctx: ActionContext,
): Result {
  const queue = collectTriggers(state, events, ctx);
  if (queue.length === 0) return { state, events: [] };
  return runTriggers(state, queue, null, ctx);
}
