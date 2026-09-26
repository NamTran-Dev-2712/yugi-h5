import type { EventView } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { describeEvent, type DescribeContext } from './describe-event';

const ctx: DescribeContext = {
  cardName: (id) => `Name(${id})`,
  instanceLabel: (id) => `<${id}>`,
};

/** One example per event type; `Record` makes the compiler demand a new entry when an event type is added. */
const EXAMPLES: Record<EventView['type'], { event: EventView; text: string }> = {
  DuelStarted: {
    event: { type: 'DuelStarted', matchId: 'm', turnPlayerIndex: 0 },
    text: 'Trận bắt đầu, P0 đi trước',
  },
  CardDrawn: {
    event: {
      type: 'CardDrawn',
      playerIndex: 0,
      card: {
        hidden: false,
        instanceId: 'p0-1',
        definitionId: 'SMP-001',
        position: null,
        ownerIndex: 0,
      },
    },
    text: 'P0 rút 1 lá: Name(SMP-001)',
  },
  DeckOut: { event: { type: 'DeckOut', playerIndex: 1 }, text: 'P1 hết bài để rút' },
  CardDiscarded: {
    event: { type: 'CardDiscarded', playerIndex: 0, instanceId: 'p0-2', definitionId: 'SMP-002' },
    text: 'P0 bỏ Name(SMP-002) xuống mộ',
  },
  PhaseChanged: {
    event: { type: 'PhaseChanged', from: 'Main1', to: 'Battle', turnPlayerIndex: 0 },
    text: 'Phase Main1 → Battle (lượt của P0)',
  },
  TurnChanged: {
    event: { type: 'TurnChanged', turnCount: 2, turnPlayerIndex: 1 },
    text: 'Lượt 2: P1',
  },
  NormalSummoned: {
    event: {
      type: 'NormalSummoned',
      playerIndex: 0,
      instanceId: 'p0-3',
      definitionId: 'SMP-003',
      zoneIndex: 2,
    },
    text: 'P0 Triệu hồi Name(SMP-003) ở ô 2',
  },
  MonsterSet: {
    event: { type: 'MonsterSet', playerIndex: 1, instanceId: 'p1-3', zoneIndex: 0 },
    text: 'P1 úp 1 quái ở ô 0',
  },
  MonsterTributed: {
    event: {
      type: 'MonsterTributed',
      ownerIndex: 0,
      instanceId: 'p0-3',
      definitionId: 'SMP-003',
      zoneIndex: 1,
    },
    text: 'P0 hiến tế Name(SMP-003) (ô 1)',
  },
  PositionChanged: {
    event: {
      type: 'PositionChanged',
      playerIndex: 0,
      instanceId: 'p0-3',
      definitionId: 'SMP-003',
      zoneIndex: 1,
      from: 'Attack',
      to: 'DefenseUp',
    },
    text: 'P0 đổi thế Name(SMP-003): Attack → DefenseUp',
  },
  MonsterFlipped: {
    event: {
      type: 'MonsterFlipped',
      ownerIndex: 1,
      instanceId: 'p1-3',
      definitionId: 'SMP-004',
      zoneIndex: 0,
    },
    text: 'P1 lật Name(SMP-004) (ô 0)',
  },
  AttackDeclared: {
    event: {
      type: 'AttackDeclared',
      playerIndex: 0,
      attackerInstanceId: 'p0-3',
      targetInstanceId: 'p1-3',
    },
    text: 'P0 tấn công <p1-3> bằng <p0-3>',
  },
  MonsterDestroyed: {
    event: {
      type: 'MonsterDestroyed',
      ownerIndex: 1,
      instanceId: 'p1-3',
      definitionId: 'SMP-004',
      zoneIndex: 0,
    },
    text: 'P1 mất quái Name(SMP-004) (ô 0) do bị phá hủy',
  },
  DamageDealt: {
    event: { type: 'DamageDealt', playerIndex: 1, amount: 700 },
    text: 'P1 mất 700 LP',
  },
  DuelEnded: {
    event: { type: 'DuelEnded', winnerIndex: 0, reason: 'SURRENDER' },
    text: 'Trận kết thúc: P0 thắng (SURRENDER)',
  },
  SpellTrapSet: {
    event: { type: 'SpellTrapSet', playerIndex: 1, instanceId: 'p1-8', zoneIndex: 2 },
    text: 'P1 úp 1 lá Phép/Bẫy ở ô 2',
  },
  EffectActivated: {
    event: {
      type: 'EffectActivated',
      playerIndex: 0,
      instanceId: 'p0-7',
      definitionId: 'SMP-101',
      effectId: 'draw-one',
    },
    text: 'P0 kích hoạt Name(SMP-101)',
  },
  EffectResolved: {
    event: {
      type: 'EffectResolved',
      playerIndex: 0,
      instanceId: 'p0-7',
      definitionId: 'SMP-101',
      effectId: 'draw-one',
    },
    text: 'Hiệu ứng Name(SMP-101) của P0 đã xử lý xong',
  },
  CardSentToGraveyard: {
    event: {
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'p0-7',
      definitionId: 'SMP-101',
      from: 'Hand',
    },
    text: 'Name(SMP-101) của P0 vào mộ',
  },
  LifePointsRecovered: {
    event: { type: 'LifePointsRecovered', playerIndex: 0, amount: 500 },
    text: 'P0 hồi 500 LP',
  },
  LifePointsPaid: {
    event: { type: 'LifePointsPaid', playerIndex: 1, amount: 300 },
    text: 'P1 trả 300 LP',
  },
  SpellTrapDestroyed: {
    event: {
      type: 'SpellTrapDestroyed',
      ownerIndex: 1,
      instanceId: 'p1-8',
      definitionId: 'SMP-201',
      zoneIndex: 2,
    },
    text: 'P1 mất lá Phép/Bẫy Name(SMP-201) (ô 2) do bị phá hủy',
  },
};

describe('describeEvent', () => {
  it.each(Object.entries(EXAMPLES))('describes %s', (_type, { event, text }) => {
    expect(describeEvent(event, ctx)).toBe(text);
  });

  it('says the opponent drew a hidden card without naming it', () => {
    const text = describeEvent(
      {
        type: 'CardDrawn',
        playerIndex: 1,
        card: { hidden: true, instanceId: 'p1-1', ownerIndex: 1 },
      },
      ctx,
    );
    expect(text).toBe('P1 rút 1 lá (ẩn)');
    expect(text).not.toContain('Name(');
  });

  it('describes a direct attack (target null)', () => {
    expect(
      describeEvent(
        {
          type: 'AttackDeclared',
          playerIndex: 1,
          attackerInstanceId: 'p1-2',
          targetInstanceId: null,
        },
        ctx,
      ),
    ).toBe('P1 tấn công trực tiếp bằng <p1-2>');
  });

  it('describes a draw (both LP zero) duel end', () => {
    expect(describeEvent({ type: 'DuelEnded', winnerIndex: null, reason: 'LP_ZERO' }, ctx)).toBe(
      'Trận kết thúc: hòa (LP_ZERO)',
    );
  });
});
