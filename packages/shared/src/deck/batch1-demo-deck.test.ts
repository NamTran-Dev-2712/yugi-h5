import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../cards/card-definition.js';
import { SAMPLE_CARDS } from '../cards/sample-cards.js';
import { BATCH1_DEMO_DECK } from './batch1-demo-deck.js';
import { validateDeck } from './validate-deck.js';

const defs = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const cardsOf = (deck: readonly string[]) => deck.map((id) => defs.get(id)!);
const num = (id: string) => Number(id.slice(4));

describe('BATCH1_DEMO_DECK (task 4.1)', () => {
  it('passes validateDeck against the sample pool (40 cards)', () => {
    expect(BATCH1_DEMO_DECK).toHaveLength(40);
    expect(validateDeck(BATCH1_DEMO_DECK, (id) => defs.get(id))).toEqual({ ok: true });
  });

  it('uses only batch 1 cards and every one of the 10 Spells/Traps', () => {
    for (const id of BATCH1_DEMO_DECK) {
      const n = num(id);
      expect((n >= 24 && n <= 43) || (n >= 105 && n <= 110) || (n >= 204 && n <= 207), id).toBe(
        true,
      );
    }
    const backrow = new Set(cardsOf(BATCH1_DEMO_DECK).filter((c) => c.kind !== 'Monster'));
    expect(backrow.size).toBe(10);
  });

  it('has enough Level 1-4 monsters to Normal Summon early', () => {
    const low = cardsOf(BATCH1_DEMO_DECK).filter((c) => c.kind === 'Monster' && c.level <= 4);
    expect(low.length).toBeGreaterThanOrEqual(15);
  });
});
