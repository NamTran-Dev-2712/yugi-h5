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
  // Task 4.1 — card batch 1: 20 vanilla monsters (Tier A), Level 1–8, all 6 attributes. Placeholder names, no Konami IP.
  ...(
    [
      ['SMP-024', 'Bọ Giáp Đồng', 'Bronze Shell Beetle', 'EARTH', 'Insect', 1, 300, 1100],
      ['SMP-025', 'Linh Hồn Giọt Sương', 'Dewdrop Wisp', 'WATER', 'Aqua', 1, 400, 300],
      ['SMP-026', 'Bánh Răng Lăn', 'Rolling Cogling', 'EARTH', 'Machine', 2, 900, 700],
      ['SMP-027', 'Tia Chớp Con', 'Sparkling Imp', 'LIGHT', 'Thunder', 2, 1000, 400],
      ['SMP-028', 'Dây Leo Gai', 'Thornvine Creeper', 'EARTH', 'Plant', 3, 1200, 1000],
      ['SMP-029', 'Kỳ Nhông Hang Tối', 'Cavern Newt', 'DARK', 'Reptile', 3, 1100, 900],
      ['SMP-030', 'Chim Ưng Mây Bạc', 'Silvercloud Falcon', 'WIND', 'Winged Beast', 4, 1700, 1000],
      ['SMP-031', 'Hiệp Sĩ Nanh Hổ', 'Tigerfang Knight', 'FIRE', 'Beast-Warrior', 4, 1800, 1200],
      ['SMP-032', 'Thầy Bói Sương Mù', 'Mistveil Seer', 'WATER', 'Psychic', 4, 1400, 1600],
      ['SMP-033', 'Khủng Long Mào Đỏ', 'Crimsoncrest Raptor', 'FIRE', 'Dinosaur', 4, 1900, 600],
      ['SMP-034', 'Người Máy Canh Gác', 'Sentinel Automaton', 'LIGHT', 'Machine', 5, 1900, 2100],
      [
        'SMP-035',
        'Pháp Sư Bóng Nguyệt',
        'Moonshade Sorcerer',
        'DARK',
        'Spellcaster',
        5,
        2100,
        1500,
      ],
      ['SMP-036', 'Đại Bàng Bão Tố', 'Tempest Roc', 'WIND', 'Winged Beast', 6, 2300, 1400],
      ['SMP-037', 'Cá Mập Vảy Thép', 'Steelscale Shark', 'WATER', 'Fish', 6, 2200, 1800],
      ['SMP-038', 'Quỷ Lửa Dung Nham', 'Magma Fiend', 'FIRE', 'Fiend', 7, 2500, 1900],
      ['SMP-039', 'Thiên Sứ Hừng Đông', 'Daybreak Seraph', 'LIGHT', 'Fairy', 7, 2400, 2300],
      ['SMP-040', 'Rồng Gió Bạc', 'Silverwind Drake', 'WIND', 'Dragon', 8, 2800, 2200],
      ['SMP-041', 'Thạch Long Cổ Đại', 'Ancient Stone Titan', 'EARTH', 'Rock', 8, 2600, 2800],
      ['SMP-042', 'Xác Sống Thủ Lĩnh', 'Grave Warlord', 'DARK', 'Zombie', 2, 800, 1000],
      ['SMP-043', 'Rùa Nham Thạch', 'Basalt Tortoise', 'FIRE', 'Reptile', 3, 600, 1800],
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
  // Task 4.2d — first real card with an OnFlip trigger (Tier B).
  {
    id: 'SMP-044',
    kind: 'Monster',
    name: { vi: 'Cú Đêm Phục Kích', en: 'Ambush Night Owl' },
    category: 'Effect',
    attribute: 'WIND',
    race: 'Winged Beast',
    level: 3,
    atk: 700,
    def: 1400,
    effectText: {
      vi: 'LẬT: Bạn có thể chọn 1 quái thú đối thủ điều khiển; phá huỷ nó.',
      en: 'FLIP: You can target 1 monster your opponent controls; destroy it.',
    },
    effects: [
      {
        id: 'flip-ambush',
        trigger: { kind: 'OnFlip' },
        target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
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
  // Task 4.1 — card batch 1: basic Spells (Tier B, existing effect DSL only).
  {
    id: 'SMP-105',
    kind: 'Spell',
    name: { vi: 'Gió Quét Mái Vòm', en: 'Canopy Gale' },
    subType: 'Normal',
    effectText: {
      vi: 'Chọn 1 lá Phép/Bẫy đối thủ điều khiển; phá huỷ nó.',
      en: 'Target 1 Spell/Trap your opponent controls; destroy it.',
    },
    effects: [
      {
        id: 'gale-sweep',
        trigger: { kind: 'Ignition' },
        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  {
    id: 'SMP-106',
    kind: 'Spell',
    name: { vi: 'Cái Giá Của Lưỡi Kiếm', en: 'Toll of the Blade' },
    subType: 'Normal',
    effectText: {
      vi: 'Chi phí: trả 1000 LP. Chọn 1 quái thú đối thủ điều khiển; phá huỷ nó.',
      en: 'Cost: pay 1000 LP. Target 1 monster your opponent controls; destroy it.',
    },
    effects: [
      {
        id: 'toll-strike',
        trigger: { kind: 'Ignition' },
        cost: [{ kind: 'PayLP', amount: 1000 }],
        target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  {
    id: 'SMP-107',
    kind: 'Spell',
    name: { vi: 'Hiệu Triệu Cứu Viện', en: 'Desperate Muster' },
    subType: 'Normal',
    effectText: {
      vi: 'Chỉ khi bạn không điều khiển quái thú nào và đối thủ điều khiển ít nhất 1 quái thú: rút 2 lá.',
      en: 'Only while you control no monsters and your opponent controls at least 1 monster: draw 2 cards.',
    },
    effects: [
      {
        id: 'muster-draw',
        trigger: { kind: 'Ignition' },
        condition: [
          { kind: 'ZoneCount', zone: 'MonsterZone', side: 'self', max: 0 },
          { kind: 'ZoneCount', zone: 'MonsterZone', side: 'opponent', min: 1 },
        ],
        operations: [{ kind: 'Draw', count: 2, target: 'self' }],
      },
    ],
  },
  {
    id: 'SMP-108',
    kind: 'Spell',
    name: { vi: 'Hạ Gục Khổng Lồ', en: 'Giantfall' },
    subType: 'Normal',
    effectText: {
      vi: 'Chọn 1 quái thú ngửa Cấp 5 trở lên đối thủ điều khiển; phá huỷ nó.',
      en: 'Target 1 face-up Level 5 or higher monster your opponent controls; destroy it.',
    },
    effects: [
      {
        id: 'giant-fall',
        trigger: { kind: 'Ignition' },
        target: {
          kind: 'Card',
          zone: 'MonsterZone',
          side: 'opponent',
          count: 1,
          filter: { level: { min: 5 } },
        },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  {
    id: 'SMP-109',
    kind: 'Spell',
    name: { vi: 'Hiến Tế Sấm Sét', en: 'Sacrificial Bolt' },
    subType: 'Normal',
    effectText: {
      vi: 'Chi phí: hiến tế 1 quái thú. Gây 1000 sát thương cho đối thủ.',
      en: 'Cost: Tribute 1 monster. Inflict 1000 damage to your opponent.',
    },
    effects: [
      {
        id: 'sacrifice-bolt',
        trigger: { kind: 'Ignition' },
        cost: [{ kind: 'Tribute', count: 1 }],
        operations: [{ kind: 'Damage', amount: 1000, target: 'opponent' }],
      },
    ],
  },
  {
    id: 'SMP-110',
    kind: 'Spell',
    name: { vi: 'Trao Đổi Sinh Lực', en: 'Lifespark Exchange' },
    subType: 'QuickPlay',
    effectText: {
      vi: 'Chi phí: bỏ 1 lá quái thú trên tay. Gây 600 sát thương cho đối thủ, sau đó hồi 600 LP.',
      en: 'Cost: discard 1 monster card. Inflict 600 damage to your opponent, then gain 600 LP.',
    },
    effects: [
      {
        id: 'lifespark',
        trigger: { kind: 'Quick' },
        cost: [{ kind: 'Discard', count: 1, filter: { kind: 'Monster' } }],
        operations: [
          { kind: 'Damage', amount: 600, target: 'opponent' },
          { kind: 'Heal', amount: 600, target: 'self' },
        ],
      },
    ],
  },
  // Task 4.2d — first real cards using Special Summon (two effects: activate one) and Equip (Tier B).
  {
    id: 'SMP-111',
    kind: 'Spell',
    name: { vi: 'Hiệu Triệu Đồng Đội', en: 'Rallying Call' },
    subType: 'Normal',
    effectText: {
      vi: 'Kích hoạt 1 trong 2 hiệu ứng: Triệu hồi Đặc biệt 1 quái thú từ tay bạn; hoặc Triệu hồi Đặc biệt 1 quái thú từ mộ bạn.',
      en: 'Activate 1 of these effects: Special Summon 1 monster from your hand; or Special Summon 1 monster from your graveyard.',
    },
    effects: [
      {
        id: 'call-from-hand',
        trigger: { kind: 'Ignition' },
        target: { kind: 'Card', zone: 'Hand', side: 'self', count: 1, filter: { kind: 'Monster' } },
        operations: [{ kind: 'SpecialSummon' }],
      },
      {
        id: 'call-from-grave',
        trigger: { kind: 'Ignition' },
        target: {
          kind: 'Card',
          zone: 'Graveyard',
          side: 'self',
          count: 1,
          filter: { kind: 'Monster' },
        },
        operations: [{ kind: 'SpecialSummon' }],
      },
    ],
  },
  {
    id: 'SMP-112',
    kind: 'Spell',
    name: { vi: 'Giáp Sợi Thép', en: 'Steelweave Harness' },
    subType: 'Equip',
    effectText: {
      vi: 'Chỉ trang bị cho quái thú ngửa bạn điều khiển. Quái thú được trang bị tăng 500 ATK.',
      en: 'Equip only to a face-up monster you control. The equipped monster gains 500 ATK.',
    },
    effects: [
      {
        id: 'equip',
        trigger: { kind: 'Ignition' },
        target: {
          kind: 'Card',
          zone: 'MonsterZone',
          side: 'self',
          count: 1,
          filter: { kind: 'Monster' },
        },
        operations: [{ kind: 'Equip' }],
      },
      {
        id: 'equip-boost',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'atk', amount: 500, equipped: true }],
      },
    ],
  },
  // Task 4.3 — first real cards that stay on the field (Tier B): a Field Spell, a Continuous Spell, and a plain Normal
  // Spell used to test "Set first, activate later". The Continuous Trap is SMP-208.
  {
    id: 'SMP-113',
    kind: 'Spell',
    name: { vi: 'Thảo Nguyên Lộng Gió', en: 'Galewind Steppe' },
    subType: 'Field',
    effectText: {
      vi: 'Mọi quái thú hệ GIÓ ngửa trên sân tăng 300 ATK.',
      en: 'All face-up WIND monsters on the field gain 300 ATK.',
    },
    effects: [
      { id: 'activate', trigger: { kind: 'Ignition' }, operations: [] },
      {
        id: 'gale-boost',
        trigger: { kind: 'Continuous' },
        operations: [
          {
            kind: 'ModifyStat',
            stat: 'atk',
            amount: 300,
            side: 'self',
            filter: { attribute: 'WIND' },
          },
          {
            kind: 'ModifyStat',
            stat: 'atk',
            amount: 300,
            side: 'opponent',
            filter: { attribute: 'WIND' },
          },
        ],
      },
    ],
  },
  {
    id: 'SMP-114',
    kind: 'Spell',
    name: { vi: 'Quân Kỳ Tập Hợp', en: 'Rally Banner' },
    subType: 'Continuous',
    effectText: {
      vi: 'Mọi quái thú tộc Chiến Binh ngửa bạn điều khiển tăng 300 ATK.',
      en: 'All face-up Warrior monsters you control gain 300 ATK.',
    },
    effects: [
      { id: 'activate', trigger: { kind: 'Ignition' }, operations: [] },
      {
        id: 'banner-boost',
        trigger: { kind: 'Continuous' },
        operations: [
          {
            kind: 'ModifyStat',
            stat: 'atk',
            amount: 300,
            side: 'self',
            filter: { race: 'Warrior' },
          },
        ],
      },
    ],
  },
  {
    id: 'SMP-115',
    kind: 'Spell',
    name: { vi: 'Tàn Lửa Âm Ỉ', en: 'Smoldering Ember' },
    subType: 'Normal',
    effectText: {
      vi: 'Gây 600 sát thương cho đối thủ.',
      en: 'Inflict 600 damage to your opponent.',
    },
    effects: [
      {
        id: 'ember-burn',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'Damage', amount: 600, target: 'opponent' }],
      },
    ],
  },
  {
    id: 'SMP-201',
    kind: 'Trap',
    name: { vi: 'Rào Chắn Hộ Vệ', en: 'Guardian Barrier' },
    subType: 'Normal',
    // Task 4.4: no longer a placeholder — the first card with a Negate operation.
    effectText: {
      vi: 'Khi quái thú của đối thủ tuyên bố tấn công: vô hiệu đòn tấn công đó.',
      en: "When an opponent's monster declares an attack: negate that attack.",
    },
    effects: [
      {
        id: 'guardian-barrier',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'NegateAttack' }],
      },
    ],
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
  // Task 4.1 — card batch 1: basic Traps (Tier B, existing effect DSL only).
  {
    id: 'SMP-204',
    kind: 'Trap',
    name: { vi: 'Bẫy Thu Phí', en: 'Tollgate Snare' },
    subType: 'Normal',
    effectText: {
      vi: 'Chi phí: trả 500 LP. Chọn 1 lá Phép/Bẫy đối thủ điều khiển; phá huỷ nó.',
      en: 'Cost: pay 500 LP. Target 1 Spell/Trap your opponent controls; destroy it.',
    },
    effects: [
      {
        id: 'toll-snare',
        trigger: { kind: 'Quick' },
        cost: [{ kind: 'PayLP', amount: 500 }],
        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  {
    id: 'SMP-205',
    kind: 'Trap',
    name: { vi: 'Hơi Thở Thứ Hai', en: 'Second Wind' },
    subType: 'Normal',
    effectText: {
      vi: 'Hồi 1000 LP, sau đó rút 1 lá.',
      en: 'Gain 1000 LP, then draw 1 card.',
    },
    effects: [
      {
        id: 'second-wind',
        trigger: { kind: 'Quick' },
        operations: [
          { kind: 'Heal', amount: 1000, target: 'self' },
          { kind: 'Draw', count: 1, target: 'self' },
        ],
      },
    ],
  },
  {
    id: 'SMP-206',
    kind: 'Trap',
    name: { vi: 'Pháo Sáng Chiến Trận', en: 'Battle Flare' },
    subType: 'Normal',
    effectText: {
      vi: 'Chỉ kích hoạt được trong Battle Phase: gây 1000 sát thương cho đối thủ.',
      en: 'Activate only during the Battle Phase: inflict 1000 damage to your opponent.',
    },
    effects: [
      {
        id: 'battle-flare',
        trigger: { kind: 'Quick' },
        condition: [{ kind: 'PhaseIs', phase: 'Battle' }],
        operations: [{ kind: 'Damage', amount: 1000, target: 'opponent' }],
      },
    ],
  },
  {
    id: 'SMP-207',
    kind: 'Trap',
    name: { vi: 'Kho Dự Trữ Cuối', en: 'Last Reserve' },
    subType: 'Normal',
    effectText: {
      vi: 'Chỉ khi bạn có từ 2 lá trở xuống trên tay: rút 2 lá.',
      en: 'Only while you have 2 or fewer cards in your hand: draw 2 cards.',
    },
    effects: [
      {
        id: 'last-reserve',
        trigger: { kind: 'Quick' },
        condition: [{ kind: 'ZoneCount', zone: 'Hand', side: 'self', max: 2 }],
        operations: [{ kind: 'Draw', count: 2, target: 'self' }],
      },
    ],
  },
  // Task 4.3 — first real Continuous Trap (Tier B): Set it, activate it later, it stays face-up.
  {
    id: 'SMP-208',
    kind: 'Trap',
    name: { vi: 'Màn Sương Rã Rời', en: 'Wearying Mist' },
    subType: 'Continuous',
    effectText: {
      vi: 'Mọi quái thú ngửa đối thủ điều khiển giảm 300 ATK.',
      en: 'All face-up monsters your opponent controls lose 300 ATK.',
    },
    effects: [
      { id: 'activate', trigger: { kind: 'Quick' }, operations: [] },
      {
        id: 'mist-drain',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'atk', amount: -300, side: 'opponent' }],
      },
    ],
  },
  // Task 4.4 — the first real Counter Traps (Tier B, Spell Speed 3 from the sub type): they only ever respond.
  {
    id: 'SMP-209',
    kind: 'Trap',
    name: { vi: 'Ấn Chú Phong Tỏa', en: 'Sealing Rune' },
    subType: 'Counter',
    effectText: {
      vi: 'Chi phí: trả 1000 LP. Khi đối thủ kích hoạt một lá Phép hoặc Bẫy: vô hiệu việc kích hoạt đó và gửi lá đó vào mộ.',
      en: 'Cost: pay 1000 LP. When your opponent activates a Spell or Trap Card: negate the activation and send that card to the Graveyard.',
    },
    effects: [
      {
        id: 'sealing-rune',
        trigger: { kind: 'Quick' },
        cost: [{ kind: 'PayLP', amount: 1000 }],
        operations: [{ kind: 'NegateActivation', cardKinds: ['Spell', 'Trap'] }],
      },
    ],
  },
  {
    id: 'SMP-210',
    kind: 'Trap',
    name: { vi: 'Cổng Khước Từ', en: 'Gate of Refusal' },
    subType: 'Counter',
    effectText: {
      vi: 'Khi đối thủ Triệu hồi Thường hoặc Triệu hồi Lật một quái thú: vô hiệu lần triệu hồi đó và gửi quái thú đó vào mộ.',
      en: 'When your opponent Normal Summons or Flip Summons a monster: negate the Summon and send that monster to the Graveyard.',
    },
    effects: [
      {
        id: 'gate-of-refusal',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'NegateSummon' }],
      },
    ],
  },
  // Task 4.5 — Fusion: two Fusion Monsters (Extra Deck only; named materials) and the Spell that Fusion Summons them.
  // Appended at the end so every older card keeps its index. Placeholder names, no Konami IP.
  {
    id: 'SMP-045',
    kind: 'Monster',
    name: { vi: 'Kỵ Sĩ Lửa Hoang', en: 'Cinderback Outrider' },
    category: 'Fusion',
    attribute: 'FIRE',
    race: 'Warrior',
    level: 6,
    atk: 2300,
    def: 1500,
    fusionMaterials: ['SMP-001', 'SMP-007'],
    effectText: {
      vi: '"Thị Vệ Lang Thang" + "Chó Săn Tàn Lửa"',
      en: '"Wandering Squire" + "Cinder Hound"',
    },
  },
  {
    id: 'SMP-046',
    kind: 'Monster',
    name: { vi: 'Đại Tư Tế Tam Quang', en: 'Tri-Light Hierophant' },
    category: 'Fusion',
    attribute: 'LIGHT',
    race: 'Spellcaster',
    level: 8,
    atk: 2900,
    def: 2400,
    fusionMaterials: ['SMP-004', 'SMP-010', 'SMP-013'],
    effectText: {
      vi: '"Tinh Linh Đèn Lồng" + "Giáo Sĩ Rạng Đông" + "Tu Sĩ Than Hồng"',
      en: '"Lantern Sprite" + "Dawnbreak Cleric" + "Ember Acolyte"',
    },
  },
  {
    id: 'SMP-116',
    kind: 'Spell',
    name: { vi: 'Lò Hợp Thể', en: 'Merging Crucible' },
    subType: 'Normal',
    effectText: {
      vi: 'Triệu hồi Dung hợp 1 quái thú Dung hợp từ Extra Deck của bạn, dùng các quái thú trên tay hoặc trên sân của bạn làm nguyên liệu (gửi chúng vào mộ).',
      en: 'Fusion Summon 1 Fusion Monster from your Extra Deck, using monsters from your hand or your field as materials (send them to the Graveyard).',
    },
    effects: [
      {
        id: 'merging-crucible',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'FusionSummon', sources: ['Hand', 'Field'] }],
      },
    ],
  },
  // Task 4.5b — a Fusion Monster with an "when Summoned" effect, so the trigger after a Fusion Summon can be played and
  // shown over the real API. Appended at the end; placeholder name, no Konami IP.
  {
    id: 'SMP-047',
    kind: 'Monster',
    name: { vi: 'Pháp Sư Màn Tro', en: 'Ashveil Warlock' },
    category: 'Fusion',
    attribute: 'DARK',
    race: 'Spellcaster',
    level: 7,
    atk: 2500,
    def: 1800,
    fusionMaterials: ['SMP-006', 'SMP-009'],
    effectText: {
      vi: '"Pháp Sư Triều Dâng" + "Kẻ Cướp Rỗng". Khi lá này được Triệu hồi Dung hợp: gây 500 sát thương cho đối thủ (bắt buộc).',
      en: '"Tidecaller Adept" + "Hollow Marauder". When this card is Fusion Summoned: inflict 500 damage to your opponent (mandatory).',
    },
    effects: [
      {
        id: 'ashveil-burn',
        trigger: { kind: 'OnSummon', mandatory: true },
        operations: [{ kind: 'Damage', amount: 500, target: 'opponent' }],
      },
    ],
  },
  // Task 4.7 — card batch 2 (Tier B): 26 cards built ONLY from the effect DSL that already exists — no new primitive,
  // no engine change. Appended at the end so every older card keeps its index. Placeholder names, no Konami IP.
  // Owner decisions (2026-10-08): classic power level (no monster above 2500 ATK); no monster has an Ignition effect —
  // the engine cannot activate a monster on the field yet (ADR 070).
  // 12 Effect Monsters: OnSummon × 3, OnFlip × 3, OnDestroyed × 3, Continuous × 3.
  {
    id: 'SMP-048',
    kind: 'Monster',
    name: { vi: 'Y Sĩ Suối Nguồn', en: 'Wellspring Medic' },
    category: 'Effect',
    attribute: 'WATER',
    race: 'Aqua',
    level: 3,
    atk: 1100,
    def: 1300,
    effectText: {
      vi: 'Khi lá này được Triệu hồi: bạn hồi 500 LP (bắt buộc).',
      en: 'When this card is Summoned: gain 500 LP (mandatory).',
    },
    effects: [
      {
        id: 'mend-on-summon',
        trigger: { kind: 'OnSummon', mandatory: true },
        operations: [{ kind: 'Heal', amount: 500, target: 'self' }],
      },
    ],
  },
  {
    id: 'SMP-049',
    kind: 'Monster',
    name: { vi: 'Xạ Thủ Đầm Sương', en: 'Mistfen Marksman' },
    category: 'Effect',
    attribute: 'WIND',
    race: 'Warrior',
    level: 4,
    atk: 1300,
    def: 1000,
    effectText: {
      vi: 'Khi lá này được Triệu hồi: bạn có thể trả 800 LP, rồi chọn 1 quái thú ngửa Cấp 4 trở xuống đối thủ điều khiển; phá huỷ nó.',
      en: 'When this card is Summoned: you can pay 800 LP, then target 1 face-up Level 4 or lower monster your opponent controls; destroy it.',
    },
    effects: [
      {
        id: 'marked-shot',
        trigger: { kind: 'OnSummon' },
        cost: [{ kind: 'PayLP', amount: 800 }],
        target: {
          kind: 'Card',
          zone: 'MonsterZone',
          side: 'opponent',
          count: 1,
          filter: { level: { max: 4 } },
        },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  {
    id: 'SMP-050',
    kind: 'Monster',
    name: { vi: 'Kẻ Gọi Bầy', en: 'Packcaller' },
    category: 'Effect',
    attribute: 'EARTH',
    race: 'Beast',
    level: 4,
    atk: 1400,
    def: 1000,
    effectText: {
      vi: 'Khi lá này được Triệu hồi: bạn có thể chọn 1 quái thú Cấp 3 trở xuống trên tay bạn; Triệu hồi Đặc biệt nó ở Tư thế Thủ ngửa.',
      en: 'When this card is Summoned: you can target 1 Level 3 or lower monster in your hand; Special Summon it in face-up Defense Position.',
    },
    effects: [
      {
        id: 'call-the-pack',
        trigger: { kind: 'OnSummon' },
        target: {
          kind: 'Card',
          zone: 'Hand',
          side: 'self',
          count: 1,
          filter: { kind: 'Monster', level: { max: 3 } },
        },
        operations: [{ kind: 'SpecialSummon', position: 'DefenseUp' }],
      },
    ],
  },
  {
    id: 'SMP-051',
    kind: 'Monster',
    name: { vi: 'Thủ Thư Phủ Bụi', en: 'Dustbound Archivist' },
    category: 'Effect',
    attribute: 'LIGHT',
    race: 'Spellcaster',
    level: 2,
    atk: 500,
    def: 1300,
    effectText: {
      vi: 'LẬT: Bạn rút 1 lá (bắt buộc).',
      en: 'FLIP: Draw 1 card (mandatory).',
    },
    effects: [
      {
        id: 'flip-draw',
        trigger: { kind: 'OnFlip', mandatory: true },
        operations: [{ kind: 'Draw', count: 1, target: 'self' }],
      },
    ],
  },
  {
    id: 'SMP-052',
    kind: 'Monster',
    name: { vi: 'Chuột Chũi Đào Hầm', en: 'Tunnel Mole' },
    category: 'Effect',
    attribute: 'EARTH',
    race: 'Beast',
    level: 2,
    atk: 600,
    def: 1000,
    effectText: {
      vi: 'LẬT: Bạn có thể chọn 1 lá Phép/Bẫy đối thủ điều khiển; phá huỷ nó.',
      en: 'FLIP: You can target 1 Spell/Trap your opponent controls; destroy it.',
    },
    effects: [
      {
        id: 'flip-burrow',
        trigger: { kind: 'OnFlip' },
        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  {
    id: 'SMP-053',
    kind: 'Monster',
    name: { vi: 'Nấm Bào Tử Nổ', en: 'Sporeburst Cap' },
    category: 'Effect',
    attribute: 'EARTH',
    race: 'Plant',
    level: 1,
    atk: 300,
    def: 700,
    effectText: {
      vi: 'LẬT: Gây 600 sát thương cho đối thủ (bắt buộc).',
      en: 'FLIP: Inflict 600 damage to your opponent (mandatory).',
    },
    effects: [
      {
        id: 'flip-burst',
        trigger: { kind: 'OnFlip', mandatory: true },
        operations: [{ kind: 'Damage', amount: 600, target: 'opponent' }],
      },
    ],
  },
  {
    id: 'SMP-054',
    kind: 'Monster',
    name: { vi: 'Lãnh Chúa Gò Mộ', en: 'Barrow Thane' },
    category: 'Effect',
    attribute: 'DARK',
    race: 'Zombie',
    level: 5,
    atk: 2000,
    def: 1500,
    effectText: {
      vi: 'Khi lá này bị phá huỷ và đưa vào Mộ: bạn có thể chọn 1 quái thú Cấp 4 trở xuống trong Mộ của bạn; Triệu hồi Đặc biệt nó ở Tư thế Thủ ngửa.',
      en: 'When this card is destroyed and sent to the Graveyard: you can target 1 Level 4 or lower monster in your Graveyard; Special Summon it in face-up Defense Position.',
    },
    effects: [
      {
        id: 'raise-retainer',
        trigger: { kind: 'OnDestroyed' },
        target: {
          kind: 'Card',
          zone: 'Graveyard',
          side: 'self',
          count: 1,
          filter: { kind: 'Monster', level: { max: 4 } },
        },
        operations: [{ kind: 'SpecialSummon', position: 'DefenseUp' }],
      },
    ],
  },
  {
    id: 'SMP-055',
    kind: 'Monster',
    name: { vi: 'Đá Nổ Lăn Dốc', en: 'Rolling Blastrock' },
    category: 'Effect',
    attribute: 'FIRE',
    race: 'Rock',
    level: 3,
    atk: 1200,
    def: 600,
    effectText: {
      vi: 'Khi lá này bị phá huỷ và đưa vào Mộ: gây 500 sát thương cho đối thủ (bắt buộc).',
      en: 'When this card is destroyed and sent to the Graveyard: inflict 500 damage to your opponent (mandatory).',
    },
    effects: [
      {
        id: 'blast-on-destroyed',
        trigger: { kind: 'OnDestroyed', mandatory: true },
        operations: [{ kind: 'Damage', amount: 500, target: 'opponent' }],
      },
    ],
  },
  {
    id: 'SMP-056',
    kind: 'Monster',
    name: { vi: 'Bóng Ma Thợ Rèn', en: 'Forgewright Shade' },
    category: 'Effect',
    attribute: 'FIRE',
    race: 'Pyro',
    level: 4,
    atk: 1500,
    def: 1100,
    effectText: {
      vi: 'Khi lá này bị phá huỷ và đưa vào Mộ: bạn có thể trả 500 LP; rút 1 lá.',
      en: 'When this card is destroyed and sent to the Graveyard: you can pay 500 LP; draw 1 card.',
    },
    effects: [
      {
        // Not "destroy 1 Spell/Trap": a trigger that targets a Spell/Trap while an Equip Spell is about to follow its
        // destroyed monster to the graveyard can leave a prompt nobody can answer (engine issue found by task 4.7,
        // docs/ai/OPEN-ISSUES.md P7) — so this card takes no target.
        id: 'last-spark',
        trigger: { kind: 'OnDestroyed' },
        cost: [{ kind: 'PayLP', amount: 500 }],
        operations: [{ kind: 'Draw', count: 1, target: 'self' }],
      },
    ],
  },
  {
    id: 'SMP-057',
    kind: 'Monster',
    name: { vi: 'Sói Đầu Đàn Bờm Xám', en: 'Greymane Alpha' },
    category: 'Effect',
    attribute: 'EARTH',
    race: 'Beast',
    level: 4,
    atk: 1500,
    def: 1200,
    effectText: {
      vi: 'Khi lá này ngửa trên sân: các quái thú tộc Thú ngửa khác bạn điều khiển tăng 200 ATK.',
      en: 'While this card is face-up on the field: other face-up Beast monsters you control gain 200 ATK.',
    },
    effects: [
      {
        id: 'pack-leader',
        trigger: { kind: 'Continuous' },
        operations: [
          {
            kind: 'ModifyStat',
            stat: 'atk',
            amount: 200,
            side: 'self',
            filter: { race: 'Beast' },
            excludeSource: true,
          },
        ],
      },
    ],
  },
  {
    id: 'SMP-058',
    kind: 'Monster',
    name: { vi: 'Kẻ Nuốt Hoàng Hôn', en: 'Gloam Devourer' },
    category: 'Effect',
    attribute: 'DARK',
    race: 'Fiend',
    level: 4,
    atk: 1600,
    def: 1000,
    effectText: {
      vi: 'Khi lá này ngửa trên sân: quái thú hệ ÁNH SÁNG ngửa đối thủ điều khiển giảm 400 ATK.',
      en: 'While this card is face-up on the field: face-up LIGHT monsters your opponent controls lose 400 ATK.',
    },
    effects: [
      {
        id: 'devour-light',
        trigger: { kind: 'Continuous' },
        operations: [
          {
            kind: 'ModifyStat',
            stat: 'atk',
            amount: -400,
            side: 'opponent',
            filter: { attribute: 'LIGHT' },
          },
        ],
      },
    ],
  },
  {
    id: 'SMP-059',
    kind: 'Monster',
    name: { vi: 'Thợ Xây Thành Luỹ', en: 'Rampart Mason' },
    category: 'Effect',
    attribute: 'EARTH',
    race: 'Rock',
    level: 3,
    atk: 800,
    def: 1700,
    effectText: {
      vi: 'Khi lá này ngửa trên sân: các quái thú tộc Đá ngửa bạn điều khiển (kể cả lá này) tăng 400 DEF.',
      en: 'While this card is face-up on the field: face-up Rock monsters you control (this card included) gain 400 DEF.',
    },
    effects: [
      {
        id: 'raise-ramparts',
        trigger: { kind: 'Continuous' },
        operations: [
          { kind: 'ModifyStat', stat: 'def', amount: 400, side: 'self', filter: { race: 'Rock' } },
        ],
      },
    ],
  },
  // 2 Fusion Monsters whose materials are Effect Monsters of this batch (owner decision, 2026-10-08).
  {
    id: 'SMP-060',
    kind: 'Monster',
    name: { vi: 'Chúa Tể Bầy Hoang', en: 'Wildpack Sovereign' },
    category: 'Fusion',
    attribute: 'EARTH',
    race: 'Beast',
    level: 6,
    atk: 2400,
    def: 1800,
    fusionMaterials: ['SMP-057', 'SMP-050'],
    effectText: {
      vi: '"Sói Đầu Đàn Bờm Xám" + "Kẻ Gọi Bầy"',
      en: '"Greymane Alpha" + "Packcaller"',
    },
  },
  {
    id: 'SMP-061',
    kind: 'Monster',
    name: { vi: 'Bạo Chúa Mộ Đêm', en: 'Nightbarrow Tyrant' },
    category: 'Fusion',
    attribute: 'DARK',
    race: 'Fiend',
    level: 7,
    atk: 2500,
    def: 2000,
    fusionMaterials: ['SMP-058', 'SMP-054'],
    effectText: {
      vi: '"Kẻ Nuốt Hoàng Hôn" + "Lãnh Chúa Gò Mộ". Khi lá này ngửa trên sân: quái thú ngửa đối thủ điều khiển giảm 200 ATK.',
      en: '"Gloam Devourer" + "Barrow Thane". While this card is face-up on the field: face-up monsters your opponent controls lose 200 ATK.',
    },
    effects: [
      {
        id: 'dread-aura',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'atk', amount: -200, side: 'opponent' }],
      },
    ],
  },
  // 8 Spells: Normal × 2, Quick-Play × 2, Equip × 2 (one aimed at the opponent's monster), Continuous, Field.
  {
    id: 'SMP-117',
    kind: 'Spell',
    name: { vi: 'Lệnh Thanh Trừng', en: 'Culling Order' },
    subType: 'Normal',
    effectText: {
      vi: 'Chi phí: bỏ 1 lá bài trên tay. Chọn 1 quái thú ngửa Cấp 4 trở xuống đối thủ điều khiển; phá huỷ nó.',
      en: 'Cost: discard 1 card. Target 1 face-up Level 4 or lower monster your opponent controls; destroy it.',
    },
    effects: [
      {
        id: 'culling',
        trigger: { kind: 'Ignition' },
        cost: [{ kind: 'Discard', count: 1 }],
        target: {
          kind: 'Card',
          zone: 'MonsterZone',
          side: 'opponent',
          count: 1,
          filter: { level: { max: 4 } },
        },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  {
    id: 'SMP-118',
    kind: 'Spell',
    name: { vi: 'Lễ Vật Tri Thức', en: 'Offering of Lore' },
    subType: 'Normal',
    effectText: {
      vi: 'Chi phí: hiến tế 1 quái thú. Rút 2 lá.',
      en: 'Cost: Tribute 1 monster. Draw 2 cards.',
    },
    effects: [
      {
        id: 'offering-draw',
        trigger: { kind: 'Ignition' },
        cost: [{ kind: 'Tribute', count: 1 }],
        operations: [{ kind: 'Draw', count: 2, target: 'self' }],
      },
    ],
  },
  {
    id: 'SMP-119',
    kind: 'Spell',
    name: { vi: 'Cơn Gió Giật', en: 'Snap Gust' },
    subType: 'QuickPlay',
    effectText: {
      vi: 'Chọn 1 lá Phép/Bẫy đối thủ điều khiển; phá huỷ nó.',
      en: 'Target 1 Spell/Trap your opponent controls; destroy it.',
    },
    effects: [
      {
        id: 'snap-gust',
        trigger: { kind: 'Quick' },
        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  {
    id: 'SMP-120',
    kind: 'Spell',
    name: { vi: 'Phục Binh Bụi Rậm', en: 'Thicket Ambush' },
    subType: 'QuickPlay',
    effectText: {
      vi: 'Chọn 1 quái thú Cấp 4 trở xuống trên tay bạn; Triệu hồi Đặc biệt nó ở Tư thế Thủ ngửa.',
      en: 'Target 1 Level 4 or lower monster in your hand; Special Summon it in face-up Defense Position.',
    },
    effects: [
      {
        id: 'ambush',
        trigger: { kind: 'Quick' },
        target: {
          kind: 'Card',
          zone: 'Hand',
          side: 'self',
          count: 1,
          filter: { kind: 'Monster', level: { max: 4 } },
        },
        operations: [{ kind: 'SpecialSummon', position: 'DefenseUp' }],
      },
    ],
  },
  {
    id: 'SMP-121',
    kind: 'Spell',
    name: { vi: 'Khiên Tháp Canh', en: 'Watchtower Shield' },
    subType: 'Equip',
    effectText: {
      vi: 'Chỉ trang bị cho quái thú ngửa bạn điều khiển. Quái thú được trang bị tăng 300 ATK và 700 DEF.',
      en: 'Equip only to a face-up monster you control. The equipped monster gains 300 ATK and 700 DEF.',
    },
    effects: [
      {
        id: 'equip',
        trigger: { kind: 'Ignition' },
        target: {
          kind: 'Card',
          zone: 'MonsterZone',
          side: 'self',
          count: 1,
          filter: { kind: 'Monster' },
        },
        operations: [{ kind: 'Equip' }],
      },
      {
        id: 'equip-boost',
        trigger: { kind: 'Continuous' },
        operations: [
          { kind: 'ModifyStat', stat: 'atk', amount: 300, equipped: true },
          { kind: 'ModifyStat', stat: 'def', amount: 700, equipped: true },
        ],
      },
    ],
  },
  {
    id: 'SMP-122',
    kind: 'Spell',
    name: { vi: 'Xiềng Xích Rỉ Sét', en: 'Rusted Shackles' },
    subType: 'Equip',
    effectText: {
      vi: 'Chỉ trang bị cho quái thú ngửa đối thủ điều khiển. Quái thú được trang bị giảm 600 ATK.',
      en: 'Equip only to a face-up monster your opponent controls. The equipped monster loses 600 ATK.',
    },
    effects: [
      {
        id: 'equip',
        trigger: { kind: 'Ignition' },
        target: {
          kind: 'Card',
          zone: 'MonsterZone',
          side: 'opponent',
          count: 1,
          filter: { kind: 'Monster' },
        },
        operations: [{ kind: 'Equip' }],
      },
      {
        id: 'equip-drain',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'atk', amount: -600, equipped: true }],
      },
    ],
  },
  {
    id: 'SMP-123',
    kind: 'Spell',
    name: { vi: 'Nghi Lễ Chạng Vạng', en: 'Duskfall Vigil' },
    subType: 'Continuous',
    effectText: {
      vi: 'Khi kích hoạt lá này: bạn hồi 500 LP. Mọi quái thú hệ BÓNG TỐI ngửa bạn điều khiển tăng 300 ATK.',
      en: 'When this card is activated: gain 500 LP. All face-up DARK monsters you control gain 300 ATK.',
    },
    effects: [
      {
        id: 'activate',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'Heal', amount: 500, target: 'self' }],
      },
      {
        id: 'dusk-boost',
        trigger: { kind: 'Continuous' },
        operations: [
          {
            kind: 'ModifyStat',
            stat: 'atk',
            amount: 300,
            side: 'self',
            filter: { attribute: 'DARK' },
          },
        ],
      },
    ],
  },
  {
    id: 'SMP-124',
    kind: 'Spell',
    name: { vi: 'Đồng Bằng Phì Nhiêu', en: 'Loamfield Expanse' },
    subType: 'Field',
    effectText: {
      vi: 'Mọi quái thú hệ ĐẤT ngửa trên sân tăng 200 ATK và 200 DEF.',
      en: 'All face-up EARTH monsters on the field gain 200 ATK and 200 DEF.',
    },
    effects: [
      { id: 'activate', trigger: { kind: 'Ignition' }, operations: [] },
      {
        id: 'loam-boost',
        trigger: { kind: 'Continuous' },
        operations: (['atk', 'def'] as const).flatMap((stat) =>
          (['self', 'opponent'] as const).map((side) => ({
            kind: 'ModifyStat' as const,
            stat,
            amount: 200,
            side,
            filter: { attribute: 'EARTH' as const },
          })),
        ),
      },
    ],
  },
  // 4 Traps: Normal × 2, Continuous, Counter.
  {
    id: 'SMP-211',
    kind: 'Trap',
    name: { vi: 'Trỗi Dậy Lần Hai', en: 'Second Rising' },
    subType: 'Normal',
    effectText: {
      vi: 'Chi phí: bỏ 1 lá bài trên tay. Chọn 1 quái thú trong Mộ của bạn; Triệu hồi Đặc biệt nó ở Tư thế Thủ ngửa.',
      en: 'Cost: discard 1 card. Target 1 monster in your Graveyard; Special Summon it in face-up Defense Position.',
    },
    effects: [
      {
        id: 'second-rising',
        trigger: { kind: 'Quick' },
        cost: [{ kind: 'Discard', count: 1 }],
        target: {
          kind: 'Card',
          zone: 'Graveyard',
          side: 'self',
          count: 1,
          filter: { kind: 'Monster' },
        },
        operations: [{ kind: 'SpecialSummon', position: 'DefenseUp' }],
      },
    ],
  },
  {
    id: 'SMP-212',
    kind: 'Trap',
    name: { vi: 'Lời Ru Câm Lặng', en: 'Hushing Lullaby' },
    subType: 'Normal',
    effectText: {
      vi: 'Khi đối thủ kích hoạt hiệu ứng của một quái thú: vô hiệu việc kích hoạt đó.',
      en: "When your opponent activates a monster's effect: negate the activation.",
    },
    effects: [
      {
        id: 'hush',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'NegateActivation', cardKinds: ['Monster'] }],
      },
    ],
  },
  {
    id: 'SMP-213',
    kind: 'Trap',
    name: { vi: 'Hàng Khiên Kiên Cố', en: 'Steadfast Shieldwall' },
    subType: 'Continuous',
    effectText: {
      vi: 'Mọi quái thú ngửa bạn điều khiển tăng 400 DEF.',
      en: 'All face-up monsters you control gain 400 DEF.',
    },
    effects: [
      { id: 'activate', trigger: { kind: 'Quick' }, operations: [] },
      {
        id: 'shield-wall',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'def', amount: 400, side: 'self' }],
      },
    ],
  },
  {
    id: 'SMP-214',
    kind: 'Trap',
    name: { vi: 'Kết Giới Phản Phép', en: 'Spellward Seal' },
    subType: 'Counter',
    effectText: {
      vi: 'Chi phí: bỏ 1 lá bài trên tay. Khi đối thủ kích hoạt một lá Phép: vô hiệu việc kích hoạt đó và gửi lá đó vào mộ.',
      en: 'Cost: discard 1 card. When your opponent activates a Spell Card: negate the activation and send that card to the Graveyard.',
    },
    effects: [
      {
        id: 'spell-ward',
        trigger: { kind: 'Quick' },
        cost: [{ kind: 'Discard', count: 1 }],
        operations: [{ kind: 'NegateActivation', cardKinds: ['Spell'] }],
      },
    ],
  },
];
