/**
 * Task 4.5b — demo deck for Fusion, so a Fusion Summon can be played over the real HTTP API: pass `FUSION_DEMO_DECK` as
 * `deck` and `FUSION_DEMO_EXTRA_DECK` as `extraDeck` to `POST /duels/solo`. `STARTER_DECK` stays the default and is
 * unchanged [DECISION] (ADR 057).
 * Main Deck (40): SMP-116 (the fusion Spell) × 3; every material of the three Fusion Monsters × 3 (SMP-001 + SMP-007 →
 * SMP-045, SMP-004 + SMP-010 + SMP-013 → SMP-046, SMP-006 + SMP-009 → SMP-047); SMP-019 × 2 ("when Summoned" burn);
 * SMP-209 × 2 (Counter Trap that negates a Spell — a fusion can be stopped) and SMP-202 × 2 (destroys a monster — a
 * material on the field can be destroyed in response); SMP-101 × 2 (draw); 8 plain Level 4 monsters.
 * Extra Deck (5): Fusion Monsters only. Both lists must pass `validateDeck` together (covered by a test).
 */
const x3 = (id: string): string[] => [id, id, id];

export const FUSION_DEMO_DECK: readonly string[] = [
  ...x3('SMP-116'),
  ...['SMP-001', 'SMP-007'].flatMap(x3),
  ...['SMP-004', 'SMP-010', 'SMP-013'].flatMap(x3),
  ...['SMP-006', 'SMP-009'].flatMap(x3),
  'SMP-019',
  'SMP-019',
  'SMP-209',
  'SMP-209',
  'SMP-202',
  'SMP-202',
  'SMP-101',
  'SMP-101',
  ...['SMP-008', 'SMP-012'].flatMap(x3),
  'SMP-017',
  'SMP-017',
];

export const FUSION_DEMO_EXTRA_DECK: readonly string[] = [
  'SMP-045',
  'SMP-045',
  'SMP-046',
  'SMP-047',
  'SMP-047',
];
