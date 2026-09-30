import { describe, expect, it } from 'vitest';
import { CardFilterSchema } from './filter.js';
import { TriggerSchema } from './trigger.js';
import { ConditionSchema } from './condition.js';
import { CostSchema } from './cost.js';
import { TargetSchema } from './target.js';
import { OperationSchema } from './operation.js';
import { EffectDefinitionSchema } from './effect-definition.js';
import {
  CONDITION_KINDS,
  CONTINUOUS_OPERATION_KINDS,
  COST_KINDS,
  OPERATION_KINDS,
  OPERATION_REGISTRY,
  TRIGGER_KINDS,
} from './registry.js';
import { CardDefinitionSchema } from '../cards/card-definition.js';
import { SAMPLE_CARDS } from '../cards/sample-cards.js';

const ok = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  expect(s.safeParse(v).success).toBe(true);
const bad = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  expect(s.safeParse(v).success).toBe(false);

describe('CardFilter', () => {
  it('accepts kind/level/attribute/race', () => {
    ok(CardFilterSchema, { kind: 'Monster' });
    ok(CardFilterSchema, { level: { min: 1, max: 4 }, attribute: 'DARK', race: 'Fiend' });
  });
  it('rejects empty, min>max, unknown attribute, unknown key', () => {
    bad(CardFilterSchema, {});
    bad(CardFilterSchema, { level: { min: 5, max: 4 } });
    bad(CardFilterSchema, { level: {} });
    bad(CardFilterSchema, { attribute: 'PLASMA' });
    bad(CardFilterSchema, { race: 'Fiend', bogus: 1 });
  });
});

describe('Trigger', () => {
  it.each(['OnSummon', 'OnFlip', 'Continuous', 'Ignition', 'Quick', 'OnDestroyed'])(
    'accepts %s',
    (kind) => ok(TriggerSchema, { kind }),
  );
  it('rejects unknown kind, missing kind, extra key', () => {
    bad(TriggerSchema, { kind: 'OnDraw' });
    bad(TriggerSchema, {});
    bad(TriggerSchema, { kind: 'OnSummon', by: 'Battle' });
  });
  it('accepts `mandatory` only on OnSummon/OnDestroyed (task 3.5)', () => {
    for (const kind of ['OnSummon', 'OnDestroyed']) {
      ok(TriggerSchema, { kind, mandatory: true });
      ok(TriggerSchema, { kind, mandatory: false });
      bad(TriggerSchema, { kind, mandatory: 'yes' });
    }
    for (const kind of ['OnFlip', 'Continuous', 'Ignition', 'Quick'])
      bad(TriggerSchema, { kind, mandatory: true });
  });
});

describe('Condition', () => {
  it('accepts PhaseIs / IsMyTurn / ZoneCount', () => {
    ok(ConditionSchema, { kind: 'PhaseIs', phase: 'Main1' });
    ok(ConditionSchema, { kind: 'IsMyTurn' });
    ok(ConditionSchema, { kind: 'ZoneCount', zone: 'MonsterZone', side: 'self', min: 1 });
    ok(ConditionSchema, { kind: 'ZoneCount', zone: 'Hand', side: 'opponent', min: 1, max: 3 });
  });
  it('rejects bad phase, missing field, no bounds, min>max, unknown kind', () => {
    bad(ConditionSchema, { kind: 'PhaseIs', phase: 'Main3' });
    bad(ConditionSchema, { kind: 'PhaseIs' });
    bad(ConditionSchema, { kind: 'ZoneCount', zone: 'Hand', side: 'self' });
    bad(ConditionSchema, { kind: 'ZoneCount', zone: 'Hand', side: 'self', min: 3, max: 1 });
    bad(ConditionSchema, { kind: 'ZoneCount', zone: 'Hand', side: 'self', min: '1' });
    bad(ConditionSchema, { kind: 'LPCompare' });
  });
});

