import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../cards/card-definition.js';
import { SAMPLE_CARDS } from '../cards/sample-cards.js';
import { NEGATE_OPERATION_KINDS } from '../effects/registry.js';
import { NEGATE_DEMO_DECK } from './negate-demo-deck.js';
import { STARTER_DECK } from './starter-deck.js';
import { validateDeck } from './validate-deck.js';

const defs = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const count = (deck: readonly string[], id: string) => deck.filter((x) => x === id).length;
const cards = NEGATE_DEMO_DECK.map((id) => defs.get(id)!);
const NEGATE_CARDS = ['SMP-201', 'SMP-209', 'SMP-210'];

describe('NEGATE_DEMO_DECK (task 4.4b)', () => {
  it('passes validateDeck against the sample pool (40 cards)', () => {
    expect(NEGATE_DEMO_DECK).toHaveLength(40);
    expect(validateDeck(NEGATE_DEMO_DECK, (id) => defs.get(id))).toEqual({ ok: true });
  });

  it('plays the three task 4.4 cards at 3 copies each', () => {
    for (const id of NEGATE_CARDS) expect(count(NEGATE_DEMO_DECK, id), id).toBe(3);
  });

  it('its negating cards are exactly those three: a Normal Trap and two Counter Traps, one operation kind each', () => {
    const negating = cards.filter((c) =>
      (c.effects ?? []).some((e) =>
        e.operations.some((o) => (NEGATE_OPERATION_KINDS as readonly string[]).includes(o.kind)),
      ),
    );
    expect([...new Set(negating.map((c) => c.id))].sort()).toEqual(NEGATE_CARDS);
    const subTypes = NEGATE_CARDS.map((id) => {
      const c = defs.get(id)!;
      return c.kind === 'Trap' ? c.subType : c.kind;
    });
    expect(subTypes).toEqual(['Normal', 'Counter', 'Counter']);
  });

  it('carries Spells worth negating: a Continuous Spell that stays, a burn Spell, and at least 8 Spells in all', () => {
    expect(count(NEGATE_DEMO_DECK, 'SMP-114')).toBe(3);
    expect(count(NEGATE_DEMO_DECK, 'SMP-115')).toBe(3);
    expect(cards.filter((c) => c.kind === 'Spell').length).toBeGreaterThanOrEqual(8);
  });

  it('carries a "destroy 1 Spell/Trap" card, so a Set Trap can be destroyed face-down in a real duel', () => {
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

  it('has enough plain monsters to play a whole duel: 18+ of Level 4 or lower, none with an effect, 9 Warriors', () => {
    const monsters = cards.filter((c) => c.kind === 'Monster');
    expect(monsters.every((c) => (c.effects?.length ?? 0) === 0)).toBe(true);
    const low = monsters.filter((c) => c.kind === 'Monster' && c.level <= 4);
    expect(low.length).toBeGreaterThanOrEqual(18);
    expect(low.filter((c) => c.kind === 'Monster' && c.race === 'Warrior').length).toBe(9);
  });

  it('leaves STARTER_DECK untouched (none of the three cards in it)', () => {
    for (const id of NEGATE_CARDS) expect(STARTER_DECK).not.toContain(id);
  });
});
