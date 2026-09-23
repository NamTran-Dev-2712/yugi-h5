import type { GameEvent } from '@yugi/game-engine';
import type { EventView } from '@yugi/shared';

/**
 * Filters one engine GameEvent down to what `viewerIndex` may see (classification table:
 * docs/design/event-visibility.md). Pure. `null` = the viewer must not receive the event at all.
 *
 * Deny by default: the switch is exhaustive, so adding an event type to the engine without classifying it
 * here fails `tsc` at the `never` below; at runtime an unclassified type is dropped (null), never forwarded.
 *
 * Decisions depend only on the event type: the engine already emits events with reveal semantics baked in
 * (e.g. MonsterSet carries no definitionId). Contract on the engine: an event never carries the definitionId
 * of a card that is still hidden from the opponent, except CardDrawn (OWNER_ONLY, handled here). The
 * cross-check in event-visibility.spec.ts guards this contract.
 */
export function toEventView(event: GameEvent, viewerIndex: 0 | 1): EventView | null {
  switch (event.type) {
    // OWNER_ONLY: the drawer sees the card, the opponent only that a card was drawn.
    case 'CardDrawn':
      return {
        type: 'CardDrawn',
        playerIndex: event.playerIndex,
        card:
          viewerIndex === event.playerIndex
            ? {
                hidden: false,
                instanceId: event.instanceId,
                definitionId: event.definitionId,
                position: null,
                ownerIndex: event.playerIndex,
              }
            : { hidden: true, instanceId: event.instanceId, ownerIndex: event.playerIndex },
      };

    // PUBLIC: no hidden information (face-up cards, graveyard/public zones, or no card data at all).
    case 'DuelStarted':
    case 'DeckOut':
    case 'CardDiscarded':
    case 'PhaseChanged':
    case 'TurnChanged':
    case 'NormalSummoned':
    case 'MonsterSet':
    case 'MonsterTributed':
    case 'PositionChanged':
    case 'MonsterFlipped':
    case 'AttackDeclared':
    case 'MonsterDestroyed':
    case 'DamageDealt':
    case 'DuelEnded':
      return event;

    default: {
      const unclassified: never = event;
      void unclassified;
      return null;
    }
  }
}

/** Filters a batch, keeping order and dropping events the viewer must not receive. */
export function toEventViews(events: readonly GameEvent[], viewerIndex: 0 | 1): EventView[] {
  const views: EventView[] = [];
  for (const event of events) {
    const view = toEventView(event, viewerIndex);
    if (view !== null) views.push(view);
  }
  return views;
}
