import { describe, expect, it } from 'vitest';
import type { EffectDefinition } from '../effects/effect-definition.js';
import {
  CardDefinitionSchema,
  type CardDefinition,
  type MonsterCardDefinition,
} from './card-definition.js';
import { SAMPLE_CARDS } from './sample-cards.js';

/*
 * Task 4.7 — card batch 2: 26 cards built ONLY from the effect DSL that already exists (no new primitive, no engine
 * change): 12 Effect Monsters (SMP-048…059), 2 Fusion Monsters (SMP-060, SMP-061), 8 Spells (SMP-117…124) and 4 Traps
 * (SMP-211…214). Appended at the end of SAMPLE_CARDS: the 73 older cards keep their index.
 */

const range = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => `SMP-${String(from + i).padStart(3, '0')}`);

const MONSTER_IDS = range(48, 59);
const FUSION_IDS = range(60, 61);
const SPELL_IDS = range(117, 124);
const TRAP_IDS = range(211, 214);
const BATCH2_IDS = [...MONSTER_IDS, ...FUSION_IDS, ...SPELL_IDS, ...TRAP_IDS];

/** The ids of the 73 cards that existed before this task, in their SAMPLE_CARDS order. */
const OLDER_IDS = [
  ...range(1, 44),
  ...range(101, 115),
  ...range(201, 210),
  'SMP-045',
  'SMP-046',
  'SMP-116',
  'SMP-047',
];

