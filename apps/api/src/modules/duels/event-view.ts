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
    // Spell/Trap (task 3.2, forwarded since 3.2b): SpellTrapSet carries no definitionId (Set face-down); activating a
    // card reveals it (EffectActivated/EffectResolved/CardSentToGraveyard); SpellTrapDestroyed sends the card to the
    // public graveyard; the LP events carry no card data.
    case 'SpellTrapSet':
    case 'EffectActivated':
    case 'EffectResolved':
    case 'CardSentToGraveyard':
    case 'LifePointsRecovered':
    case 'LifePointsPaid':
    case 'SpellTrapDestroyed':
    // Chain (task 3.3, forwarded since 3.4b): the linked card was revealed when it was activated (EffectActivated) —
    // from the hand it lives in the chain link, a Set card was flipped face-up, a trigger's card is face-up on the field
    // or in the graveyard; ChainResolved carries no card data. Same public form as StateView.chain.
    case 'ChainLinkAdded':
    case 'ChainLinkFizzled':
    case 'ChainResolved':
      return event;

    // Engine-only for now (task 4.2a; no card of the pool Special Summons yet): classified PUBLIC (always face-up) in
    // docs/design/event-visibility.md, but not forwarded until EventView has it (wire task).
    case 'MonsterSpecialSummoned':
    // Task 4.2b: FlipSummoned is PUBLIC (face-up), engine-only like above.
    case 'FlipSummoned':
      return null;

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
