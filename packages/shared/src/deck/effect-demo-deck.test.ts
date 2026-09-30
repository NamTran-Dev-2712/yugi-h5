import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../cards/card-definition.js';
import { SAMPLE_CARDS } from '../cards/sample-cards.js';
import { EFFECT_DEMO_DECK } from './effect-demo-deck.js';
import { STARTER_DECK } from './starter-deck.js';
import { validateDeck } from './validate-deck.js';

const defs = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const cardsOf = (deck: readonly string[]) => deck.map((id) => defs.get(id)!);

describe('EFFECT_DEMO_DECK (task 3.8)', () => {
  it('passes validateDeck against the sample pool (40 cards)', () => {
    expect(EFFECT_DEMO_DECK).toHaveLength(40);
    expect(validateDeck(EFFECT_DEMO_DECK, (id) => defs.get(id))).toEqual({ ok: true });
  });

  it('covers every kind of effect the engine plays: Trap, Quick-Play, both triggers, Continuous, cost', () => {
    const cards = cardsOf(EFFECT_DEMO_DECK);
    const triggers = cards.flatMap((c) => (c.effects ?? []).map((e) => e.trigger));
    expect(cards.some((c) => c.kind === 'Trap' && (c.effects?.length ?? 0) > 0)).toBe(true);
    expect(cards.some((c) => c.kind === 'Spell' && c.subType === 'QuickPlay')).toBe(true);
    expect(triggers).toContainEqual({ kind: 'OnSummon', mandatory: true });
    expect(triggers).toContainEqual({ kind: 'OnSummon' });
    expect(triggers.some((t) => t.kind === 'OnDestroyed')).toBe(true);
    expect(triggers.some((t) => t.kind === 'Continuous')).toBe(true);
    expect(cards.some((c) => c.effects?.some((e) => e.cost !== undefined))).toBe(true);
  });

  it('still has enough level 1-4 monsters to Normal Summon early', () => {
    const low = cardsOf(EFFECT_DEMO_DECK).filter((c) => c.kind === 'Monster' && c.level <= 4);
    expect(low.length).toBeGreaterThanOrEqual(20);
  });

  it('STARTER_DECK is unchanged by the new cards (first 14 vanilla monsters × 3) [DECISION]', () => {
    expect(new Set(STARTER_DECK)).toEqual(
      new Set(Array.from({ length: 14 }, (_, i) => `SMP-${String(i + 1).padStart(3, '0')}`)),
    );
  });
});

describe('sample cards of task 3.8', () => {
  const NEW_IDS = [
    'SMP-019',
    'SMP-020',
    'SMP-021',
    'SMP-022',
    'SMP-023',
    'SMP-102',
    'SMP-103',
    'SMP-104',
    'SMP-202',
    'SMP-203',
  ];

  it('all 10 exist, have bilingual effect text and at least one effect', () => {
    for (const id of NEW_IDS) {
      const c = defs.get(id);
      expect(c, id).toBeDefined();
      expect(c?.effectText?.vi, id).toBeTruthy();
      expect(c?.effectText?.en, id).toBeTruthy();
      expect(c?.effects?.length, id).toBeGreaterThan(0);
    }
  });

  it('effect monsters are category Effect', () => {
    for (const id of NEW_IDS) {
      const c = defs.get(id);
      if (c?.kind === 'Monster') expect(c.category, id).toBe('Effect');
    }
  });
});
