import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../cards/card-definition.js';
import { staysOnField } from '../cards/card-definition.js';
import { SAMPLE_CARDS } from '../cards/sample-cards.js';
import { FIELD_DEMO_DECK } from './field-demo-deck.js';
import { STARTER_DECK } from './starter-deck.js';
import { validateDeck } from './validate-deck.js';

const defs = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const count = (deck: readonly string[], id: string) => deck.filter((x) => x === id).length;
const cards = FIELD_DEMO_DECK.map((id) => defs.get(id)!);
const FIELD_CARDS = ['SMP-113', 'SMP-114', 'SMP-115', 'SMP-208'];

describe('FIELD_DEMO_DECK (task 4.3b)', () => {
  it('passes validateDeck against the sample pool (40 cards)', () => {
    expect(FIELD_DEMO_DECK).toHaveLength(40);
    expect(validateDeck(FIELD_DEMO_DECK, (id) => defs.get(id))).toEqual({ ok: true });
  });

  it('plays the four task 4.3 cards at 3 copies each', () => {
    for (const id of FIELD_CARDS) expect(count(FIELD_DEMO_DECK, id), id).toBe(3);
  });

  it('holds one Field Spell, one Continuous Spell and one Continuous Trap that stay on the field', () => {
    const staying = [...new Set(cards.filter(staysOnField).map((c) => c.id))].sort();
    expect(staying).toEqual(['SMP-113', 'SMP-114', 'SMP-208']);
  });

  it('has the monsters its bonuses apply to: WIND (SMP-113) and Warrior (SMP-114), Level 4 or lower', () => {
    const low = cards.filter((c) => c.kind === 'Monster' && c.level <= 4);
    expect(low.filter((c) => c.kind === 'Monster' && c.attribute === 'WIND').length).toBe(9);
    expect(low.filter((c) => c.kind === 'Monster' && c.race === 'Warrior').length).toBe(9);
    expect(low.length).toBeGreaterThanOrEqual(24);
  });

  it('carries a "destroy 1 Spell/Trap" card, so a Field Spell can be destroyed in a real duel', () => {
    const destroyers = cards.filter((c) =>
      (c.effects ?? []).some(
        (e) =>
          e.target?.kind === 'Card' &&
          e.target.zone === 'SpellTrapZone' &&
          e.operations.some((o) => o.kind === 'Destroy'),
      ),
    );
    expect(destroyers.length).toBeGreaterThanOrEqual(2);
  });

  it('leaves STARTER_DECK untouched (none of the four cards in it)', () => {
    for (const id of FIELD_CARDS) expect(STARTER_DECK).not.toContain(id);
  });
});