describe('Cost', () => {
  it('accepts Discard / Tribute / PayLP', () => {
    ok(CostSchema, { kind: 'Discard', count: 1 });
    ok(CostSchema, { kind: 'Discard', count: 2, filter: { kind: 'Monster' } });
    ok(CostSchema, { kind: 'Tribute', count: 1 });
    ok(CostSchema, { kind: 'PayLP', amount: 500 });
  });
  it('rejects zero/negative/non-integer/wrong type/unknown kind', () => {
    bad(CostSchema, { kind: 'Discard', count: 0 });
    bad(CostSchema, { kind: 'Tribute' });
    bad(CostSchema, { kind: 'PayLP', amount: -1 });
    bad(CostSchema, { kind: 'PayLP', amount: 1.5 });
    bad(CostSchema, { kind: 'PayLP', amount: '500' });
    bad(CostSchema, { kind: 'Banish', count: 1 });
  });
});

describe('Target', () => {
  it('accepts Card and Player', () => {
    ok(TargetSchema, { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 });
    ok(TargetSchema, {
      kind: 'Card',
      zone: 'Graveyard',
      side: 'self',
      count: 2,
      filter: { race: 'Dragon' },
    });
    ok(TargetSchema, { kind: 'Player', who: 'self' });
    ok(TargetSchema, { kind: 'Player', who: 'opponent' });
  });
  it('rejects missing zone/count, bad who, unknown kind', () => {
    bad(TargetSchema, { kind: 'Card', side: 'self', count: 1 });
    bad(TargetSchema, { kind: 'Card', zone: 'MonsterZone', side: 'self', count: 0 });
    bad(TargetSchema, { kind: 'Player', who: 'both' });
    bad(TargetSchema, { kind: 'AllMatching', filter: { kind: 'Monster' } });
  });
});

describe('Operation', () => {
  it('accepts Damage / Heal / Draw / Destroy', () => {
    ok(OperationSchema, { kind: 'Damage', amount: 500, target: 'opponent' });
    ok(OperationSchema, { kind: 'Heal', amount: 1000, target: 'self' });
    ok(OperationSchema, { kind: 'Draw', count: 1, target: 'self' });
    ok(OperationSchema, { kind: 'Destroy' });
  });
  it('rejects bad amount/target/missing field/unknown kind', () => {
    bad(OperationSchema, { kind: 'Damage', amount: 0, target: 'opponent' });
    bad(OperationSchema, { kind: 'Damage', amount: 500 });
    bad(OperationSchema, { kind: 'Damage', amount: 500, target: 'both' });
    bad(OperationSchema, { kind: 'Heal', amount: '5', target: 'self' });
    bad(OperationSchema, { kind: 'Draw', count: 0, target: 'self' });
    bad(OperationSchema, { kind: 'Destroy', extra: 1 });
    bad(OperationSchema, { kind: 'NegateAttack' });
  });
  it('accepts ModifyStat (task 3.6): atk/def, signed non-zero amount, side, optional filter/excludeSource', () => {
    ok(OperationSchema, { kind: 'ModifyStat', stat: 'atk', amount: 500, side: 'self' });
    ok(OperationSchema, { kind: 'ModifyStat', stat: 'def', amount: -300, side: 'opponent' });
    ok(OperationSchema, {
      kind: 'ModifyStat',
      stat: 'atk',
      amount: 10000,
      side: 'self',
      filter: { race: 'Dragon' },
      excludeSource: true,
    });
  });
  it('rejects a malformed ModifyStat', () => {
    const base = { kind: 'ModifyStat', stat: 'atk', amount: 500, side: 'self' };
    bad(OperationSchema, { ...base, amount: 0 });
    bad(OperationSchema, { ...base, amount: 10001 });
    bad(OperationSchema, { ...base, amount: -10001 });
    bad(OperationSchema, { ...base, amount: 1.5 });
    bad(OperationSchema, { ...base, stat: 'level' });
    bad(OperationSchema, { ...base, side: 'both' });
    bad(OperationSchema, { ...base, filter: {} });
    bad(OperationSchema, { ...base, excludeSource: 'yes' });
    bad(OperationSchema, { ...base, target: 'self' });
    const { side: _side, ...noSide } = base;
    bad(OperationSchema, noSide);
  });
});

