/**
 * Task 4.3b — demo deck for the task 4.3 cards, so the Field Zone and the cards that stay on the field can be played over
 * the real HTTP API: SMP-113 (Field Spell: WIND monsters of both sides +300 ATK), SMP-114 (Continuous Spell: your
 * Warriors +300 ATK), SMP-115 (Normal Spell, 600 damage — Set it, then activate it), SMP-208 (Continuous Trap: opponent
 * monsters −300 ATK). Pass it as `deck` to `POST /duels/solo`; `STARTER_DECK` stays the default and is unchanged
 * [DECISION] (ADR 057). 4 × 3 task-4.3 cards + 2 × SMP-105 (destroys 1 Spell/Trap of the opponent: a Field Spell can be
 * destroyed) + 26 vanilla monsters (9 WIND and 9 Warrior of Level 4 or lower, 2 Level 6) = 40. Must pass
 * `validateDeck` (covered by a test).
 */
const x3 = (id: string): string[] => [id, id, id];

export const FIELD_DEMO_DECK: readonly string[] = [
  ...['SMP-113', 'SMP-114', 'SMP-115', 'SMP-208'].flatMap(x3),
  'SMP-105',
  'SMP-105',
  // WIND: SMP-008 (also a Warrior), SMP-014, SMP-030. Warrior: SMP-008, SMP-001, SMP-017.
  ...['SMP-008', 'SMP-014', 'SMP-030', 'SMP-001', 'SMP-017'].flatMap(x3),
  ...['SMP-006', 'SMP-009', 'SMP-012'].flatMap(x3),
  'SMP-036',
  'SMP-036',
];
