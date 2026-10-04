import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../cards/card-definition.js';
import { SAMPLE_CARDS } from '../cards/sample-cards.js';
import { isFusionEffect } from '../effects/effect-definition.js';
import { FUSION_DEMO_DECK, FUSION_DEMO_EXTRA_DECK } from './fusion-demo-deck.js';
import { STARTER_DECK } from './starter-deck.js';
import { validateDeck } from './validate-deck.js';

const defs = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const lookup = (id: string) => defs.get(id);
const count = (deck: readonly string[], id: string) => deck.filter((x) => x === id).length;

describe('FUSION_DEMO_DECK + FUSION_DEMO_EXTRA_DECK (task 4.5b)', () => {
  it('pass validateDeck together (40 + 5 cards)', () => {
    expect(FUSION_DEMO_DECK).toHaveLength(40);
    expect(FUSION_DEMO_EXTRA_DECK).toHaveLength(5);
    expect(validateDeck(FUSION_DEMO_DECK, lookup, FUSION_DEMO_EXTRA_DECK)).toEqual({ ok: true });
  });

  it('the Main Deck alone is a valid deck too (the AI seat plays it without an Extra Deck)', () => {
    expect(validateDeck(FUSION_DEMO_DECK, lookup)).toEqual({ ok: true });
  });

  it('swapping the two lists is refused: Fusion Monsters live in the Extra Deck only', () => {
    const r = validateDeck(FUSION_DEMO_DECK, lookup, ['SMP-001']);
    expect(r.ok).toBe(false);
    const mixed = validateDeck([...FUSION_DEMO_DECK.slice(1), 'SMP-045'], lookup);
    expect(mixed.ok).toBe(false);
  });

  it('plays the fusion Spell at 3 copies and it is the only fusion card of the Main Deck', () => {
    expect(count(FUSION_DEMO_DECK, 'SMP-116')).toBe(3);
    const fusing = FUSION_DEMO_DECK.filter((id) =>
      (defs.get(id)?.effects ?? []).some(isFusionEffect),
    );
    expect([...new Set(fusing)]).toEqual(['SMP-116']);
  });

  it('the Extra Deck holds every Fusion Monster of the pool, and the Main Deck 3 copies of each material', () => {
    const fusions = SAMPLE_CARDS.filter((c) => c.kind === 'Monster' && c.category === 'Fusion');
    expect([...new Set(FUSION_DEMO_EXTRA_DECK)].sort()).toEqual(fusions.map((c) => c.id).sort());
    for (const f of fusions) {
      if (f.kind !== 'Monster') continue;
      for (const m of f.fusionMaterials ?? []) expect(count(FUSION_DEMO_DECK, m), m).toBe(3);
    }
  });

  it('includes a Fusion Monster with a "when Summoned" effect (SMP-047)', () => {
    const def = defs.get('SMP-047');
    expect(FUSION_DEMO_EXTRA_DECK).toContain('SMP-047');
    expect(def?.effects?.some((e) => e.trigger.kind === 'OnSummon')).toBe(true);
  });

  it('carries the cards that can stop a fusion: a Counter Trap (SMP-209) and a monster-destroying Trap (SMP-202)', () => {
    expect(count(FUSION_DEMO_DECK, 'SMP-209')).toBe(2);
    expect(count(FUSION_DEMO_DECK, 'SMP-202')).toBe(2);
  });

  it('has 25+ monsters of Level 4 or lower, so a duel can be played without Tributes', () => {
    const low = FUSION_DEMO_DECK.map((id) => defs.get(id)!).filter(
      (c) => c.kind === 'Monster' && c.level <= 4,
    );
    expect(low.length).toBeGreaterThanOrEqual(25);
  });

  it('leaves STARTER_DECK untouched (no fusion card in it)', () => {
    for (const id of ['SMP-116', ...FUSION_DEMO_EXTRA_DECK]) expect(STARTER_DECK).not.toContain(id);
  });
});
