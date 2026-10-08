import { describe, expect, it } from 'vitest';
import type { CardDefinition, MonsterCardDefinition } from './card-definition.js';
import { CardDefinitionSchema } from './card-definition.js';
import { SAMPLE_CARDS } from './sample-cards.js';
import { EffectDefinitionSchema } from '../effects/effect-definition.js';
import { OperationSchema } from '../effects/operation.js';
import { OPERATION_REGISTRY } from '../effects/registry.js';
import { STARTER_DECK } from '../deck/starter-deck.js';

/*
 * Task 4.5 — Fusion: `fusionMaterials` on a Fusion Monster (named materials only [DECISION]), the `FusionSummon`
 * operation, and the first real cards: SMP-116 (the fusion Spell), SMP-045 / SMP-046 (Fusion Monsters).
 */

const byId = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const get = (id: string): CardDefinition => {
  const card = byId.get(id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
};

const ok = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  expect(s.safeParse(v).success).toBe(true);
const bad = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  expect(s.safeParse(v).success).toBe(false);

const monster = (extra: Record<string, unknown>) => ({
  id: 'T-FUS',
  kind: 'Monster',
  name: { vi: 'Thử', en: 'Test' },
  category: 'Fusion',
  attribute: 'DARK',
  race: 'Fiend',
  level: 6,
  atk: 2000,
  def: 1500,
  ...extra,
});

const fusionEffect = (extra: Record<string, unknown> = {}) => ({
  id: 'fuse',
  trigger: { kind: 'Ignition' },
  operations: [{ kind: 'FusionSummon', sources: ['Hand', 'Field'] }],
  ...extra,
});

const spell = (subType: string, effect: unknown) => ({
  id: 'T-FUS-SPELL',
  kind: 'Spell',
  name: { vi: 'Thử', en: 'Test' },
  subType,
  effects: [effect],
});

describe('fusionMaterials (task 4.5)', () => {
  it('a Fusion Monster lists at least 2 named materials (a repeated id is allowed)', () => {
    ok(CardDefinitionSchema, monster({ fusionMaterials: ['SMP-001', 'SMP-007'] }));
    ok(CardDefinitionSchema, monster({ fusionMaterials: ['SMP-001', 'SMP-001', 'SMP-007'] }));
    bad(CardDefinitionSchema, monster({ fusionMaterials: ['SMP-001'] }));
    bad(CardDefinitionSchema, monster({ fusionMaterials: [] }));
    bad(CardDefinitionSchema, monster({ fusionMaterials: ['SMP-001', ''] }));
  });

  it('a Fusion Monster without materials, or materials on another category, is rejected', () => {
    bad(CardDefinitionSchema, monster({}));
    bad(
      CardDefinitionSchema,
      monster({ category: 'Normal', fusionMaterials: ['SMP-001', 'SMP-007'] }),
    );
    bad(
      CardDefinitionSchema,
      monster({ category: 'Effect', fusionMaterials: ['SMP-001', 'SMP-007'] }),
    );
  });
});

describe('FusionSummon operation (task 4.5)', () => {
  it('takes its material sources as a parameter', () => {
    ok(OperationSchema, { kind: 'FusionSummon', sources: ['Hand', 'Field'] });
    ok(OperationSchema, { kind: 'FusionSummon', sources: ['Deck'] });
    ok(OperationSchema, {
      kind: 'FusionSummon',
      sources: ['Hand', 'Field', 'Deck'],
      position: 'DefenseUp',
    });
    bad(OperationSchema, { kind: 'FusionSummon' });
    bad(OperationSchema, { kind: 'FusionSummon', sources: [] });
    bad(OperationSchema, { kind: 'FusionSummon', sources: ['Hand', 'Hand'] });
    bad(OperationSchema, { kind: 'FusionSummon', sources: ['Graveyard'] });
    bad(OperationSchema, { kind: 'FusionSummon', sources: ['Hand'], position: 'DefenseDown' });
    bad(OperationSchema, { kind: 'FusionSummon', sources: ['Hand'], extra: 1 });
    expect(OPERATION_REGISTRY.FusionSummon).toEqual({ implemented: true, timing: 'resolve' });
  });

  it('is the only operation of an Ignition effect without a target, Spell Speed 1', () => {
    ok(EffectDefinitionSchema, fusionEffect());
    ok(EffectDefinitionSchema, fusionEffect({ spellSpeed: 1 }));
    ok(EffectDefinitionSchema, fusionEffect({ cost: [{ kind: 'PayLP', amount: 500 }] }));
    bad(EffectDefinitionSchema, fusionEffect({ trigger: { kind: 'Quick' } }));
    bad(EffectDefinitionSchema, fusionEffect({ trigger: { kind: 'OnSummon' } }));
    bad(EffectDefinitionSchema, fusionEffect({ spellSpeed: 2 }));
    bad(
      EffectDefinitionSchema,
      fusionEffect({
        operations: [
          { kind: 'FusionSummon', sources: ['Hand'] },
          { kind: 'Draw', count: 1, target: 'self' },
        ],
      }),
    );
    bad(
      EffectDefinitionSchema,
      fusionEffect({ target: { kind: 'Card', zone: 'MonsterZone', side: 'self', count: 1 } }),
    );
    bad(EffectDefinitionSchema, fusionEffect({ scriptId: 'anything' }));
  });

  it('belongs to a Normal Spell only', () => {
    ok(CardDefinitionSchema, spell('Normal', fusionEffect()));
    bad(CardDefinitionSchema, spell('QuickPlay', fusionEffect()));
    bad(CardDefinitionSchema, spell('Continuous', fusionEffect()));
    bad(CardDefinitionSchema, {
      ...spell('Normal', fusionEffect()),
      kind: 'Trap',
    });
  });
});

describe('task 4.5 cards', () => {
  const IDS = ['SMP-045', 'SMP-046', 'SMP-116'];

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
      expect(card.scriptId, id).toBeUndefined();
      expect(STARTER_DECK, id).not.toContain(id);
    }
  });

  it('were appended at the END of the list when they were added (index 69–72: older cards keep their place; task 4.5b added SMP-047 after them, task 4.7 its batch after that)', () => {
    expect(SAMPLE_CARDS.slice(69, 73).map((c) => c.id)).toEqual([...IDS, 'SMP-047']);
  });

  it('SMP-045 / SMP-046: Fusion Monsters whose materials are existing non-Fusion monsters (2 and 3 of them)', () => {
    const counts: number[] = [];
    for (const id of ['SMP-045', 'SMP-046']) {
      const card = get(id) as MonsterCardDefinition;
      expect(card.kind, id).toBe('Monster');
      expect(card.category, id).toBe('Fusion');
      expect(card.effects, id).toBeUndefined();
      const materials = card.fusionMaterials ?? [];
      counts.push(materials.length);
      for (const m of materials) {
        const def = get(m);
        expect(def.kind, `${id} <- ${m}`).toBe('Monster');
        if (def.kind === 'Monster') expect(def.category, `${id} <- ${m}`).not.toBe('Fusion');
      }
    }
    expect(counts).toEqual([2, 3]);
  });

  it('only Fusion Monsters carry fusionMaterials, and every Fusion Monster has them', () => {
    for (const card of SAMPLE_CARDS) {
      if (card.kind !== 'Monster') continue;
      expect(card.fusionMaterials !== undefined, card.id).toBe(card.category === 'Fusion');
    }
  });

  it('SMP-116: a Normal Spell that Fusion Summons with materials from the hand or the field, no cost', () => {
    const card = get('SMP-116');
    expect(card.kind).toBe('Spell');
    if (card.kind !== 'Spell') return;
    expect(card.subType).toBe('Normal');
    expect(card.effects).toHaveLength(1);
    const [effect] = card.effects ?? [];
    expect(effect?.trigger.kind).toBe('Ignition');
    expect(effect?.cost).toBeUndefined();
    expect(effect?.target).toBeUndefined();
    expect(effect?.operations).toEqual([{ kind: 'FusionSummon', sources: ['Hand', 'Field'] }]);
  });
});

