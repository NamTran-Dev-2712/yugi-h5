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
  {
    id: 'SMP-101',
    kind: 'Spell',
    name: { vi: 'Tiếp Viện Bất Ngờ', en: 'Sudden Reinforcement' },
    subType: 'Normal',
    effectText: {
      vi: 'Placeholder: hiệu ứng rút bài, sẽ định nghĩa bằng effect DSL.',
      en: 'Placeholder: draw effect defined via effect DSL.',
    },
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
];
