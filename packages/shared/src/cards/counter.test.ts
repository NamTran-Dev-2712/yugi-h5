import { describe, expect, it } from 'vitest';
import type { CardDefinition } from './card-definition.js';
import { CardDefinitionSchema, staysOnField } from './card-definition.js';
import { SAMPLE_CARDS } from './sample-cards.js';
import { STARTER_DECK } from '../deck/starter-deck.js';

/*
 * Task 4.4 — the Negate cards (Tier B, DSL only): SMP-201 (Normal Trap, negates an attack; no longer a placeholder),
 * SMP-209 (Counter Trap, pay 1000 LP: negates the activation of a Spell/Trap), SMP-210 (Counter Trap, negates a Summon).
 */

const byId = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const get = (id: string): CardDefinition => {
  const card = byId.get(id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
};
const IDS = ['SMP-201', 'SMP-209', 'SMP-210'];

describe('task 4.4 cards', () => {
  it('exist once, parse, have bilingual text, no script, and are not in the starter deck', () => {
    const ids = SAMPLE_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of IDS) {
      const card = get(id);
      expect(CardDefinitionSchema.safeParse(card).success, id).toBe(true);
      expect(card.name.vi, id).toBeTruthy();
      expect(card.name.en, id).toBeTruthy();
      expect(card.effectText?.vi, id).toBeTruthy();
      expect(card.effectText?.en, id).toBeTruthy();
      expect(card.effectText?.en, id).not.toMatch(/placeholder/i);
      expect(card.scriptId, id).toBeUndefined();
      expect(staysOnField(card), id).toBe(false);
      expect(STARTER_DECK, id).not.toContain(id);
    }
  });

  it('the new cards were appended at the END of the list (ids of older cards keep their place)', () => {
    // Task 4.5 appended its own cards after these two (cards/fusion.test.ts).
    const ids = SAMPLE_CARDS.map((c) => c.id);
    const at = ids.indexOf('SMP-209');
    expect(ids.slice(at, at + 2)).toEqual(['SMP-209', 'SMP-210']);
    expect(ids.slice(0, at)).not.toContain('SMP-116');
  });

  it('SMP-201 keeps its id and name: a Normal Trap (Spell Speed 2) that negates an attack', () => {
    const card = get('SMP-201');
    expect(card).toMatchObject({
      kind: 'Trap',
      subType: 'Normal',
      name: { vi: 'Rào Chắn Hộ Vệ', en: 'Guardian Barrier' },
    });
    expect(card.effects).toEqual([
      {
        id: 'guardian-barrier',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'NegateAttack' }],
      },
    ]);
  });

  it('SMP-209: a Counter Trap, cost 1000 LP, negates the activation of a Spell or Trap', () => {
    const card = get('SMP-209');
    expect(card).toMatchObject({ kind: 'Trap', subType: 'Counter' });
    expect(card.effects).toEqual([
      {
        id: 'sealing-rune',
        trigger: { kind: 'Quick' },
        cost: [{ kind: 'PayLP', amount: 1000 }],
        operations: [{ kind: 'NegateActivation', cardKinds: ['Spell', 'Trap'] }],
      },
    ]);
    // Spell Speed 3 comes from the sub type: nothing explicit on the effect.
    expect(card.effects?.[0]?.spellSpeed).toBeUndefined();
  });

  it('SMP-210: a Counter Trap that negates a Summon (no cost)', () => {
    const card = get('SMP-210');
    expect(card).toMatchObject({ kind: 'Trap', subType: 'Counter' });
    expect(card.effects).toEqual([
      { id: 'gate-of-refusal', trigger: { kind: 'Quick' }, operations: [{ kind: 'NegateSummon' }] },
    ]);
  });
});