const byId = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const get = (id: string): CardDefinition => {
  const card = byId.get(id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
};
const monster = (id: string): MonsterCardDefinition => {
  const card = get(id);
  if (card.kind !== 'Monster') throw new Error(`${id} is not a monster`);
  return card;
};
const effect = (id: string, effectId: string): EffectDefinition => {
  const found = get(id).effects?.find((e) => e.id === effectId);
  if (!found) throw new Error(`${id} has no effect ${effectId}`);
  return found;
};
const batch = (): CardDefinition[] => BATCH2_IDS.map(get);
const allEffects = (): EffectDefinition[] => batch().flatMap((c) => c.effects ?? []);

describe('card batch 2 — the pool', () => {
  it('the 73 older cards keep their index; the 26 new ones follow, in id order per group', () => {
    const ids = SAMPLE_CARDS.map((c) => c.id);
    expect(ids.slice(0, 73)).toEqual(OLDER_IDS);
    expect(ids.slice(73)).toEqual(BATCH2_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every new card parses, has bilingual name + effect text, and no scriptId (Tier B: DSL only)', () => {
    for (const card of batch()) {
      expect(CardDefinitionSchema.safeParse(card).success, card.id).toBe(true);
      expect(card.name.vi.length, card.id).toBeGreaterThan(0);
      expect(card.name.en.length, card.id).toBeGreaterThan(0);
      expect(card.effectText?.vi.length ?? 0, card.id).toBeGreaterThan(0);
      expect(card.effectText?.en.length ?? 0, card.id).toBeGreaterThan(0);
      expect(card.scriptId, card.id).toBeUndefined();
      for (const e of card.effects ?? []) expect(e.scriptId, `${card.id} ${e.id}`).toBeUndefined();
    }
  });

  it('names are unique across the whole pool (vi and en)', () => {
    for (const lang of ['vi', 'en'] as const) {
      const names = SAMPLE_CARDS.map((c) => c.name[lang]);
      expect(new Set(names).size, lang).toBe(names.length);
    }
  });

  it('12 Effect Monsters + 2 Fusion Monsters, 8 Spells, 4 Traps with the planned sub types', () => {
    for (const id of MONSTER_IDS) expect(monster(id).category, id).toBe('Effect');
    for (const id of FUSION_IDS) expect(monster(id).category, id).toBe('Fusion');
    expect(SPELL_IDS.map((id) => [get(id).kind, (get(id) as { subType: string }).subType])).toEqual(
      [
        ['Spell', 'Normal'],
        ['Spell', 'Normal'],
        ['Spell', 'QuickPlay'],
        ['Spell', 'QuickPlay'],
        ['Spell', 'Equip'],
        ['Spell', 'Equip'],
        ['Spell', 'Continuous'],
        ['Spell', 'Field'],
      ],
    );
    expect(TRAP_IDS.map((id) => [get(id).kind, (get(id) as { subType: string }).subType])).toEqual([
      ['Trap', 'Normal'],
      ['Trap', 'Normal'],
      ['Trap', 'Continuous'],
      ['Trap', 'Counter'],
    ]);
  });

  it('[DECISION] owner, 2026-10-08: classic power level — no monster of the batch above 2500 ATK, Level 1–4 at 1900 or less', () => {
    for (const id of [...MONSTER_IDS, ...FUSION_IDS]) {
      const card = monster(id);
      expect(card.atk, id).toBeLessThanOrEqual(2500);
      if (card.level <= 4) expect(card.atk, id).toBeLessThanOrEqual(1900);
    }
  });

  it('no monster of the batch has an Ignition / Quick effect (the engine cannot activate a monster on the field yet)', () => {
    for (const id of [...MONSTER_IDS, ...FUSION_IDS]) {
      for (const e of get(id).effects ?? []) {
        expect(['OnSummon', 'OnFlip', 'OnDestroyed', 'Continuous'], `${id} ${e.id}`).toContain(
          e.trigger.kind,
        );
      }
    }
  });
});

describe('card batch 2 — Effect Monsters', () => {
  it('SMP-048: OnSummon mandatory, heal 500', () => {
    expect(monster('SMP-048')).toMatchObject({ level: 3, atk: 1100, def: 1300, race: 'Aqua' });
    expect(get('SMP-048').effects).toEqual([
      {
        id: 'mend-on-summon',
        trigger: { kind: 'OnSummon', mandatory: true },
        operations: [{ kind: 'Heal', amount: 500, target: 'self' }],
      },
    ]);
  });

  it('SMP-049: OnSummon optional, pay 800 LP, destroy 1 face-up Level 4 or lower opponent monster', () => {
    expect(monster('SMP-049')).toMatchObject({ level: 4, atk: 1300, def: 1000 });
    expect(get('SMP-049').effects).toEqual([
      {
        id: 'marked-shot',
        trigger: { kind: 'OnSummon' },
        cost: [{ kind: 'PayLP', amount: 800 }],
        target: {
          kind: 'Card',
          zone: 'MonsterZone',
          side: 'opponent',
          count: 1,
          filter: { level: { max: 4 } },
        },
        operations: [{ kind: 'Destroy' }],
      },
    ]);
  });

  it('SMP-050: OnSummon optional, Special Summon 1 Level 3 or lower monster from the hand in Defense', () => {
    expect(monster('SMP-050')).toMatchObject({ level: 4, atk: 1400, def: 1000, race: 'Beast' });
    expect(get('SMP-050').effects).toEqual([
      {
        id: 'call-the-pack',
        trigger: { kind: 'OnSummon' },
        target: {
          kind: 'Card',
          zone: 'Hand',
          side: 'self',
          count: 1,
          filter: { kind: 'Monster', level: { max: 3 } },
        },
        operations: [{ kind: 'SpecialSummon', position: 'DefenseUp' }],
      },
    ]);
  });

  it('SMP-051 / 052 / 053: three OnFlip effects (draw, destroy a Spell/Trap, burn)', () => {
    expect(get('SMP-051').effects).toEqual([
      {
        id: 'flip-draw',
        trigger: { kind: 'OnFlip', mandatory: true },
        operations: [{ kind: 'Draw', count: 1, target: 'self' }],
      },
    ]);
    expect(get('SMP-052').effects).toEqual([
      {
        id: 'flip-burrow',
        trigger: { kind: 'OnFlip' },
        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ]);
    expect(get('SMP-053').effects).toEqual([
      {
        id: 'flip-burst',
        trigger: { kind: 'OnFlip', mandatory: true },
        operations: [{ kind: 'Damage', amount: 600, target: 'opponent' }],
      },
    ]);
    for (const id of ['SMP-051', 'SMP-052', 'SMP-053']) {
      // A flip monster is Set first: it must not need a Tribute, and its DEF is what protects it.
      expect(monster(id).level, id).toBeLessThanOrEqual(4);
      expect(monster(id).def, id).toBeGreaterThan(monster(id).atk);
    }
  });

  it('SMP-054: OnDestroyed optional, Special Summon 1 Level 4 or lower monster from its owner graveyard — it is Level 5, so never itself', () => {
    expect(monster('SMP-054')).toMatchObject({ level: 5, atk: 2000, def: 1500, race: 'Zombie' });
    const e = effect('SMP-054', 'raise-retainer');
    expect(e).toEqual({
      id: 'raise-retainer',
      trigger: { kind: 'OnDestroyed' },
      target: {
        kind: 'Card',
        zone: 'Graveyard',
        side: 'self',
        count: 1,
        filter: { kind: 'Monster', level: { max: 4 } },
      },
      operations: [{ kind: 'SpecialSummon', position: 'DefenseUp' }],
    });
    const max = e.target?.kind === 'Card' ? (e.target.filter?.level?.max ?? 99) : 99;
    expect(monster('SMP-054').level).toBeGreaterThan(max);
  });

  it('SMP-055: OnDestroyed mandatory, 500 damage; SMP-056: OnDestroyed optional, pay 500 LP, draw 1 (no target)', () => {
    expect(get('SMP-055').effects).toEqual([
      {
        id: 'blast-on-destroyed',
        trigger: { kind: 'OnDestroyed', mandatory: true },
        operations: [{ kind: 'Damage', amount: 500, target: 'opponent' }],
      },
    ]);
    expect(get('SMP-056').effects).toEqual([
      {
        id: 'last-spark',
        trigger: { kind: 'OnDestroyed' },
        cost: [{ kind: 'PayLP', amount: 500 }],
        operations: [{ kind: 'Draw', count: 1, target: 'self' }],
      },
    ]);
  });

  it('SMP-057 / 058 / 059: Continuous effects filtered by race or attribute', () => {
    expect(monster('SMP-057')).toMatchObject({ race: 'Beast' });
    expect(get('SMP-057').effects).toEqual([
      {
        id: 'pack-leader',
        trigger: { kind: 'Continuous' },
        operations: [
          {
            kind: 'ModifyStat',
            stat: 'atk',
            amount: 200,
            side: 'self',
            filter: { race: 'Beast' },
            excludeSource: true,
          },
        ],
      },
    ]);
    expect(get('SMP-058').effects).toEqual([
      {
        id: 'devour-light',
        trigger: { kind: 'Continuous' },
        operations: [
          {
            kind: 'ModifyStat',
            stat: 'atk',
            amount: -400,
            side: 'opponent',
            filter: { attribute: 'LIGHT' },
          },
        ],
      },
    ]);
    expect(monster('SMP-059')).toMatchObject({ race: 'Rock' });
    expect(get('SMP-059').effects).toEqual([
      {
        id: 'raise-ramparts',
        trigger: { kind: 'Continuous' },
        operations: [
          { kind: 'ModifyStat', stat: 'def', amount: 400, side: 'self', filter: { race: 'Rock' } },
        ],
      },
    ]);
  });
});

describe('card batch 2 — Fusion Monsters', () => {
  it('SMP-060 = SMP-057 + SMP-050 (no effect); SMP-061 = SMP-058 + SMP-054 (Continuous: opponent monsters lose 200 ATK)', () => {
    expect(monster('SMP-060')).toMatchObject({
      level: 6,
      atk: 2400,
      def: 1800,
      fusionMaterials: ['SMP-057', 'SMP-050'],
    });
    expect(get('SMP-060').effects).toBeUndefined();
    expect(monster('SMP-061')).toMatchObject({
      level: 7,
      atk: 2500,
      def: 2000,
      fusionMaterials: ['SMP-058', 'SMP-054'],
    });
    expect(get('SMP-061').effects).toEqual([
      {
        id: 'dread-aura',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'atk', amount: -200, side: 'opponent' }],
      },
    ]);
  });

  it('every material is an Effect Monster of this batch, and the effect text names it', () => {
    for (const id of FUSION_IDS) {
      const card = monster(id);
      for (const m of card.fusionMaterials ?? []) {
        expect(MONSTER_IDS, `${id} material ${m}`).toContain(m);
        expect(card.effectText?.vi, id).toContain(get(m).name.vi);
        expect(card.effectText?.en, id).toContain(get(m).name.en);
      }
    }
  });
});

describe('card batch 2 — Spells', () => {
  it('SMP-117: Normal, discard 1, destroy 1 face-up Level 4 or lower opponent monster', () => {
    expect(get('SMP-117').effects).toEqual([
      {
        id: 'culling',
        trigger: { kind: 'Ignition' },
        cost: [{ kind: 'Discard', count: 1 }],
        target: {
          kind: 'Card',
          zone: 'MonsterZone',
          side: 'opponent',
          count: 1,
          filter: { level: { max: 4 } },
        },
        operations: [{ kind: 'Destroy' }],
      },
    ]);
  });

  it('SMP-118: Normal, Tribute 1, draw 2', () => {
    expect(get('SMP-118').effects).toEqual([
      {
        id: 'offering-draw',
        trigger: { kind: 'Ignition' },
        cost: [{ kind: 'Tribute', count: 1 }],
        operations: [{ kind: 'Draw', count: 2, target: 'self' }],
      },
    ]);
  });

  it('SMP-119: Quick-Play, destroy 1 Spell/Trap; SMP-120: Quick-Play, Special Summon 1 Level 4 or lower monster from the hand in Defense', () => {
    expect(get('SMP-119').effects).toEqual([
      {
        id: 'snap-gust',
        trigger: { kind: 'Quick' },
        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ]);
    expect(get('SMP-120').effects).toEqual([
      {
        id: 'ambush',
        trigger: { kind: 'Quick' },
        target: {
          kind: 'Card',
          zone: 'Hand',
          side: 'self',
          count: 1,
          filter: { kind: 'Monster', level: { max: 4 } },
        },
        operations: [{ kind: 'SpecialSummon', position: 'DefenseUp' }],
      },
    ]);
  });

  it('SMP-121: Equip to your own monster, +300 ATK and +700 DEF', () => {
    expect(get('SMP-121').effects).toEqual([
      {
        id: 'equip',
        trigger: { kind: 'Ignition' },
        target: {
          kind: 'Card',
          zone: 'MonsterZone',
          side: 'self',
          count: 1,
          filter: { kind: 'Monster' },
        },
        operations: [{ kind: 'Equip' }],
      },
      {
        id: 'equip-boost',
        trigger: { kind: 'Continuous' },
        operations: [
          { kind: 'ModifyStat', stat: 'atk', amount: 300, equipped: true },
          { kind: 'ModifyStat', stat: 'def', amount: 700, equipped: true },
        ],
      },
    ]);
  });

  it("SMP-122: Equip to an OPPONENT's monster, −600 ATK (the first real Equip aimed at the other side)", () => {
    expect(get('SMP-122').effects).toEqual([
      {
        id: 'equip',
        trigger: { kind: 'Ignition' },
        target: {
          kind: 'Card',
          zone: 'MonsterZone',
          side: 'opponent',
          count: 1,
          filter: { kind: 'Monster' },
        },
        operations: [{ kind: 'Equip' }],
      },
      {
        id: 'equip-drain',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'atk', amount: -600, equipped: true }],
      },
    ]);
  });

  it('SMP-123: Continuous Spell — heal 500 when activated, then your DARK monsters gain 300 ATK', () => {
    expect(get('SMP-123').effects).toEqual([
      {
        id: 'activate',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'Heal', amount: 500, target: 'self' }],
      },
      {
        id: 'dusk-boost',
        trigger: { kind: 'Continuous' },
        operations: [
          {
            kind: 'ModifyStat',
            stat: 'atk',
            amount: 300,
            side: 'self',
            filter: { attribute: 'DARK' },
          },
        ],
      },
    ]);
  });

  it('SMP-124: Field Spell — every EARTH monster on both sides gains 200 ATK and 200 DEF', () => {
    expect(effect('SMP-124', 'activate')).toEqual({
      id: 'activate',
      trigger: { kind: 'Ignition' },
      operations: [],
    });
    const ops = effect('SMP-124', 'loam-boost').operations;
    expect(ops).toHaveLength(4);
    for (const stat of ['atk', 'def'] as const) {
      for (const side of ['self', 'opponent'] as const) {
        expect(ops).toContainEqual({
          kind: 'ModifyStat',
          stat,
          amount: 200,
          side,
          filter: { attribute: 'EARTH' },
        });
      }
    }
  });
});

