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
export function describeAiAction(
  action: PlayerAction,
  ctx: DescribeAiContext,
  /**
   * Task 4.3b: `AiActionView.promptKind` — the kind of the prompt a `ResolvePendingPrompt` answered, as the server sent
   * it. The sentence is chosen from it, never guessed from the ids or the prompt id text.
   */
  promptKind?: string,
): string {
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
    case 'ResolvePendingPrompt': {
      // `decline` only answers a TriggerActivation prompt (engine rule), so it needs no kind.
      if (action.payload.decline === true) return t('ai.declineTrigger');
      // The server may have removed ids still hidden from the viewer (the AI's hand): then no card is named.
      const ids = action.payload.cardInstanceIds;
      const cards = ids.map(label).join(', ');
      switch (promptKind) {
        case 'DiscardToHandLimit':
          return t('ai.discard', { cards });
        case 'SelectEffectTarget':
          return ids.length === 0 ? t('ai.chooseTargetHidden') : t('ai.chooseTarget', { cards });
        case 'TriggerActivation':
          return ids.length === 0 ? t('ai.acceptTrigger') : t('ai.acceptTriggerTargets', { cards });
        // Task 4.5b: the Fusion Monster is in the AI's Extra Deck and materials may be in its hand — the server removes
        // those ids, so neither sentence names a card (a partial list would mislead).
        case 'SelectFusionMonster':
          return t('ai.chooseFusionMonster');
        case 'SelectFusionMaterials':
          return t('ai.chooseFusionMaterials');
        default:
          // An unknown / missing kind (an older server, a future prompt): a neutral sentence, no guess.
          return ids.length === 0 ? t('ai.answerPromptNone') : t('ai.answerPrompt', { cards });
      }
    }
    case 'Surrender':
      return t('ai.surrender');
    case 'SetSpellTrap':
      return t('ai.setSpellTrap', {
        card: label(action.payload.cardInstanceId),
        zone: action.payload.zoneIndex,
      });
    case 'ActivateEffect':
      return t('ai.activateEffect', { card: label(action.payload.cardInstanceId) });
    case 'PassPriority':
      return t('ai.passPriority');
    case 'FlipSummon':
      return t('ai.flipSummon', { card: label(action.payload.cardInstanceId) });
    default: {
      const unhandled: never = action;
      return t('ai.unknown', { json: JSON.stringify(unhandled) });
    }
  }
}