describe('task 4.5b cards', () => {
  it('SMP-047: a Fusion Monster (2 existing non-Fusion materials) with a mandatory "when Summoned" burn', () => {
    const card = get('SMP-047') as MonsterCardDefinition;
    expect(CardDefinitionSchema.safeParse(card).success).toBe(true);
    expect(card.category).toBe('Fusion');
    expect(card.fusionMaterials).toEqual(['SMP-006', 'SMP-009']);
    for (const m of card.fusionMaterials ?? []) {
      const def = get(m);
      expect(def.kind === 'Monster' && def.category !== 'Fusion', m).toBe(true);
    }
    expect(card.name.vi && card.name.en && card.effectText?.vi && card.effectText?.en).toBeTruthy();
    expect(card.scriptId).toBeUndefined();
    expect(card.effects).toEqual([
      {
        id: 'ashveil-burn',
        trigger: { kind: 'OnSummon', mandatory: true },
        operations: [{ kind: 'Damage', amount: 500, target: 'opponent' }],
      },
    ]);
    expect(STARTER_DECK).not.toContain('SMP-047');
  });

  it('[DECISION] brief 4.5b (b): no real card takes fusion materials from the Deck (that source is not on the wire)', () => {
    const fromDeck = SAMPLE_CARDS.filter((c) =>
      (c.effects ?? []).some((e) =>
        e.operations.some((o) => o.kind === 'FusionSummon' && o.sources.includes('Deck')),
      ),
    );
    expect(fromDeck.map((c) => c.id)).toEqual([]);
  });
});
