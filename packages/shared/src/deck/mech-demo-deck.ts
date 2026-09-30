/**
 * Task 4.2d — demo deck for the task 4.2 mechanics, so Flip Summon (SMP-044), Special Summon (SMP-111) and Equip
 * (SMP-112) can be played over the real HTTP API. Pass it as `deck` to `POST /duels/solo`; `STARTER_DECK` stays the
 * default and is unchanged [DECISION] (ADR 3.8). 3 × 3 mechanic cards + 31 Level 2–4 vanilla monsters (to Set, revive
 * and equip) = 40. Must pass `validateDeck` (covered by a test).
 */
const x3 = (id: string): string[] => [id, id, id];

export const MECH_DEMO_DECK: readonly string[] = [
  ...['SMP-044', 'SMP-111', 'SMP-112'].flatMap(x3),
  ...['SMP-006', 'SMP-008', 'SMP-009', 'SMP-012', 'SMP-017'].flatMap(x3),
  ...['SMP-030', 'SMP-031', 'SMP-032', 'SMP-033', 'SMP-005'].flatMap(x3),
  'SMP-007',
];
