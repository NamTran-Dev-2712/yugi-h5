import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../cards/card-definition.js';
import { SAMPLE_CARDS } from '../cards/sample-cards.js';
import { BATCH1_DEMO_DECK } from './batch1-demo-deck.js';
import { BATCH2_DEMO_DECK, BATCH2_FUSION_EXTRA_DECK } from './batch2-demo-deck.js';
import { EFFECT_DEMO_DECK } from './effect-demo-deck.js';
import { FIELD_DEMO_DECK } from './field-demo-deck.js';
import { FUSION_DEMO_DECK, FUSION_DEMO_EXTRA_DECK } from './fusion-demo-deck.js';
import { MECH_DEMO_DECK } from './mech-demo-deck.js';
import { NEGATE_DEMO_DECK } from './negate-demo-deck.js';
import { STARTER_DECK } from './starter-deck.js';
import { validateDeck } from './validate-deck.js';

const defs = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const lookup = (id: string) => defs.get(id);
const count = (deck: readonly string[], id: string) => deck.filter((x) => x === id).length;
const range = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => `SMP-${String(from + i).padStart(3, '0')}`);

const BATCH2_MAIN = [...range(48, 59), ...range(117, 124), ...range(211, 214)];
const BATCH2_FUSION = range(60, 61);

describe('BATCH2_DEMO_DECK + BATCH2_FUSION_EXTRA_DECK (task 4.7)', () => {
  it('pass validateDeck together (40 + 4 cards), and the Main Deck alone (the AI seat has no Extra Deck)', () => {
    expect(BATCH2_DEMO_DECK).toHaveLength(40);
    expect(BATCH2_FUSION_EXTRA_DECK).toHaveLength(4);
    expect(validateDeck(BATCH2_DEMO_DECK, lookup, BATCH2_FUSION_EXTRA_DECK)).toEqual({ ok: true });
    expect(validateDeck(BATCH2_DEMO_DECK, lookup)).toEqual({ ok: true });
  });

  it('holds every Main Deck card of batch 2, and the Extra Deck exactly the two new Fusion Monsters', () => {
    for (const id of BATCH2_MAIN) expect(count(BATCH2_DEMO_DECK, id), id).toBeGreaterThanOrEqual(1);
    expect([...new Set(BATCH2_FUSION_EXTRA_DECK)].sort()).toEqual(BATCH2_FUSION);
  });

  it('can fuse: the fusion Spell SMP-116 twice, and at least 2 copies of every material', () => {
    expect(count(BATCH2_DEMO_DECK, 'SMP-116')).toBe(2);
    for (const id of BATCH2_FUSION) {
      const card = defs.get(id);
      if (card?.kind !== 'Monster') throw new Error(id);
      for (const m of card.fusionMaterials ?? []) {
        expect(count(BATCH2_DEMO_DECK, m), `${id} material ${m}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('feeds its own filters: Beasts for SMP-057, DARK monsters for SMP-123, EARTH for SMP-124, Level 3 or lower for SMP-050', () => {
    const monsters = BATCH2_DEMO_DECK.map((id) => defs.get(id)!).filter(
      (c) => c.kind === 'Monster',
    );
    const having = (test: (c: CardDefinition & { kind: 'Monster' }) => boolean) =>
      monsters.filter((c) => c.kind === 'Monster' && test(c)).length;
    expect(having((c) => c.race === 'Beast')).toBeGreaterThanOrEqual(8);
    expect(having((c) => c.attribute === 'DARK')).toBeGreaterThanOrEqual(6);
    expect(having((c) => c.attribute === 'EARTH')).toBeGreaterThanOrEqual(10);
    expect(having((c) => c.level <= 3)).toBeGreaterThanOrEqual(8);
  });

  it('has 22+ monsters of Level 4 or lower, so a duel can be played without Tributes', () => {
    const low = BATCH2_DEMO_DECK.map((id) => defs.get(id)!).filter(
      (c) => c.kind === 'Monster' && c.level <= 4,
    );
    expect(low.length).toBeGreaterThanOrEqual(22);
  });

  it('[DECISION] ADR 057: STARTER_DECK and every older demo deck hold no batch-2 card', () => {
    const older = [
      STARTER_DECK,
      EFFECT_DEMO_DECK,
      BATCH1_DEMO_DECK,
      MECH_DEMO_DECK,
      FIELD_DEMO_DECK,
      NEGATE_DEMO_DECK,
      FUSION_DEMO_DECK,
      FUSION_DEMO_EXTRA_DECK,
    ];
    for (const deck of older) {
      for (const id of [...BATCH2_MAIN, ...BATCH2_FUSION]) expect(deck).not.toContain(id);
    }
  });
});
