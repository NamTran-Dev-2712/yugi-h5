import { EngineError } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import { settle } from '../../effects/chain.js';
import {
  pushTriggerLink,
  readyTrigger,
  runTriggers,
  type TriggerActivationPayload,
} from '../../effects/triggers.js';
import type { GameState, PendingPrompt } from '../../state/types.js';
import type { ActionContext, ResolvePendingPromptAction } from '../types.js';
import { hasLegalActivation } from './activate-effect.js';

/**
 * Answer to a `TriggerActivation` prompt (task 3.5): `decline: true` (optional triggers only, no ids) or exactly
 * `count` target ids among the candidates (none when the effect has no Card target). The trigger is re-checked against
 * the current state (task 4.8: one that can no longer activate is skipped, whatever the answer); the remaining triggers
 * then run, and priority is settled. `version` +1.
 */
export function resolveTriggerActivation(
  state: GameState,
  prompt: PendingPrompt,
  action: ResolvePendingPromptAction,
  ctx: ActionContext | undefined,
): { state: GameState; events: GameEvent[] } {
  if (!ctx)
    throw new EngineError(
      'NO_CARD_RESOLVER',
      'ResolvePendingPrompt needs an ActionContext with cardDefinitions.',
    );
  const saved = prompt.payload as TriggerActivationPayload;
  const base: GameState = { ...state, pendingPrompt: null };
  const bad = (reason: string): never => {
    throw new EngineError('INVALID_TRIGGER_ANSWER', `ResolvePendingPrompt rejected: ${reason}`);
  };

  const ready = readyTrigger(base, saved.trigger, ctx);

  const chosen = action.payload.cardInstanceIds;
  const events: GameEvent[] = [];
  let current = base;
  if (ready === null) {
    // Task 4.8: the trigger can no longer activate (its card, its cost or its last target is gone). `readyTrigger`
    // reads the board as it stands after the action, so the engine does not open such a prompt any more — but a prompt
    // must never be a dead end: whatever the answer, the trigger simply does not activate and the rest goes on.
  } else if (action.payload.decline === true) {
    if (!ready.optional) bad('a mandatory trigger cannot be declined.');
    if (chosen.length > 0) bad('declining takes no card ids.');
  } else {
    const allowed = new Set(ready.candidates ?? []);
    if (chosen.length !== ready.count)
      bad(`choose exactly ${ready.count} target(s), got ${chosen.length}.`);
    if (new Set(chosen).size !== chosen.length) bad('duplicate target ids.');
    for (const id of chosen) if (!allowed.has(id)) bad(`${id} is not a legal target.`);
    const pushed = pushTriggerLink(current, saved.trigger, ready, chosen);
    current = pushed.state;
    events.push(...pushed.events);
  }

  const canActivate = (s: GameState, seat: 0 | 1) => hasLegalActivation(s, seat, ctx);
  // Task 4.4c: no Summon reaction window opens here any more (it came before the triggers); `saved.afterward` is null.
  const rest = runTriggers(current, saved.remaining, ctx);
  events.push(...rest.events);
  const settled = settle(rest.state, ctx, canActivate);
  events.push(...settled.events);
  return { state: { ...settled.state, version: state.version + 1 }, events };
}
