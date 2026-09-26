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
      return t('event.cardSentToGraveyard', {
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
    default: {
      const unhandled: never = event;
      return t('event.unknown', { json: JSON.stringify(unhandled) });
    }
  }
}
