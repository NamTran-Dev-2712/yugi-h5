import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../cards/card-definition.js';
import { SAMPLE_CARDS } from '../cards/sample-cards.js';
import {
  DECK_MAX_COPIES,
  DECK_MAX_SIZE,
  DECK_MIN_SIZE,
  validateDeck,
  type DeckError,
} from './validate-deck.js';

const defs = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const lookup = (id: string): CardDefinition | undefined => defs.get(id);

/** `n` cards spread over distinct known ids, at most 3 copies each (needs enough distinct sample cards). */
function legalDeck(n: number): string[] {
  const ids = SAMPLE_CARDS.map((c) => c.id);
  const deck: string[] = [];
  for (let i = 0; deck.length < n; i++) deck.push(ids[Math.floor(i / 3) % ids.length]!);
  return deck;
}

const codes = (errors: readonly DeckError[]): string[] => errors.map((e) => e.code);

describe('validateDeck', () => {
  it('exposes the [RULE]/[REF] limits', () => {
    expect([DECK_MIN_SIZE, DECK_MAX_SIZE, DECK_MAX_COPIES]).toEqual([40, 60, 3]);
  });

  it.each([40, 41, 59, 60])('accepts %i cards', (n) => {
    expect(validateDeck(legalDeck(n), lookup)).toEqual({ ok: true });
  });

  it('rejects 39 cards with TOO_FEW', () => {
    const r = validateDeck(legalDeck(39), lookup);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual([{ code: 'TOO_FEW', size: 39, min: 40 }]);
  });

  it('rejects 61 cards with TOO_MANY', () => {
    const r = validateDeck(legalDeck(61), lookup);
    expect(r.ok).toBe(false);
    // The 20-card pool caps a legal deck at 60, so the 61st card also breaks the copy limit; both are reported.
    if (!r.ok) expect(r.errors).toContainEqual({ code: 'TOO_MANY', size: 61, max: 60 });
  });

  it('rejects an empty deck', () => {
    const r = validateDeck([], lookup);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(codes(r.errors)).toEqual(['TOO_FEW']);
  });

  it('allows exactly 3 copies but not 4', () => {
    const base = legalDeck(40).filter((id) => id !== 'SMP-001');
    const three = [...base, 'SMP-001', 'SMP-001', 'SMP-001'].slice(0, 43);
    expect(validateDeck(three, lookup).ok).toBe(true);
    const four = [...three, 'SMP-001'];
    const r = validateDeck(four, lookup);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        code: 'TOO_MANY_COPIES',
        definitionId: 'SMP-001',
        count: 4,
        max: 3,
      });
    }
  });

  it('reports each unknown id once, even when repeated', () => {
    const deck = [...legalDeck(40), 'NOPE-1', 'NOPE-1', 'NOPE-2'];
    const r = validateDeck(deck, lookup);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const unknown = r.errors.filter((e) => e.code === 'UNKNOWN_CARD');
      expect(unknown).toEqual([
        { code: 'UNKNOWN_CARD', definitionId: 'NOPE-1' },
        { code: 'UNKNOWN_CARD', definitionId: 'NOPE-2' },
      ]);
    }
  });

  it('does not count unknown ids towards the copy limit', () => {
    const deck = [...legalDeck(40), 'NOPE', 'NOPE', 'NOPE', 'NOPE'];
    const r = validateDeck(deck, lookup);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(codes(r.errors)).toEqual(['UNKNOWN_CARD']);
  });

  it('returns every problem at once (list, not first-fail)', () => {
    const r = validateDeck(['SMP-001', 'SMP-001', 'SMP-001', 'SMP-001', 'NOPE'], lookup);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(codes(r.errors).sort()).toEqual(['TOO_FEW', 'TOO_MANY_COPIES', 'UNKNOWN_CARD']);
  });

  it('does not mutate the input', () => {
    const deck = Object.freeze(legalDeck(40));
    expect(() => validateDeck(deck, lookup)).not.toThrow();
  });
});
