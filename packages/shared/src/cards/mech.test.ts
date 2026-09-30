import { describe, expect, it } from 'vitest';
import type { CardDefinition, MonsterCardDefinition } from './card-definition.js';
import { CardDefinitionSchema } from './card-definition.js';
import { SAMPLE_CARDS } from './sample-cards.js';

/*
 * Task 4.2d — the first real cards using the 4.2a/b/c mechanics (Tier B, existing DSL only): SMP-044 (OnFlip),
 * SMP-111 (Special Summon from your hand OR your graveyard: one effect each) and SMP-112 (Equip Spell).
 */

const byId = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const get = (id: string): CardDefinition => {
  const card = byId.get(id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
};

describe('task 4.2d mechanic cards', () => {
  it('exist once, parse, and have bilingual effect text', () => {
    const ids = SAMPLE_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['SMP-044', 'SMP-111', 'SMP-112']) {
      const card = get(id);
      expect(CardDefinitionSchema.safeParse(card).success, id).toBe(true);
      expect(card.effectText?.vi, id).toBeTruthy();
      expect(card.effectText?.en, id).toBeTruthy();
      expect(card.scriptId, id).toBeUndefined();
    }
  });

  it('SMP-044: an Effect Monster whose only effect is an OnFlip trigger', () => {
    const card = get('SMP-044') as MonsterCardDefinition;
    expect(card.kind).toBe('Monster');
    expect(card.category).toBe('Effect');
    expect(card.level).toBeLessThanOrEqual(4);
    expect(card.effects?.map((e) => e.trigger.kind)).toEqual(['OnFlip']);
  });

  it('SMP-111: a Normal Spell with two Special Summon effects, one from the hand and one from the graveyard', () => {
    const card = get('SMP-111');
    expect(card.kind).toBe('Spell');
    if (card.kind !== 'Spell') return;
    expect(card.subType).toBe('Normal');
    const effects = card.effects ?? [];
    expect(effects).toHaveLength(2);
    const zones = effects.map((e) => (e.target?.kind === 'Card' ? e.target.zone : null));
    expect(zones).toEqual(['Hand', 'Graveyard']);
    for (const e of effects) {
      expect(e.trigger.kind).toBe('Ignition');
      expect(e.operations.map((o) => o.kind)).toEqual(['SpecialSummon']);
      expect(e.target).toMatchObject({ side: 'self', count: 1, filter: { kind: 'Monster' } });
    }
  });

  it('SMP-112: an Equip Spell that equips to your face-up monster and raises its ATK', () => {
    const card = get('SMP-112');
    expect(card.kind).toBe('Spell');
    if (card.kind !== 'Spell') return;
    expect(card.subType).toBe('Equip');
    const [equip, modify] = card.effects ?? [];
    expect(equip?.operations.map((o) => o.kind)).toEqual(['Equip']);
    expect(equip?.target).toMatchObject({ zone: 'MonsterZone', side: 'self', count: 1 });
    expect(modify?.trigger.kind).toBe('Continuous');
    expect(modify?.operations).toEqual([
      { kind: 'ModifyStat', stat: 'atk', amount: 500, equipped: true },
    ]);
  });
});
