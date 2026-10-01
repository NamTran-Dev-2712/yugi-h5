import { describe, expect, it } from 'vitest';
import type { CardDefinition } from './card-definition.js';
import { CardDefinitionSchema, staysOnField } from './card-definition.js';
import { SAMPLE_CARDS } from './sample-cards.js';
import { STARTER_DECK } from '../deck/starter-deck.js';

/*
 * Task 4.3 — the first real cards that stay on the field (Tier B, existing DSL only): SMP-113 (Field Spell), SMP-114
 * (Continuous Spell), SMP-208 (Continuous Trap), plus SMP-115, a plain Normal Spell used for "Set, then activate".
 */

const byId = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const get = (id: string): CardDefinition => {
  const card = byId.get(id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
};
const IDS = ['SMP-113', 'SMP-114', 'SMP-115', 'SMP-208'];

describe('task 4.3 cards', () => {
  it('exist once, parse, have bilingual effect text, and are not in the starter deck', () => {
    const ids = SAMPLE_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of IDS) {
      const card = get(id);
      expect(CardDefinitionSchema.safeParse(card).success, id).toBe(true);
      expect(card.effectText?.vi, id).toBeTruthy();
      expect(card.effectText?.en, id).toBeTruthy();
      expect(card.scriptId, id).toBeUndefined();
      expect(STARTER_DECK, id).not.toContain(id);
    }
  });

  it.each([
    ['SMP-113', 'Spell', 'Field', 'Ignition'],
    ['SMP-114', 'Spell', 'Continuous', 'Ignition'],
    ['SMP-208', 'Trap', 'Continuous', 'Quick'],
  ])(
    '%s: a %s %s — an empty activation effect, then a Continuous ModifyStat',
    (id, kind, subType, trigger) => {
      const card = get(id);
      expect(card.kind).toBe(kind);
      if (card.kind === 'Monster') return;
      expect(card.subType).toBe(subType);
      expect(staysOnField(card)).toBe(true);
      const [activate, aura] = card.effects ?? [];
      expect(activate).toMatchObject({ trigger: { kind: trigger }, operations: [] });
      expect(aura?.trigger.kind).toBe('Continuous');
      expect(aura?.operations.every((o) => o.kind === 'ModifyStat')).toBe(true);
    },
  );

  it('SMP-113 boosts WIND monsters on BOTH sides by 300 ATK', () => {
    expect(get('SMP-113').effects?.[1]?.operations).toEqual([
      { kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self', filter: { attribute: 'WIND' } },
      {
        kind: 'ModifyStat',
        stat: 'atk',
        amount: 300,
        side: 'opponent',
        filter: { attribute: 'WIND' },
      },
    ]);
  });

  it('SMP-114 boosts your Warriors by 300 ATK; SMP-208 weakens the opponent by 300 ATK', () => {
    expect(get('SMP-114').effects?.[1]?.operations).toEqual([
      { kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self', filter: { race: 'Warrior' } },
    ]);
    expect(get('SMP-208').effects?.[1]?.operations).toEqual([
      { kind: 'ModifyStat', stat: 'atk', amount: -300, side: 'opponent' },
    ]);
  });

  it('SMP-115: a Normal Spell that inflicts 600 damage (goes to the graveyard after resolving)', () => {
    const card = get('SMP-115');
    expect(card).toMatchObject({ kind: 'Spell', subType: 'Normal' });
    expect(staysOnField(card)).toBe(false);
    expect(card.effects).toEqual([
      {
        id: 'ember-burn',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'Damage', amount: 600, target: 'opponent' }],
      },
    ]);
  });
});
