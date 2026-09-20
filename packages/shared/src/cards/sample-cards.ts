import type { CardDefinition } from './card-definition.js';

/**
 * Placeholder card pool — original names/stats only, no Konami IP.
 * Used for engine tests and early FE rendering until the real M2 card set lands.
 */
export const SAMPLE_CARDS: CardDefinition[] = [
  {
    id: 'SMP-001',
    kind: 'Monster',
    name: 'Wandering Squire',
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level: 3,
    atk: 1200,
    def: 800,
    effectText: undefined,
  },
  {
    id: 'SMP-002',
    kind: 'Monster',
    name: 'Iron Bulwark Guardian',
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
    name: 'Ashfall Wyrm',
    category: 'Normal',
    attribute: 'FIRE',
    race: 'Dragon',
    level: 8,
    atk: 2700,
    def: 2000,
  },
  {
    id: 'SMP-101',
    kind: 'Spell',
    name: 'Sudden Reinforcement',
    subType: 'Normal',
    effectText: 'Placeholder: draw effect defined via effect DSL in M2.',
  },
  {
    id: 'SMP-201',
    kind: 'Trap',
    name: 'Guardian Barrier',
    subType: 'Normal',
    effectText: 'Placeholder: negate-attack effect defined via effect DSL in M2.',
  },
];
