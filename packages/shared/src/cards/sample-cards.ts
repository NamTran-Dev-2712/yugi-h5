import type { Attribute, CardDefinition } from './card-definition.js';

/**
 * Placeholder card pool — original names/stats only, no Konami IP.
 * Used for engine tests and early FE rendering until the real M2 card set lands.
 */
export const SAMPLE_CARDS: CardDefinition[] = [
  {
    id: 'SMP-001',
    kind: 'Monster',
    name: { vi: 'Thị Vệ Lang Thang', en: 'Wandering Squire' },
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level: 3,
    atk: 1200,
    def: 800,
  },
  {
    id: 'SMP-002',
    kind: 'Monster',
    name: { vi: 'Hộ Vệ Thành Sắt', en: 'Iron Bulwark Guardian' },
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Rock',
    level: 6,
    atk: 1800,
    def: 2400,
  },
  {
    id: 'SMP-003',
    kind: 'Monster',
    name: { vi: 'Rồng Tro Tàn', en: 'Ashfall Wyrm' },
    category: 'Normal',
    attribute: 'FIRE',
    race: 'Dragon',
    level: 8,
    atk: 2700,
    def: 2000,
  },
  ...(
    [
      ['SMP-004', 'Tinh Linh Đèn Lồng', 'Lantern Sprite', 'LIGHT', 'Fairy', 2, 700, 600],
      ['SMP-005', 'Rùa Lưng Rêu', 'Mossback Tortoise', 'EARTH', 'Beast', 3, 900, 1400],
      ['SMP-006', 'Pháp Sư Triều Dâng', 'Tidecaller Adept', 'WATER', 'Spellcaster', 4, 1500, 1100],
      ['SMP-007', 'Chó Săn Tàn Lửa', 'Cinder Hound', 'FIRE', 'Beast', 3, 1300, 700],
      ['SMP-008', 'Kiếm Sĩ Gió Lốc', 'Gale Skirmisher', 'WIND', 'Warrior', 4, 1600, 900],
      ['SMP-009', 'Kẻ Cướp Rỗng', 'Hollow Marauder', 'DARK', 'Fiend', 4, 1700, 1000],
      ['SMP-010', 'Giáo Sĩ Rạng Đông', 'Dawnbreak Cleric', 'LIGHT', 'Spellcaster', 3, 1000, 1200],
      ['SMP-011', 'Sói Nanh Rỉ', 'Rustfang Wolf', 'EARTH', 'Beast', 2, 800, 500],
      ['SMP-012', 'Rắn Biển Mặn', 'Brine Serpent', 'WATER', 'Sea Serpent', 4, 1400, 1300],
      ['SMP-013', 'Tu Sĩ Than Hồng', 'Ember Acolyte', 'FIRE', 'Pyro', 1, 500, 400],
      ['SMP-014', 'Trinh Sát Cánh Bão', 'Stormwing Scout', 'WIND', 'Winged Beast', 3, 1100, 800],
      ['SMP-015', 'Người Đá Sỏi', 'Gravel Golem', 'EARTH', 'Rock', 5, 1900, 1700],
      ['SMP-016', 'Sát Thủ Màn Đêm', 'Duskveil Stalker', 'DARK', 'Fiend', 5, 2000, 1200],
      ['SMP-017', 'Tiên Phong Mặt Trời', 'Solar Vanguard', 'LIGHT', 'Warrior', 4, 1800, 1300],
      ['SMP-018', 'Hải Long Vực Thẳm', 'Abyssal Leviathan', 'WATER', 'Sea Serpent', 7, 2500, 2100],
    ] as const
  ).map(([id, vi, en, attribute, race, level, atk, def]): CardDefinition => ({
    id,
    kind: 'Monster',
    name: { vi, en },
    category: 'Normal',
    attribute: attribute as Attribute,
    race,
    level,
    atk,
    def,
  })),
  // Task 3.8 — first real effect cards (Tier B, effect DSL only). Placeholder names, no Konami IP.
  {
    id: 'SMP-019',
    kind: 'Monster',
    name: { vi: 'Ong Bắp Cày Lửa', en: 'Firebrand Hornet' },
    category: 'Effect',
    attribute: 'FIRE',
    race: 'Insect',
    level: 4,
    atk: 1400,
    def: 900,
    effectText: {
      vi: 'Khi lá này được Triệu hồi Thường: gây 300 sát thương cho đối thủ (bắt buộc).',
      en: 'When this card is Normal Summoned: inflict 300 damage to your opponent (mandatory).',
    },
    effects: [
      {
        id: 'burn-on-summon',
        trigger: { kind: 'OnSummon', mandatory: true },
        operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
      },
    ],
  },
  {
    id: 'SMP-020',
    kind: 'Monster',
    name: { vi: 'Thợ Săn Rừng Bẫy', en: 'Snarewood Tracker' },
    category: 'Effect',
    attribute: 'EARTH',
    race: 'Warrior',
    level: 3,
    atk: 1000,
    def: 800,
    effectText: {
      vi: 'Khi lá này được Triệu hồi Thường: bạn có thể chọn 1 lá Phép/Bẫy đối thủ điều khiển; phá huỷ nó.',
      en: 'When this card is Normal Summoned: you can target 1 Spell/Trap your opponent controls; destroy it.',
    },
    effects: [
      {
        id: 'break-backrow',
        trigger: { kind: 'OnSummon' },
        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  {
    id: 'SMP-021',
    kind: 'Monster',
    name: { vi: 'Bướm Đêm Tro', en: 'Ashen Moth' },
    category: 'Effect',
    attribute: 'DARK',
    race: 'Insect',
    level: 3,
    atk: 900,
    def: 600,
    effectText: {
      vi: 'Khi lá này bị phá huỷ và đưa vào Mộ: chủ của nó rút 1 lá (bắt buộc).',
      en: 'When this card is destroyed and sent to the Graveyard: its owner draws 1 card (mandatory).',
    },
    effects: [
      {
        id: 'draw-on-destroyed',
        trigger: { kind: 'OnDestroyed', mandatory: true },
        operations: [{ kind: 'Draw', count: 1, target: 'self' }],
      },
    ],
  },
  {
    id: 'SMP-022',
    kind: 'Monster',
    name: { vi: 'Chỉ Huy Cờ Hiệu', en: 'Banner Captain' },
    category: 'Effect',
    attribute: 'LIGHT',
    race: 'Warrior',
    level: 4,
    atk: 1500,
    def: 1000,
    effectText: {
      vi: 'Khi lá này ngửa trên sân: các quái thú ngửa khác bạn điều khiển tăng 300 ATK.',
      en: 'While this card is face-up on the field: other face-up monsters you control gain 300 ATK.',
    },
    effects: [
      {
        id: 'rally-atk',
        trigger: { kind: 'Continuous' },
        operations: [
          { kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self', excludeSource: true },
        ],
      },
    ],
  },
  {
    id: 'SMP-023',
    kind: 'Monster',
    name: { vi: 'Hồn Ma Đầm Lầy', en: 'Bog Wraith' },
    category: 'Effect',
    attribute: 'DARK',
    race: 'Zombie',
    level: 4,
    atk: 1300,
    def: 1200,
    effectText: {
      vi: 'Khi lá này ngửa trên sân: quái thú ngửa đối thủ điều khiển giảm 300 ATK.',
      en: 'While this card is face-up on the field: face-up monsters your opponent controls lose 300 ATK.',
    },
    effects: [
      {
        id: 'sap-atk',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'atk', amount: -300, side: 'opponent' }],
      },
    ],
  },
  {
    id: 'SMP-101',
    kind: 'Spell',
    name: { vi: 'Tiếp Viện Bất Ngờ', en: 'Sudden Reinforcement' },
    subType: 'Normal',
    effectText: {
      vi: 'Rút 1 lá bài.',
      en: 'Draw 1 card.',
    },
    effects: [
      {
        id: 'draw-one',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'Draw', count: 1, target: 'self' }],
      },
    ],
  },
  {
    id: 'SMP-102',
    kind: 'Spell',
    name: { vi: 'Mũi Tên Chớp Nhoáng', en: 'Flash Arrow' },
    subType: 'QuickPlay',
    effectText: {
      vi: 'Gây 500 sát thương cho đối thủ.',
      en: 'Inflict 500 damage to your opponent.',
    },
    effects: [
      {
        id: 'flash-burn',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Damage', amount: 500, target: 'opponent' }],
      },
    ],
  },
  {
    id: 'SMP-103',
    kind: 'Spell',
    name: { vi: 'Mạch Nước Ấm', en: 'Warm Spring' },
    subType: 'Normal',
    effectText: {
      vi: 'Hồi 1000 LP.',
      en: 'Gain 1000 LP.',
    },
    effects: [
      {
        id: 'heal',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'Heal', amount: 1000, target: 'self' }],
      },
    ],
  },
  {
    id: 'SMP-104',
    kind: 'Spell',
    name: { vi: 'Kho Báu Chiến Trường', en: 'Battlefield Cache' },
    subType: 'Normal',
    effectText: {
      vi: 'Chi phí: bỏ 1 lá bài trên tay. Rút 2 lá.',
      en: 'Cost: discard 1 card. Draw 2 cards.',
    },
    effects: [
      {
        id: 'dig',
        trigger: { kind: 'Ignition' },
        cost: [{ kind: 'Discard', count: 1 }],
        operations: [{ kind: 'Draw', count: 2, target: 'self' }],
      },
    ],
  },
  {
    id: 'SMP-201',
    kind: 'Trap',
    name: { vi: 'Rào Chắn Hộ Vệ', en: 'Guardian Barrier' },
    subType: 'Normal',
    effectText: {
      vi: 'Placeholder: hiệu ứng vô hiệu hoá tấn công, sẽ định nghĩa bằng effect DSL.',
      en: 'Placeholder: negate-attack effect defined via effect DSL.',
    },
  },
  {
    id: 'SMP-202',
    kind: 'Trap',
    name: { vi: 'Hố Sụt Bất Ngờ', en: 'Sudden Sinkhole' },
    subType: 'Normal',
    effectText: {
      vi: 'Chọn 1 quái thú đối thủ điều khiển; phá huỷ nó.',
      en: 'Target 1 monster your opponent controls; destroy it.',
    },
    effects: [
      {
        id: 'sinkhole',
        trigger: { kind: 'Quick' },
        target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  {
    id: 'SMP-203',
    kind: 'Trap',
    name: { vi: 'Tia Lửa Phản Công', en: 'Counterspark' },
    subType: 'Normal',
    effectText: {
      vi: 'Gây 800 sát thương cho đối thủ.',
      en: 'Inflict 800 damage to your opponent.',
    },
    effects: [
      {
        id: 'counterspark',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Damage', amount: 800, target: 'opponent' }],
      },
    ],
  },
];
