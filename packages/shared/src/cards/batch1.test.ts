import { describe, expect, it } from 'vitest';
import type { CardDefinition, MonsterCardDefinition } from './card-definition.js';
import { SAMPLE_CARDS } from './sample-cards.js';

/*
 * Task 4.1 — card batch 1 (card-and-effect-plan.md): 20 vanilla monsters covering Level 1–8 and all 6 attributes,
 * and 10 basic Spells/Traps built only from the existing effect DSL.
 */

const range = (from: number, to: number, prefix = 'SMP-'): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(3, '0')}`);

const VANILLA_IDS = range(24, 43);
const SPELL_TRAP_IDS = [...range(105, 110), ...range(204, 207)];

const byId = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const get = (id: string): CardDefinition => {
  const card = byId.get(id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
};

describe('card batch 1', () => {
  it('every id exists exactly once in SAMPLE_CARDS', () => {
    const ids = SAMPLE_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [...VANILLA_IDS, ...SPELL_TRAP_IDS]) expect(byId.has(id), id).toBe(true);
  });

  it('20 vanilla monsters: Normal, no effect data, Level 1–8 each at least twice, all 6 attributes', () => {
    const vanilla = VANILLA_IDS.map(get) as MonsterCardDefinition[];
    for (const card of vanilla) {
      expect(card.kind, card.id).toBe('Monster');
      expect(card.category, card.id).toBe('Normal');
      expect(card.effects, card.id).toBeUndefined();
      expect(card.effectText, card.id).toBeUndefined();
    }
    for (let level = 1; level <= 8; level++) {
      expect(vanilla.filter((c) => c.level === level).length, `level ${level}`).toBeGreaterThan(1);
    }
    expect(new Set(vanilla.map((c) => c.attribute))).toEqual(
      new Set(['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND']),
    );
    expect(new Set(vanilla.map((c) => c.race)).size).toBeGreaterThanOrEqual(12);
  });

  it('vanilla stats scale with Level (tribute-free Level 1–4 stay at 1900 ATK or less)', () => {
    for (const card of VANILLA_IDS.map(get) as MonsterCardDefinition[]) {
      if (card.level <= 4) expect(card.atk, card.id).toBeLessThanOrEqual(1900);
      if (card.level >= 7) expect(card.atk, card.id).toBeGreaterThanOrEqual(2300);
    }
  });

  it('10 Spells/Traps: 6 Spells + 4 Traps, each with effect data and bilingual text', () => {
    const cards = SPELL_TRAP_IDS.map(get);
    expect(cards.filter((c) => c.kind === 'Spell')).toHaveLength(6);
    expect(cards.filter((c) => c.kind === 'Trap')).toHaveLength(4);
    for (const card of cards) {
      expect(card.effects?.length, card.id).toBe(1);
      expect(card.effectText, card.id).toBeDefined();
      expect(card.scriptId, card.id).toBeUndefined();
    }
  });
});
