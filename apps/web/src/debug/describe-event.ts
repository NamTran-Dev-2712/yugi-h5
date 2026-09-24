import type { EventView } from '@yugi/shared';

export interface DescribeContext {
  /** Display name of a card definition. */
  cardName(definitionId: string): string;
  /** Readable label for a card instance (events only carry instance ids for attacks). */
  instanceLabel(instanceId: string): string;
}

/** One readable line per event. Exhaustive on purpose: a new EventView type is a compile error until it is worded. */
export function describeEvent(event: EventView, ctx: DescribeContext): string {
  switch (event.type) {
    case 'DuelStarted':
      return `Trận bắt đầu, P${event.turnPlayerIndex} đi trước`;
    case 'CardDrawn':
      return event.card.hidden
        ? `P${event.playerIndex} rút 1 lá (ẩn)`
        : `P${event.playerIndex} rút 1 lá: ${ctx.cardName(event.card.definitionId)}`;
    case 'DeckOut':
      return `P${event.playerIndex} hết bài để rút`;
    case 'CardDiscarded':
      return `P${event.playerIndex} bỏ ${ctx.cardName(event.definitionId)} xuống mộ`;
    case 'PhaseChanged':
      return `Phase ${event.from} → ${event.to} (lượt của P${event.turnPlayerIndex})`;
    case 'TurnChanged':
      return `Lượt ${event.turnCount}: P${event.turnPlayerIndex}`;
    case 'NormalSummoned':
      return `P${event.playerIndex} Triệu hồi ${ctx.cardName(event.definitionId)} ở ô ${event.zoneIndex}`;
    case 'MonsterSet':
      return `P${event.playerIndex} úp 1 quái ở ô ${event.zoneIndex}`;
    case 'MonsterTributed':
      return `P${event.ownerIndex} hiến tế ${ctx.cardName(event.definitionId)} (ô ${event.zoneIndex})`;
    case 'PositionChanged':
      return `P${event.playerIndex} đổi thế ${ctx.cardName(event.definitionId)}: ${event.from} → ${event.to}`;
    case 'MonsterFlipped':
      return `P${event.ownerIndex} lật ${ctx.cardName(event.definitionId)} (ô ${event.zoneIndex})`;
    case 'AttackDeclared':
      return event.targetInstanceId === null
        ? `P${event.playerIndex} tấn công trực tiếp bằng ${ctx.instanceLabel(event.attackerInstanceId)}`
        : `P${event.playerIndex} tấn công ${ctx.instanceLabel(event.targetInstanceId)} bằng ${ctx.instanceLabel(event.attackerInstanceId)}`;
    case 'MonsterDestroyed':
      return `P${event.ownerIndex} mất quái ${ctx.cardName(event.definitionId)} (ô ${event.zoneIndex}) do bị phá hủy`;
    case 'DamageDealt':
      return `P${event.playerIndex} mất ${event.amount} LP`;
    case 'DuelEnded':
      return event.winnerIndex === null
        ? `Trận kết thúc: hòa (${event.reason})`
        : `Trận kết thúc: P${event.winnerIndex} thắng (${event.reason})`;
    default: {
      const unhandled: never = event;
      return `Event không rõ: ${JSON.stringify(unhandled)}`;
    }
  }
}
