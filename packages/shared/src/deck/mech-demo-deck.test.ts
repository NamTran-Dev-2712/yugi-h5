import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../cards/card-definition.js';
import { SAMPLE_CARDS } from '../cards/sample-cards.js';
import { MECH_DEMO_DECK } from './mech-demo-deck.js';
import { STARTER_DECK } from './starter-deck.js';
import { validateDeck } from './validate-deck.js';

const defs = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const count = (deck: readonly string[], id: string) => deck.filter((x) => x === id).length;

describe('MECH_DEMO_DECK (task 4.2d)', () => {
  it('passes validateDeck against the sample pool (40 cards)', () => {
    expect(MECH_DEMO_DECK).toHaveLength(40);
    expect(validateDeck(MECH_DEMO_DECK, (id) => defs.get(id))).toEqual({ ok: true });
  });

  it('plays all three mechanic cards at 3 copies each', () => {
    for (const id of ['SMP-044', 'SMP-111', 'SMP-112'])
      expect(count(MECH_DEMO_DECK, id), id).toBe(3);
  });

  it('is mostly Level 1-4 monsters so there is something to Flip, revive and equip', () => {
    const low = MECH_DEMO_DECK.map((id) => defs.get(id)!).filter(
      (c) => c.kind === 'Monster' && c.level <= 4,
    );
    expect(low.length).toBeGreaterThanOrEqual(25);
  });

  it('leaves STARTER_DECK untouched (no mechanic card in it)', () => {
    for (const id of ['SMP-044', 'SMP-111', 'SMP-112']) expect(STARTER_DECK).not.toContain(id);
  });
});
