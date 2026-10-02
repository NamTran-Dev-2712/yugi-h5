import type { EventView } from '@yugi/shared';
import { t } from '../i18n/i18n';

export interface DescribeContext {
  /** Display name of a card definition. */
  cardName(definitionId: string): string;
  /** Readable label for a card instance (events only carry instance ids for attacks). */
  instanceLabel(instanceId: string): string;
}

/** One readable line per event. Exhaustive on purpose: a new EventView type is a compile error until it is worded. */
export function describeEvent(event: EventView, ctx: DescribeContext): string {
  const p = (i: number): string => `P${i}`;
  switch (event.type) {
    case 'DuelStarted':
      return t('event.duelStarted', { player: p(event.turnPlayerIndex) });
    case 'CardDrawn':
      return event.card.hidden
        ? t('event.cardDrawnHidden', { player: p(event.playerIndex) })
        : t('event.cardDrawn', {
            player: p(event.playerIndex),
            card: ctx.cardName(event.card.definitionId),
          });
    case 'DeckOut':
      return t('event.deckOut', { player: p(event.playerIndex) });
    case 'CardDiscarded':
      return t('event.cardDiscarded', {
        player: p(event.playerIndex),
        card: ctx.cardName(event.definitionId),
      });
    case 'PhaseChanged':
      return t('event.phaseChanged', {
        from: event.from,
        to: event.to,
        player: p(event.turnPlayerIndex),
      });
    case 'TurnChanged':
      return t('event.turnChanged', { turn: event.turnCount, player: p(event.turnPlayerIndex) });
    case 'NormalSummoned':
      return t('event.normalSummoned', {
        player: p(event.playerIndex),
        card: ctx.cardName(event.definitionId),
        zone: event.zoneIndex,
      });
    case 'MonsterSet':
      return t('event.monsterSet', { player: p(event.playerIndex), zone: event.zoneIndex });
    case 'MonsterTributed':
      return t('event.monsterTributed', {
        player: p(event.ownerIndex),
        card: ctx.cardName(event.definitionId),
        zone: event.zoneIndex,
      });
    case 'PositionChanged':
      return t('event.positionChanged', {
        player: p(event.playerIndex),
        card: ctx.cardName(event.definitionId),
        from: event.from,
        to: event.to,
      });
    case 'MonsterFlipped':
      return t('event.monsterFlipped', {
        player: p(event.ownerIndex),
        card: ctx.cardName(event.definitionId),
        zone: event.zoneIndex,
      });
    case 'AttackDeclared':
      return event.targetInstanceId === null
        ? t('event.attackDirect', {
            player: p(event.playerIndex),
            attacker: ctx.instanceLabel(event.attackerInstanceId),
          })
        : t('event.attackTarget', {
            player: p(event.playerIndex),
            target: ctx.instanceLabel(event.targetInstanceId),
            attacker: ctx.instanceLabel(event.attackerInstanceId),
          });
    case 'MonsterDestroyed':
      return t('event.monsterDestroyed', {
        player: p(event.ownerIndex),
        card: ctx.cardName(event.definitionId),
        zone: event.zoneIndex,
      });
    case 'DamageDealt':
      return t('event.damageDealt', { player: p(event.playerIndex), amount: event.amount });
    case 'DuelEnded':
      return event.winnerIndex === null
        ? t('event.duelEndedDraw', { reason: event.reason })
        : t('event.duelEndedWin', { winner: p(event.winnerIndex), reason: event.reason });
    case 'SpellTrapSet':
      // Set face-down: the event has no definitionId, so the line cannot name the card.
      return t('event.spellTrapSet', { player: p(event.playerIndex), zone: event.zoneIndex });
    case 'EffectActivated':
      return t('event.effectActivated', {
        player: p(event.playerIndex),
        card: ctx.cardName(event.definitionId),
      });
    case 'EffectResolved':
      return t('event.effectResolved', {
        player: p(event.playerIndex),
        card: ctx.cardName(event.definitionId),
      });
    case 'CardSentToGraveyard':
      // Task 4.3b: from the Field Zone = a Field Spell replaced by its controller's new one (sent, not destroyed).
      return t(
        event.from === 'FieldZone' ? 'event.fieldSpellReplaced' : 'event.cardSentToGraveyard',
        { player: p(event.ownerIndex), card: ctx.cardName(event.definitionId) },
      );
    case 'FieldSpellSet':
      // Set face-down: the event has no definitionId, so the line cannot name the card.
      return t('event.fieldSpellSet', { player: p(event.playerIndex) });
    case 'FieldSpellDestroyed':
      return t('event.fieldSpellDestroyed', {
        player: p(event.ownerIndex),
        card: ctx.cardName(event.definitionId),
      });
    case 'LifePointsRecovered':
      return t('event.lifePointsRecovered', {
        player: p(event.playerIndex),
        amount: event.amount,
      });
    case 'LifePointsPaid':
      return t('event.lifePointsPaid', { player: p(event.playerIndex), amount: event.amount });
    case 'SpellTrapDestroyed':
      return t('event.spellTrapDestroyed', {
        player: p(event.ownerIndex),
        card: ctx.cardName(event.definitionId),
        zone: event.zoneIndex,
      });
    // Chain (task 3.4b): the linked card is public (it was revealed when activated).
    case 'ChainLinkAdded':
      return t('event.chainLinkAdded', {
        player: p(event.playerIndex),
        card: ctx.cardName(event.definitionId),
        index: event.chainIndex,
      });
    case 'ChainLinkFizzled':
      return t('event.chainLinkFizzled', {
        player: p(event.playerIndex),
        card: ctx.cardName(event.definitionId),
      });
    case 'ChainResolved':
      return t('event.chainResolved', { count: event.linkCount });
    // Task 4.2d: the Special/Flip Summoned monster and the Equip Spell are face-up (public).
    case 'MonsterSpecialSummoned':
      return t(
        event.from === 'Hand' ? 'event.specialSummonedHand' : 'event.specialSummonedGraveyard',
        {
          player: p(event.playerIndex),
          card: ctx.cardName(event.definitionId),
          zone: event.zoneIndex,
        },
      );
    case 'FlipSummoned':
      return t('event.flipSummoned', {
        player: p(event.playerIndex),
        card: ctx.cardName(event.definitionId),
        zone: event.zoneIndex,
      });
    case 'CardEquipped':
      return t('event.cardEquipped', {
        player: p(event.playerIndex),
        card: ctx.cardName(event.definitionId),
        target: ctx.instanceLabel(event.targetInstanceId),
      });
    default: {
      const unhandled: never = event;
      return t('event.unknown', { json: JSON.stringify(unhandled) });
    }
  }
}