describe('card batch 2 — Traps', () => {
  it('SMP-211: Normal Trap, discard 1, Special Summon 1 monster from your graveyard in Defense', () => {
    expect(get('SMP-211').effects).toEqual([
      {
        id: 'second-rising',
        trigger: { kind: 'Quick' },
        cost: [{ kind: 'Discard', count: 1 }],
        target: {
          kind: 'Card',
          zone: 'Graveyard',
          side: 'self',
          count: 1,
          filter: { kind: 'Monster' },
        },
        operations: [{ kind: 'SpecialSummon', position: 'DefenseUp' }],
      },
    ]);
  });

  it("SMP-212: Normal Trap that negates a MONSTER effect's activation (Spell Speed 2, not a Counter Trap)", () => {
    expect(get('SMP-212').effects).toEqual([
      {
        id: 'hush',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'NegateActivation', cardKinds: ['Monster'] }],
      },
    ]);
  });

  it('SMP-213: Continuous Trap — your monsters gain 400 DEF', () => {
    expect(get('SMP-213').effects).toEqual([
      { id: 'activate', trigger: { kind: 'Quick' }, operations: [] },
      {
        id: 'shield-wall',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'def', amount: 400, side: 'self' }],
      },
    ]);
  });

  it('SMP-214: Counter Trap, discard 1, negates a SPELL activation only (SMP-209 pays LP and also stops Traps)', () => {
    expect(get('SMP-214').effects).toEqual([
      {
        id: 'spell-ward',
        trigger: { kind: 'Quick' },
        cost: [{ kind: 'Discard', count: 1 }],
        operations: [{ kind: 'NegateActivation', cardKinds: ['Spell'] }],
      },
    ]);
    expect(effect('SMP-209', 'sealing-rune').operations).toEqual([
      { kind: 'NegateActivation', cardKinds: ['Spell', 'Trap'] },
    ]);
  });
});

