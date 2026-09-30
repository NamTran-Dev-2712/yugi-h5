/**
 * Task 3.8 — demo deck with the first real effect cards (triggers, Continuous, Quick-Play, Traps, a cost), so a duel
 * over the real HTTP API can open chain / reaction windows. Pass it as `deck` to `POST /duels/solo`; `STARTER_DECK`
 * stays the default and is unchanged [DECISION] (the AI never Sets/starts a Spell/Trap, so they would be dead cards
 * in its hand). 5 effect monsters × 3 + 5 Spells/Traps × 3 + 10 vanilla level 3–4 monsters = 40.
 * Must pass `validateDeck` (covered by a test).
 */
const x3 = (id: string): string[] => [id, id, id];

export const EFFECT_DEMO_DECK: readonly string[] = [
  ...['SMP-019', 'SMP-020', 'SMP-021', 'SMP-022', 'SMP-023'].flatMap(x3),
  ...['SMP-102', 'SMP-103', 'SMP-104', 'SMP-202', 'SMP-203'].flatMap(x3),
  ...['SMP-006', 'SMP-008', 'SMP-009'].flatMap(x3),
  'SMP-017',
];
