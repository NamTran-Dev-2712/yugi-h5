import type { GameEvent } from '@yugi/game-engine';
import type { EventView } from '@yugi/shared';
import { visibleIds } from './visibility';

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
 *
 * `hidden` (task 4.2d, explicit on purpose): the ids `viewerIndex` may not be pointed at (`hiddenIdsFor` on the state the
 * response is built from). Only target lists use it: a ChainLinkAdded never tells the opponent which hand card an effect
 * chose (e.g. a Special Summon from the hand).
 */
export function toEventView(
  event: GameEvent,
  viewerIndex: 0 | 1,
  hidden: ReadonlySet<string>,
): EventView | null {
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
    case 'LifePointsRecovered':
    case 'LifePointsPaid':
    case 'SpellTrapDestroyed':
    // Chain (task 3.3, forwarded since 3.4b): the linked card was revealed when it was activated (EffectActivated) —
    // from the hand it lives in the chain link, a Set card was flipped face-up, a trigger's card is face-up on the field
    // or in the graveyard; ChainResolved carries no card data. Same public form as StateView.chain.
    case 'ChainLinkFizzled':
    case 'ChainResolved':
      return event;
    case 'ChainLinkAdded': {
      const targetInstanceIds = visibleIds(event.targetInstanceIds, hidden);
      return targetInstanceIds === event.targetInstanceIds
        ? event
        : { ...event, targetInstanceIds };
    }

    // Task 4.2a/b/c, forwarded since 4.2d: the Special Summoned / Flip Summoned monster is face-up, the Equip Spell is
    // face-up on a face-up monster.
    case 'MonsterSpecialSummoned':
    case 'FlipSummoned':
    case 'CardEquipped':
      return event;

    // PUBLIC (task 3.2). Task 4.3, engine-only: a Field Spell replaced by its controller's new one (`from: 'FieldZone'`)
    // is not on the wire yet (4.3b) — dropped, the client still sees the result in StateView.
    case 'CardSentToGraveyard':
      return event.from === 'FieldZone' ? null : { ...event, from: event.from };

    // ENGINE-ONLY (task 4.3, not on the wire until 4.3b): the Field Zone events have no EventView yet.
    case 'FieldSpellSet':
    case 'FieldSpellDestroyed':
      return null;

    default: {
      const unclassified: never = event;
      void unclassified;
      return null;
    }
  }
}

/** Filters a batch, keeping order and dropping events the viewer must not receive. */
export function toEventViews(
  events: readonly GameEvent[],
  viewerIndex: 0 | 1,
  hidden: ReadonlySet<string>,
): EventView[] {
  const views: EventView[] = [];
  for (const event of events) {
    const view = toEventView(event, viewerIndex, hidden);
    if (view !== null) views.push(view);
  }
  return views;
}
