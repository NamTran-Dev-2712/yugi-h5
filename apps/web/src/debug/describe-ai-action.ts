import type { PlayerAction } from '@yugi/shared';
import { t } from '../i18n/i18n';

export interface DescribeAiContext {
  /** Readable label for a card instance, against the view the person is looking at. */
  instanceLabel(instanceId: string): string;
}

/**
 * One readable line for an action the SERVER played for the AI seat. Exhaustive on purpose: a new player action
 * is a compile error until it is worded. Only ids the person already sees in the events are printed.
 */
export function describeAiAction(action: PlayerAction, ctx: DescribeAiContext): string {
  const label = ctx.instanceLabel;
  switch (action.type) {
    case 'EndPhase':
      return t('ai.endPhase');
    case 'NormalSummon': {
      const { cardInstanceId, zoneIndex, tributeInstanceIds } = action.payload;
      const tributes = tributeInstanceIds ?? [];
      return tributes.length === 0
        ? t('ai.normalSummon', { card: label(cardInstanceId), zone: zoneIndex })
        : t('ai.tributeSummon', {
            card: label(cardInstanceId),
            zone: zoneIndex,
            tributes: tributes.map(label).join(', '),
          });
    }
    case 'SetMonster':
      return t('ai.setMonster', {
        card: label(action.payload.cardInstanceId),
        zone: action.payload.zoneIndex,
      });
    case 'ChangePosition':
      return t('ai.changePosition', {
        card: label(action.payload.cardInstanceId),
        to: action.payload.toPosition,
      });
    case 'DeclareAttack': {
      const { attackerInstanceId, targetInstanceId } = action.payload;
      return targetInstanceId == null
        ? t('ai.attackDirect', { attacker: label(attackerInstanceId) })
        : t('ai.attackTarget', {
            target: label(targetInstanceId),
            attacker: label(attackerInstanceId),
          });
    }
    case 'ResolvePendingPrompt':
      return t('ai.discard', { cards: action.payload.cardInstanceIds.map(label).join(', ') });
    case 'Surrender':
      return t('ai.surrender');
    case 'SetSpellTrap':
      return t('ai.setSpellTrap', {
        card: label(action.payload.cardInstanceId),
        zone: action.payload.zoneIndex,
      });
    case 'ActivateEffect':
      return t('ai.activateEffect', { card: label(action.payload.cardInstanceId) });
    default: {
      const unhandled: never = action;
      return t('ai.unknown', { json: JSON.stringify(unhandled) });
    }
  }
}