describe('EffectDefinition', () => {
  const draw = { kind: 'Draw', count: 1, target: 'self' };
  it('accepts the batch-1 examples', () => {
    ok(EffectDefinitionSchema, {
      id: 'on-summon-draw',
      trigger: { kind: 'OnSummon' },
      operations: [draw],
    });
    ok(EffectDefinitionSchema, {
      id: 'ignition-burn',
      trigger: { kind: 'Ignition' },
      condition: [{ kind: 'IsMyTurn' }, { kind: 'PhaseIs', phase: 'Main1' }],
      cost: [{ kind: 'PayLP', amount: 500 }],
      operations: [{ kind: 'Damage', amount: 500, target: 'opponent' }],
    });
    ok(EffectDefinitionSchema, {
      id: 'kill-one',
      trigger: { kind: 'Quick' },
      target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
      operations: [{ kind: 'Destroy' }],
    });
  });
  it('rejects empty/missing operations', () => {
    bad(EffectDefinitionSchema, { id: 'x', trigger: { kind: 'Ignition' }, operations: [] });
    bad(EffectDefinitionSchema, { id: 'x', trigger: { kind: 'Ignition' } });
  });
  it('rejects empty optional arrays, empty id, unknown trigger', () => {
    const base = { id: 'x', trigger: { kind: 'OnSummon' }, operations: [draw] };
    bad(EffectDefinitionSchema, { ...base, condition: [] });
    bad(EffectDefinitionSchema, { ...base, cost: [] });
    bad(EffectDefinitionSchema, { ...base, id: '' });
    bad(EffectDefinitionSchema, { ...base, trigger: { kind: 'Nope' } });
    bad(EffectDefinitionSchema, { ...base, bogus: 1 });
  });
  it('rejects Continuous with cost or target (it never goes on the chain)', () => {
    const buff = { kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self' };
    const base = { id: 'x', trigger: { kind: 'Continuous' }, operations: [buff] };
    ok(EffectDefinitionSchema, base);
    bad(EffectDefinitionSchema, { ...base, cost: [{ kind: 'PayLP', amount: 100 }] });
    bad(EffectDefinitionSchema, { ...base, target: { kind: 'Player', who: 'self' } });
  });
  it('trigger effects (OnSummon/OnDestroyed) may only cost PayLP (task 3.5)', () => {
    for (const kind of ['OnSummon', 'OnDestroyed']) {
      const base = { id: 'x', trigger: { kind }, operations: [draw] };
      ok(EffectDefinitionSchema, { ...base, cost: [{ kind: 'PayLP', amount: 100 }] });
      bad(EffectDefinitionSchema, { ...base, cost: [{ kind: 'Discard', count: 1 }] });
      bad(EffectDefinitionSchema, { ...base, cost: [{ kind: 'Tribute', count: 1 }] });
    }
    ok(EffectDefinitionSchema, {
      id: 'x',
      trigger: { kind: 'Ignition' },
      cost: [{ kind: 'Discard', count: 1 }],
      operations: [draw],
    });
  });
  it('Continuous effects hold only continuous operations, other effects only resolve ones (task 3.6)', () => {
    const buff = { kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self' };
    bad(EffectDefinitionSchema, { id: 'x', trigger: { kind: 'Continuous' }, operations: [draw] });
    bad(EffectDefinitionSchema, {
      id: 'x',
      trigger: { kind: 'Continuous' },
      operations: [buff, draw],
    });
    for (const kind of ['OnSummon', 'OnFlip', 'Ignition', 'Quick', 'OnDestroyed'])
      bad(EffectDefinitionSchema, { id: 'x', trigger: { kind }, operations: [buff] });
  });
  it('accepts an effect-level scriptId (task 3.6); operations may be empty only with a scriptId', () => {
    ok(EffectDefinitionSchema, {
      id: 'x',
      trigger: { kind: 'Ignition' },
      scriptId: 'test.halve-opponent-lp',
      operations: [],
    });
    ok(EffectDefinitionSchema, {
      id: 'x',
      trigger: { kind: 'Quick' },
      scriptId: 's',
      operations: [draw],
    });
    bad(EffectDefinitionSchema, {
      id: 'x',
      trigger: { kind: 'Ignition' },
      scriptId: '',
      operations: [draw],
    });
    bad(EffectDefinitionSchema, {
      id: 'x',
      trigger: { kind: 'Ignition' },
      scriptId: 7,
      operations: [draw],
    });
    // A script runs on resolution: a Continuous effect never resolves.
    bad(EffectDefinitionSchema, {
      id: 'x',
      trigger: { kind: 'Continuous' },
      scriptId: 's',
      operations: [{ kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self' }],
    });
  });
  it('accepts an optional explicit spellSpeed 1|2|3 (task 3.4), nothing else', () => {
    const base = { id: 'x', trigger: { kind: 'Quick' }, operations: [draw] };
    for (const spellSpeed of [1, 2, 3]) ok(EffectDefinitionSchema, { ...base, spellSpeed });
    for (const spellSpeed of [0, 4, 2.5, '2', null])
      bad(EffectDefinitionSchema, { ...base, spellSpeed });
  });
});

describe('registry (metadata only: no functions)', () => {
  it('has one entry per operation kind, metadata only (task 3.2: all batch-1 operations implemented)', () => {
    expect(Object.keys(OPERATION_REGISTRY).sort()).toEqual([...OPERATION_KINDS].sort());
    for (const [kind, entry] of Object.entries(OPERATION_REGISTRY)) {
      expect(entry).toEqual({
        implemented: true,
        timing: kind === 'ModifyStat' ? 'continuous' : 'resolve',
      });
    }
  });
  it('CONTINUOUS_OPERATION_KINDS = the kinds whose timing is continuous (task 3.6)', () => {
    const continuous = Object.entries(OPERATION_REGISTRY)
      .filter(([, e]) => e.timing === 'continuous')
      .map(([k]) => k);
    expect([...CONTINUOUS_OPERATION_KINDS].sort()).toEqual(continuous.sort());
  });
  it('kind lists match the schemas', () => {
    expect([...TRIGGER_KINDS].sort()).toEqual([
      'Continuous',
      'Ignition',
      'OnDestroyed',
      'OnFlip',
      'OnSummon',
      'Quick',
    ]);
    expect([...CONDITION_KINDS].sort()).toEqual(['IsMyTurn', 'PhaseIs', 'ZoneCount']);
    expect([...COST_KINDS].sort()).toEqual(['Discard', 'PayLP', 'Tribute']);
    expect([...OPERATION_KINDS].sort()).toEqual([
      'Damage',
      'Destroy',
      'Draw',
      'Heal',
      'ModifyStat',
      'SpecialSummon',
    ]);
  });
});

describe('CardDefinition with effects + bilingual text', () => {
  const monster = {
    id: 'T-1',
    kind: 'Monster',
    name: { vi: 'Lính', en: 'Soldier' },
    category: 'Effect',
    attribute: 'EARTH',
    race: 'Warrior',
    level: 4,
    atk: 1000,
    def: 1000,
  };
  const eff = (id: string) => ({
    id,
    trigger: { kind: 'OnSummon' },
    operations: [{ kind: 'Draw', count: 1, target: 'self' }],
  });
  it('accepts effects and bilingual effectText', () => {
    ok(CardDefinitionSchema, { ...monster, effects: [eff('a')] });
    ok(CardDefinitionSchema, { ...monster, effectText: { vi: 'Rút 1', en: 'Draw 1' } });
    ok(CardDefinitionSchema, monster);
  });
  it('rejects string name, half-translated name, empty text', () => {
    bad(CardDefinitionSchema, { ...monster, name: 'Soldier' });
    bad(CardDefinitionSchema, { ...monster, name: { vi: 'Lính' } });
    bad(CardDefinitionSchema, { ...monster, name: { vi: '', en: 'x' } });
    bad(CardDefinitionSchema, { ...monster, effectText: 'plain' });
  });
  it('rejects duplicate effect ids within a card and invalid effects', () => {
    bad(CardDefinitionSchema, { ...monster, effects: [eff('a'), eff('a')] });
    bad(CardDefinitionSchema, {
      ...monster,
      effects: [{ id: 'a', trigger: { kind: 'OnSummon' } }],
    });
  });
  it('every sample card has both languages', () => {
    for (const c of SAMPLE_CARDS) {
      expect(c.name.vi.length).toBeGreaterThan(0);
      expect(c.name.en.length).toBeGreaterThan(0);
      if (c.effectText) {
        expect(c.effectText.vi.length).toBeGreaterThan(0);
        expect(c.effectText.en.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('SpecialSummon (task 4.2a)', () => {
  const ss = (target: unknown, op: Record<string, unknown> = {}) => ({
    id: 'x',
    trigger: { kind: 'Ignition' },
    target,
    operations: [{ kind: 'SpecialSummon', ...op }],
  });
  const fromHand = {
    kind: 'Card',
    zone: 'Hand',
    side: 'self',
    count: 1,
    filter: { kind: 'Monster' },
  };
  it('accepts a Monster target in your own hand or graveyard, position Attack / DefenseUp', () => {
    ok(EffectDefinitionSchema, ss(fromHand));
    ok(EffectDefinitionSchema, ss({ ...fromHand, zone: 'Graveyard', count: 2 }));
    ok(EffectDefinitionSchema, ss(fromHand, { position: 'Attack' }));
    ok(EffectDefinitionSchema, ss(fromHand, { position: 'DefenseUp' }));
    ok(EffectDefinitionSchema, ss({ ...fromHand, filter: { kind: 'Monster', level: { max: 4 } } }));
  });
  it('rejects a face-down position, unknown fields, no target, and targets outside your hand/graveyard', () => {
    bad(EffectDefinitionSchema, ss(fromHand, { position: 'DefenseDown' }));
    bad(EffectDefinitionSchema, ss(fromHand, { bogus: 1 }));
    bad(EffectDefinitionSchema, { ...ss(fromHand), target: undefined });
    bad(EffectDefinitionSchema, ss({ ...fromHand, zone: 'MonsterZone' }));
    bad(EffectDefinitionSchema, ss({ ...fromHand, zone: 'Deck' }));
    bad(EffectDefinitionSchema, ss({ ...fromHand, side: 'opponent' }));
    bad(EffectDefinitionSchema, ss({ kind: 'Player', who: 'self' }));
  });
  it('needs a Monster filter (a Spell/Trap is never Summoned)', () => {
    bad(EffectDefinitionSchema, ss({ ...fromHand, filter: undefined }));
    bad(EffectDefinitionSchema, ss({ ...fromHand, filter: { level: { max: 4 } } }));
    bad(EffectDefinitionSchema, ss({ ...fromHand, filter: { kind: 'Spell' } }));
  });
  it('is a resolve-time operation: never in a Continuous effect', () => {
    bad(EffectDefinitionSchema, {
      id: 'x',
      trigger: { kind: 'Continuous' },
      operations: [{ kind: 'SpecialSummon' }],
    });
    expect(OPERATION_REGISTRY.SpecialSummon).toEqual({ implemented: true, timing: 'resolve' });
  });
});