describe('card batch 2 — every existing mechanism is used', () => {
  const countTrigger = (kind: string, mandatory?: boolean): number =>
    allEffects().filter(
      (e) =>
        e.trigger.kind === kind &&
        (mandatory === undefined ||
          ('mandatory' in e.trigger && e.trigger.mandatory === true) === mandatory),
    ).length;
  const countOp = (kind: string): number =>
    allEffects().filter((e) => e.operations.some((o) => o.kind === kind)).length;
  const countCost = (kind: string): number =>
    allEffects().filter((e) => (e.cost ?? []).some((c) => c.kind === kind)).length;

  it('triggers: OnSummon / OnFlip / OnDestroyed each mandatory and optional, Continuous, Ignition, Quick', () => {
    for (const kind of ['OnSummon', 'OnFlip', 'OnDestroyed']) {
      expect(countTrigger(kind, true), `${kind} mandatory`).toBeGreaterThanOrEqual(1);
      expect(countTrigger(kind, false), `${kind} optional`).toBeGreaterThanOrEqual(1);
      expect(countTrigger(kind), kind).toBeGreaterThanOrEqual(3);
    }
    for (const kind of ['Continuous', 'Ignition', 'Quick']) {
      expect(countTrigger(kind), kind).toBeGreaterThanOrEqual(2);
    }
  });

  it('operations used at least twice: Damage, Heal, Draw, Destroy, SpecialSummon, Equip, ModifyStat, NegateActivation', () => {
    for (const kind of [
      'Damage',
      'Heal',
      'Draw',
      'Destroy',
      'SpecialSummon',
      'Equip',
      'ModifyStat',
      'NegateActivation',
    ]) {
      expect(countOp(kind), kind).toBeGreaterThanOrEqual(2);
    }
  });

  it('costs: Discard and PayLP at least twice, Tribute once; a trigger effect only ever pays LP', () => {
    expect(countCost('Discard')).toBeGreaterThanOrEqual(2);
    expect(countCost('PayLP')).toBeGreaterThanOrEqual(2);
    expect(countCost('Tribute')).toBe(1);
    for (const e of allEffects()) {
      if (['OnSummon', 'OnFlip', 'OnDestroyed'].includes(e.trigger.kind)) {
        expect(
          (e.cost ?? []).every((c) => c.kind === 'PayLP'),
          e.id,
        ).toBe(true);
      }
    }
  });

  it('filters by level, race and attribute, and targets in the hand and the graveyard, are all used', () => {
    const filters = JSON.stringify(batch().map((c) => c.effects ?? []));
    for (const needle of [
      '"level"',
      '"race"',
      '"attribute"',
      '"zone":"Hand"',
      '"zone":"Graveyard"',
    ]) {
      expect(filters, needle).toContain(needle);
    }
  });

  it('stated exception (task 4.7): no new card uses NegateAttack, NegateSummon or FusionSummon', () => {
    for (const kind of ['NegateAttack', 'NegateSummon', 'FusionSummon']) {
      expect(countOp(kind), kind).toBe(0);
    }
  });
});
