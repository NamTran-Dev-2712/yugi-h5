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
  ChainLinkAdded: {
    event: {
      type: 'ChainLinkAdded',
      linkId: 'link-3-9',
      chainIndex: 2,
      playerIndex: 1,
      instanceId: 'p1-8',
      definitionId: 'SMP-201',
      effectId: 'e1',
      spellSpeed: 2,
      targetInstanceIds: [],
    },
    text: 'P1 đưa Name(SMP-201) vào chuỗi (mắt xích 2)',
  },
  ChainLinkFizzled: {
    event: {
      type: 'ChainLinkFizzled',
      linkId: 'link-3-9',
      playerIndex: 0,
      instanceId: 'p0-7',
      definitionId: 'SMP-101',
      effectId: 'e1',
      reason: 'TARGET_GONE',
    },
    text: 'Name(SMP-101) của P0 không có tác dụng (mục tiêu đã rời đi)',
  },
  ChainResolved: {
    event: { type: 'ChainResolved', linkCount: 2 },
    text: 'Chuỗi 2 mắt xích đã xử lý xong',
  },
  MonsterSpecialSummoned: {
    event: {
      type: 'MonsterSpecialSummoned',
      playerIndex: 0,
      instanceId: 'p0-9',
      definitionId: 'SMP-003',
      zoneIndex: 1,
      from: 'Graveyard',
      position: 'Attack',
    },
    text: 'P0 Triệu hồi Đặc biệt Name(SMP-003) từ mộ vào ô 1',
  },
  FlipSummoned: {
    event: {
      type: 'FlipSummoned',
      playerIndex: 1,
      instanceId: 'p1-4',
      definitionId: 'SMP-044',
      zoneIndex: 2,
    },
    text: 'P1 Triệu hồi Lật Name(SMP-044) ở ô 2',
  },
  CardEquipped: {
    event: {
      type: 'CardEquipped',
      playerIndex: 0,
      instanceId: 'p0-20',
      definitionId: 'SMP-112',
      targetInstanceId: 'p0-2',
    },
    text: 'P0 trang bị Name(SMP-112) cho <p0-2>',
  },
  FieldSpellSet: {
    event: { type: 'FieldSpellSet', playerIndex: 1, instanceId: 'p1-30' },
    text: 'P1 úp 1 lá vào ô Môi trường',
  },
  FieldSpellDestroyed: {
    event: {
      type: 'FieldSpellDestroyed',
      ownerIndex: 1,
      instanceId: 'p1-30',
      definitionId: 'SMP-113',
    },
    text: 'P1 mất lá Môi trường Name(SMP-113) do bị phá hủy',
  },
  ChainLinkNegated: {
    event: {
      type: 'ChainLinkNegated',
      linkId: 'link-3-9',
      playerIndex: 1,
      instanceId: 'p1-7',
      definitionId: 'SMP-114',
      effectId: 'activate',
      byInstanceId: 'p0-30',
    },
    text: 'Name(SMP-114) của P1 bị vô hiệu: không có tác dụng, vào mộ',
  },
  AttackNegated: {
    event: {
      type: 'AttackNegated',
      playerIndex: 1,
      attackerInstanceId: 'p1-2',
      targetInstanceId: 'p0-4',
    },
    text: 'Đòn tấn công của P1 (<p1-2> vào <p0-4>) bị vô hiệu',
  },
  SummonNegated: {
    event: {
      type: 'SummonNegated',
      playerIndex: 1,
      instanceId: 'p1-5',
      definitionId: 'SMP-009',
      zoneIndex: 2,
    },
    text: 'Triệu hồi Name(SMP-009) của P1 bị vô hiệu: quái vào mộ (ô 2)',
  },
  FusionMaterialSent: {
    event: {
      type: 'FusionMaterialSent',
      ownerIndex: 0,
      instanceId: 'p0-4',
      definitionId: 'SMP-001',
      from: 'Hand',
    },
    text: 'P0 dùng Name(SMP-001) trên tay làm nguyên liệu dung hợp (vào mộ)',
  },
  MonsterFusionSummoned: {
    event: {
      type: 'MonsterFusionSummoned',
      playerIndex: 0,
      instanceId: 'p0-x0',
      definitionId: 'SMP-045',
      zoneIndex: 1,
      position: 'Attack',
      materialInstanceIds: ['p0-4', 'p0-9'],
    },
    text: 'P0 Triệu hồi Dung hợp Name(SMP-045) vào ô 1',
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

  it('a negated DIRECT attack has its own sentence and names no target (task 4.4b)', () => {
    const text = describeEvent(
      { type: 'AttackNegated', playerIndex: 0, attackerInstanceId: 'p0-2', targetInstanceId: null },
      ctx,
    );
    expect(text).toBe('Đòn tấn công trực tiếp của P0 (<p0-2>) bị vô hiệu');
  });

  it('every Negate sentence says "vô hiệu" (the log line the review asks for) (task 4.4b)', () => {
    for (const type of ['ChainLinkNegated', 'AttackNegated', 'SummonNegated'] as const) {
      expect(describeEvent(EXAMPLES[type].event, ctx), type).toContain('vô hiệu');
    }
  });

  it('a fusion material says where it came from, as the server sent it: hand / field (+ zone) / Deck (task 4.5b)', () => {
    const sent = (from: 'Hand' | 'MonsterZone' | 'Deck', zoneIndex?: number): EventView => ({
      type: 'FusionMaterialSent',
      ownerIndex: 1,
      instanceId: 'p1-7',
      definitionId: 'SMP-007',
      from,
      ...(zoneIndex !== undefined ? { zoneIndex } : {}),
    });
    expect(describeEvent(sent('Hand'), ctx)).toBe(
      'P1 dùng Name(SMP-007) trên tay làm nguyên liệu dung hợp (vào mộ)',
    );
    expect(describeEvent(sent('MonsterZone', 3), ctx)).toBe(
      'P1 dùng Name(SMP-007) trên sân (ô 3) làm nguyên liệu dung hợp (vào mộ)',
    );
    expect(describeEvent(sent('Deck'), ctx)).toBe(
      'P1 dùng Name(SMP-007) từ Bộ bài làm nguyên liệu dung hợp (vào mộ)',
    );
  });

  it('a Field Spell replaced by a new one has its own sentence; other graveyard moves keep theirs (task 4.3b)', () => {
    const sent = (from: 'Hand' | 'SpellTrapZone' | 'FieldZone'): EventView => ({
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'p0-30',
      definitionId: 'SMP-113',
      from,
    });
    expect(describeEvent(sent('FieldZone'), ctx)).toBe(
      'Lá Môi trường Name(SMP-113) của P0 bị thay, vào mộ',
    );
    expect(describeEvent(sent('Hand'), ctx)).toBe('Name(SMP-113) của P0 vào mộ');
    expect(describeEvent(sent('SpellTrapZone'), ctx)).toBe('Name(SMP-113) của P0 vào mộ');
  });

  it('the Field Spell Set line never names the card (the event has no definitionId)', () => {
    const text = describeEvent({ type: 'FieldSpellSet', playerIndex: 0, instanceId: 'p0-30' }, ctx);
    expect(text).not.toContain('Name(');
    expect(text).not.toContain('p0-30');
  });

  it('Special Summon from the hand says so', () => {
    expect(
      describeEvent(
        {
          type: 'MonsterSpecialSummoned',
          playerIndex: 1,
          instanceId: 'p1-2',
          definitionId: 'SMP-001',
          zoneIndex: 0,
          from: 'Hand',
          position: 'DefenseUp',
        },
        ctx,
      ),
    ).toBe('P1 Triệu hồi Đặc biệt Name(SMP-001) từ tay vào ô 0');
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
