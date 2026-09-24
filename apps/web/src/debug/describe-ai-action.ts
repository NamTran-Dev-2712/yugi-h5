import type { PlayerAction } from '@yugi/shared';

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
      return '🤖 AI kết thúc phase';
    case 'NormalSummon': {
      const { cardInstanceId, zoneIndex, tributeInstanceIds } = action.payload;
      const tributes = tributeInstanceIds ?? [];
      return tributes.length === 0
        ? `🤖 AI Normal Summon ${label(cardInstanceId)} ở ô ${zoneIndex}`
        : `🤖 AI Tribute Summon ${label(cardInstanceId)} ở ô ${zoneIndex}, hiến tế ${tributes.map(label).join(', ')}`;
    }
    case 'SetMonster':
      return `🤖 AI úp ${label(action.payload.cardInstanceId)} ở ô ${action.payload.zoneIndex}`;
    case 'ChangePosition':
      return `🤖 AI đổi thế ${label(action.payload.cardInstanceId)} sang ${action.payload.toPosition}`;
    case 'DeclareAttack': {
      const { attackerInstanceId, targetInstanceId } = action.payload;
      return targetInstanceId == null
        ? `🤖 AI tấn công trực tiếp bằng ${label(attackerInstanceId)}`
        : `🤖 AI tấn công ${label(targetInstanceId)} bằng ${label(attackerInstanceId)}`;
    }
    case 'ResolvePendingPrompt':
      return `🤖 AI bỏ ${action.payload.cardInstanceIds.map(label).join(', ')} xuống mộ`;
    case 'Surrender':
      return '🤖 AI đầu hàng';
    default: {
      const unhandled: never = action;
      return `AI hành động không rõ: ${JSON.stringify(unhandled)}`;
    }
  }
}
