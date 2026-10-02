/**
 * Task 4.4b — demo deck for the task 4.4 cards, so a Counter Trap / negation can be played over the real HTTP API:
 * SMP-201 (Normal Trap: negate an attack), SMP-209 (Counter Trap, pay 1000 LP: negate a Spell/Trap activation), SMP-210
 * (Counter Trap: negate a Normal / Flip Summon). Pass it as `deck` to `POST /duels/solo`; `STARTER_DECK` stays the
 * default and is unchanged [DECISION] (ADR 057). 3 × 3 task-4.4 cards + 10 Spells to play and to have negated (SMP-114
 * Continuous Spell, SMP-115 burn, SMP-105 destroys 1 Spell/Trap — a Set Trap can be destroyed face-down — and SMP-101
 * draw) + 21 vanilla monsters (9 Warriors for SMP-114, 19 of Level 4 or lower, 2 Level 6) = 40. Must pass
 * `validateDeck` (covered by a test).
 */
const x3 = (id: string): string[] => [id, id, id];

export const NEGATE_DEMO_DECK: readonly string[] = [
  ...['SMP-201', 'SMP-209', 'SMP-210'].flatMap(x3),
  ...['SMP-114', 'SMP-115'].flatMap(x3),
  'SMP-105',
  'SMP-105',
  'SMP-101',
  'SMP-101',
  // Warrior: SMP-001, SMP-008, SMP-017.
  ...['SMP-001', 'SMP-008', 'SMP-017'].flatMap(x3),
  ...['SMP-006', 'SMP-009', 'SMP-012'].flatMap(x3),
  'SMP-014',
  'SMP-036',
  'SMP-036',
];
