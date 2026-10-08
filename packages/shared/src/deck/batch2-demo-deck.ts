/**
 * Task 4.7 — demo deck for card batch 2, so the 26 new cards can be played over the real HTTP API: pass
 * `BATCH2_DEMO_DECK` as `deck` and `BATCH2_FUSION_EXTRA_DECK` as `extraDeck` to `POST /duels/solo`. `STARTER_DECK` and
 * every older demo deck are unchanged [DECISION] (ADR 057).
 * Main Deck (40):
 * - the 12 Effect Monsters (20 cards): the four fusion materials at 2–3 copies (SMP-050 × 3, SMP-057 × 3, SMP-058 × 3,
 *   SMP-054 × 2 — the only Level 5), SMP-049 × 2, one each of SMP-048 / 051 / 052 / 053 / 055 / 056 / 059;
 * - the 8 Spells and 4 Traps of the batch, one each, + SMP-116 (the fusion Spell of task 4.5) × 2;
 * - 6 plain monsters that feed the filters: SMP-005 × 2 and SMP-011 × 2 (EARTH Beasts, Level 3 / 2: SMP-057, SMP-050,
 *   SMP-124), SMP-009 × 2 (DARK, Level 4: SMP-123).
 * Extra Deck (4): the two Fusion Monsters of the batch, twice each. Both lists must pass `validateDeck` together
 * (covered by a test).
 */
const x2 = (id: string): string[] => [id, id];
const x3 = (id: string): string[] => [id, id, id];

export const BATCH2_DEMO_DECK: readonly string[] = [
  ...['SMP-050', 'SMP-057', 'SMP-058'].flatMap(x3),
  ...['SMP-054', 'SMP-049'].flatMap(x2),
  ...['SMP-048', 'SMP-051', 'SMP-052', 'SMP-053', 'SMP-055', 'SMP-056', 'SMP-059'],
  ...['SMP-117', 'SMP-118', 'SMP-119', 'SMP-120', 'SMP-121', 'SMP-122', 'SMP-123', 'SMP-124'],
  ...['SMP-211', 'SMP-212', 'SMP-213', 'SMP-214'],
  ...x2('SMP-116'),
  ...['SMP-005', 'SMP-011', 'SMP-009'].flatMap(x2),
];

export const BATCH2_FUSION_EXTRA_DECK: readonly string[] = [...x2('SMP-060'), ...x2('SMP-061')];
