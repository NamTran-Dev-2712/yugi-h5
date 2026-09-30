import type { GameState } from '@yugi/game-engine';
import type { PlayerAction } from '@yugi/shared';

/**
 * Task 4.2d — the instance ids `viewer` must never be POINTED AT in a list sent to them: the cards of the opponent's hand
 * and of both decks / Extra Decks. Opponent hand ids themselves are public (the view lists them as hidden cards); what
 * must not leak is "that hand card is the one the effect chose" (e.g. a Special Summon from the hand: it tells the card
 * is a monster before it is revealed). Computed on the state the response is built from (the final state of the
 * request), the same rule as the test oracle (`testing/leak-check.ts`).
 */
export function hiddenIdsFor(state: GameState, viewer: 0 | 1): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const c of state.players[viewer === 0 ? 1 : 0].hand) ids.add(c.instanceId);
  for (const p of state.players) {
    for (const c of p.deck) ids.add(c.instanceId);
    for (const c of p.extraDeck) ids.add(c.instanceId);
  }
  return ids;
}

/** Keeps the ids the viewer may see, in order (`ids` itself when nothing is hidden). */
export function visibleIds(ids: readonly string[], hidden: ReadonlySet<string>): readonly string[] {
  return ids.some((id) => hidden.has(id)) ? ids.filter((id) => !hidden.has(id)) : ids;
}

/**
 * An AI action as the human may see it (`aiActions`): prompt answers and activation costs lose the ids of cards still
 * hidden from them (the AI's hand/deck). Returns `action` itself when nothing is hidden. The action is only replayed as
 * text/animation on the client, never sent back.
 */
export function redactAction(action: PlayerAction, hidden: ReadonlySet<string>): PlayerAction {
  switch (action.type) {
    case 'ResolvePendingPrompt': {
      const ids = visibleIds(action.payload.cardInstanceIds, hidden);
      return ids === action.payload.cardInstanceIds
        ? action
        : { ...action, payload: { ...action.payload, cardInstanceIds: [...ids] } };
    }
    case 'ActivateEffect': {
      const cost = action.payload.costInstanceIds;
      if (!cost) return action;
      const ids = visibleIds(cost, hidden);
      return ids === cost
        ? action
        : { ...action, payload: { ...action.payload, costInstanceIds: [...ids] } };
    }
    default:
      return action;
  }
}
