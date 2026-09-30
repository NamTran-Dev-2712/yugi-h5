/**
 * Task 4.1 — demo deck for card batch 1, so the 10 basic Spells/Traps can be played over the real HTTP API. Pass it
 * as `deck` to `POST /duels/solo`; `STARTER_DECK` stays the default and is unchanged [DECISION] (ADR 3.8: the AI never
 * Sets/starts a Spell/Trap on its own). 10 Spells/Traps × 2 + 20 batch-1 vanilla monsters (16 of Level 3–4, 4 of
 * Level 5–6 to feed SMP-108/109 and Tribute Summons) = 40. Must pass `validateDeck` (covered by a test).
 */
const x2 = (id: string): string[] => [id, id];

export const BATCH1_DEMO_DECK: readonly string[] = [
  ...['SMP-105', 'SMP-106', 'SMP-107', 'SMP-108', 'SMP-109', 'SMP-110'].flatMap(x2),
  ...['SMP-204', 'SMP-205', 'SMP-206', 'SMP-207'].flatMap(x2),
  ...['SMP-030', 'SMP-031', 'SMP-032', 'SMP-033'].flatMap((id) => [id, id, id]),
  ...['SMP-028', 'SMP-029', 'SMP-034', 'SMP-036'].flatMap(x2),
];
