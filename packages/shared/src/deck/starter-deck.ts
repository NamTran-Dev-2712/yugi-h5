import { SAMPLE_CARDS } from '../cards/sample-cards.js';

/**
 * Default deck for solo/debug duels: the first 14 placeholder Monsters x3 = 42 cards. Monsters only because the
 * engine has no Spell/Trap handling yet (they would be dead cards). Placeholder names only (no Konami IP).
 * Must pass `validateDeck` (covered by a test).
 */
export const STARTER_DECK: readonly string[] = SAMPLE_CARDS.filter((c) => c.kind === 'Monster')
  .slice(0, 14)
  .flatMap((c) => [c.id, c.id, c.id]);
