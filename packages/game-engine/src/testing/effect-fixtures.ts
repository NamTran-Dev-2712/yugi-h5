import type { CardDefinition, EffectDefinition } from '@yugi/shared';
import { applyAction } from '../apply-action.js';
import type { ActionContext } from '../actions/types.js';
import type { CardInstance, GameState, Phase } from '../state/types.js';

/** Test-only card pool for the effect handlers (not part of SAMPLE_CARDS; real batch-1 cards arrive in task 3.8). */

const text = (s: string) => ({ vi: s, en: s });

export function spell(id: string, effect: Omit<EffectDefinition, 'id'>): CardDefinition {
  return {
    id,
    kind: 'Spell',
    name: text(id),
    subType: 'Normal',
    effects: [{ id: 'e1', ...effect } as EffectDefinition],
  };
}

/** Test-only Quick-Play Spell (Spell Speed 2): the only way to build a multi-link chain until task 3.4. */
export function quickPlay(
  id: string,
  effect: Omit<EffectDefinition, 'id' | 'trigger'>,
): CardDefinition {
  return {
    id,
    kind: 'Spell',
    name: text(id),
    subType: 'QuickPlay',
    effects: [{ id: 'e1', trigger: { kind: 'Quick' }, ...effect } as EffectDefinition],
  };
}

/** Test-only Trap (Normal by default: Spell Speed 2; Counter: Spell Speed 3). Activatable only once Set (task 3.4). */
export function trap(
  id: string,
  effect: Omit<EffectDefinition, 'id' | 'trigger'> & { trigger?: EffectDefinition['trigger'] },
  subType: 'Normal' | 'Continuous' | 'Counter' = 'Normal',
): CardDefinition {
  return {
    id,
    kind: 'Trap',
    name: text(id),
    subType,
    effects: [{ id: 'e1', trigger: { kind: 'Quick' }, ...effect } as EffectDefinition],
  };
}

/** Test-only Equip Spell (task 4.2c): `e1` equips to 1 face-up monster on `side`, `e2` modifies the equipped monster. */
export function equipSpell(
  id: string,
  side: 'self' | 'opponent',
  modify: { stat: 'atk' | 'def'; amount: number },
): CardDefinition {
  return {
    id,
    kind: 'Spell',
    name: text(id),
    subType: 'Equip',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Ignition' },
        target: { kind: 'Card', zone: 'MonsterZone', side, count: 1, filter: { kind: 'Monster' } },
        operations: [{ kind: 'Equip' }],
      },
      {
        id: 'e2',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', ...modify, equipped: true }],
      },
    ],
  } as CardDefinition;
}

/**
 * Test-only card that stays on the field (task 4.3): `e1` activates the card (Spell: Ignition, Trap: Quick; `onActivate`
 * = what it does when it resolves, nothing by default), `e2` is the Continuous effect that then holds.
 */
export function stayingCard(
  id: string,
  type: 'Field' | 'ContinuousSpell' | 'ContinuousTrap',
  aura: EffectDefinition['operations'],
  onActivate: Partial<Omit<EffectDefinition, 'id' | 'trigger'>> = {},
): CardDefinition {
  return {
    id,
    kind: type === 'ContinuousTrap' ? 'Trap' : 'Spell',
    name: text(id),
    subType: type === 'Field' ? 'Field' : 'Continuous',
    effects: [
      {
        id: 'e1',
        trigger: { kind: type === 'ContinuousTrap' ? 'Quick' : 'Ignition' },
        operations: [],
        ...onActivate,
      },
      { id: 'e2', trigger: { kind: 'Continuous' }, operations: aura },
    ],
  } as CardDefinition;
}

export function monster(id: string, level = 4, race = 'Warrior'): CardDefinition {
  return {
    id,
    kind: 'Monster',
    name: text(id),
    category: 'Normal',
    attribute: 'EARTH',
    race,
    level,
    atk: 1000,
    def: 1000,
  };
}

/** Test-only Effect Monster with one trigger effect `e1` (task 3.5). */
export function effectMonster(
  id: string,
  effect: Omit<EffectDefinition, 'id'>,
  stats: { level?: number; atk?: number; def?: number } = {},
): CardDefinition {
  return {
    ...monster(id, stats.level ?? 4),
    category: 'Effect',
    atk: stats.atk ?? 1000,
    def: stats.def ?? 1000,
    effects: [{ id: 'e1', ...effect } as EffectDefinition],
  } as CardDefinition;
}

/** Test-only monster with one Continuous effect `e1` made of the given operations (task 3.6). */
export function continuousMonster(
  id: string,
  operations: EffectDefinition['operations'],
  stats: { atk?: number; def?: number; race?: string } = {},
  condition?: EffectDefinition['condition'],
): CardDefinition {
  return {
    ...monster(id, 4, stats.race ?? 'Warrior'),
    category: 'Effect',
    atk: stats.atk ?? 1000,
    def: stats.def ?? 1000,
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Continuous' },
        ...(condition ? { condition } : {}),
        operations,
      } as EffectDefinition,
    ],
  } as CardDefinition;
}

export const FIXTURE_DEFS: Record<string, CardDefinition> = {
  /** Task 3.6 — Continuous: the OTHER face-up Warriors you control gain 500 ATK. */
  CONT_WARRIOR_BUFF: continuousMonster('CONT_WARRIOR_BUFF', [
    {
      kind: 'ModifyStat',
      stat: 'atk',
      amount: 500,
      side: 'self',
      filter: { race: 'Warrior' },
      excludeSource: true,
    },
  ]),
  /** Continuous: every face-up monster your opponent controls loses 600 ATK and 400 DEF. */
  CONT_WEAKEN: continuousMonster(
    'CONT_WEAKEN',
    [
      { kind: 'ModifyStat', stat: 'atk', amount: -600, side: 'opponent' },
      { kind: 'ModifyStat', stat: 'def', amount: -400, side: 'opponent' },
    ],
    { race: 'Fiend' },
  ),
  /** Continuous: opponent's face-up monsters lose 5000 ATK (tests the clamp at 0). */
  CONT_CRUSH: continuousMonster(
    'CONT_CRUSH',
    [{ kind: 'ModifyStat', stat: 'atk', amount: -5000, side: 'opponent' }],
    { race: 'Fiend' },
  ),
  /** Continuous: your face-up monsters (this one included) gain 800 DEF. */
  CONT_WALL: continuousMonster(
    'CONT_WALL',
    [{ kind: 'ModifyStat', stat: 'def', amount: 800, side: 'self' }],
    { race: 'Rock' },
  ),
  /** Continuous with a condition: on your turn only, your face-up monsters gain 400 ATK. */
  CONT_MY_TURN: continuousMonster(
    'CONT_MY_TURN',
    [{ kind: 'ModifyStat', stat: 'atk', amount: 400, side: 'self' }],
    { race: 'Fiend' },
    [{ kind: 'IsMyTurn' }],
  ),
  /** Continuous Spell: your face-up Warriors gain 300 ATK (only a fixture can place it face-up until P4). */
  CONT_SPELL_BUFF: {
    id: 'CONT_SPELL_BUFF',
    kind: 'Spell',
    name: text('CONT_SPELL_BUFF'),
    subType: 'Continuous',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Continuous' },
        operations: [
          {
            kind: 'ModifyStat',
            stat: 'atk',
            amount: 300,
            side: 'self',
            filter: { race: 'Warrior' },
          },
        ],
      },
    ],
  },
  /** Task 3.6 — effect whose only behaviour is a registered script: halve the opponent's LP. */
  SCRIPT_HALVE: spell('SCRIPT_HALVE', {
    trigger: { kind: 'Ignition' },
    scriptId: 'test.halve-opponent-lp',
    operations: [],
  }),
  /** Operations run first, then the script: 1000 damage, then halve. */
  SCRIPT_BURN_HALVE: spell('SCRIPT_BURN_HALVE', {
    trigger: { kind: 'Ignition' },
    scriptId: 'test.halve-opponent-lp',
    operations: [{ kind: 'Damage', amount: 1000, target: 'opponent' }],
  }),
  /** A script id nobody registered: never activatable. */
  SCRIPT_UNKNOWN: spell('SCRIPT_UNKNOWN', {
    trigger: { kind: 'Ignition' },
    scriptId: 'no.such-script',
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  /** OnSummon mandatory with an unknown script: does not activate. */
  SUM_SCRIPT_UNKNOWN: effectMonster('SUM_SCRIPT_UNKNOWN', {
    trigger: { kind: 'OnSummon', mandatory: true },
    scriptId: 'no.such-script',
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  /** Task 3.5 — OnSummon mandatory: draw 1. */
  SUM_DRAW: effectMonster('SUM_DRAW', {
    trigger: { kind: 'OnSummon', mandatory: true },
    operations: [{ kind: 'Draw', count: 1, target: 'self' }],
  }),
  /** OnSummon mandatory: 300 damage to the opponent. */
  SUM_BURN: effectMonster('SUM_BURN', {
    trigger: { kind: 'OnSummon', mandatory: true },
    operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
  }),
  /** OnSummon optional (no `mandatory`): heal 500. */
  SUM_HEAL: effectMonster('SUM_HEAL', {
    trigger: { kind: 'OnSummon' },
    operations: [{ kind: 'Heal', amount: 500, target: 'self' }],
  }),
  /** OnSummon mandatory with a target: destroy 1 of the opponent's monsters. */
  SUM_KILL: effectMonster('SUM_KILL', {
    trigger: { kind: 'OnSummon', mandatory: true },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  /** OnSummon mandatory, only in Main2 (condition). */
  SUM_MAIN2: effectMonster('SUM_MAIN2', {
    trigger: { kind: 'OnSummon', mandatory: true },
    condition: [{ kind: 'PhaseIs', phase: 'Main2' }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  /** OnSummon optional with a PayLP 1000 cost. */
  SUM_PAY: effectMonster('SUM_PAY', {
    trigger: { kind: 'OnSummon' },
    cost: [{ kind: 'PayLP', amount: 1000 }],
    operations: [{ kind: 'Damage', amount: 1500, target: 'opponent' }],
  }),
  /** Level 5 OnSummon mandatory (needs one tribute): draw 1. */
  SUM_DRAW_L5: effectMonster(
    'SUM_DRAW_L5',
    {
      trigger: { kind: 'OnSummon', mandatory: true },
      operations: [{ kind: 'Draw', count: 1, target: 'self' }],
    },
    { level: 5, atk: 2200, def: 500 },
  ),
  /** OnDestroyed mandatory: 400 damage to the opponent (ATK 1000 / DEF 1000). */
  DES_BURN: effectMonster('DES_BURN', {
    trigger: { kind: 'OnDestroyed', mandatory: true },
    operations: [{ kind: 'Damage', amount: 400, target: 'opponent' }],
  }),
  /** OnDestroyed optional: draw 1. */
  DES_DRAW: effectMonster('DES_DRAW', {
    trigger: { kind: 'OnDestroyed' },
    operations: [{ kind: 'Draw', count: 1, target: 'self' }],
  }),
  /** Trap whose only effect is OnDestroyed mandatory (heal 600): never activatable by hand, fires when destroyed. */
  TRAP_DES_HEAL: trap('TRAP_DES_HEAL', {
    trigger: { kind: 'OnDestroyed', mandatory: true },
    operations: [{ kind: 'Heal', amount: 600, target: 'self' }],
  }),
  /** Trap: `e1` Quick (300 damage to the opponent) + `e2` OnDestroyed mandatory (heal 600). */
  TRAP_BURN_DES: {
    id: 'TRAP_BURN_DES',
    kind: 'Trap',
    name: text('TRAP_BURN_DES'),
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
      },
      {
        id: 'e2',
        trigger: { kind: 'OnDestroyed', mandatory: true },
        operations: [{ kind: 'Heal', amount: 600, target: 'self' }],
      },
    ],
  },

  /** Task 4.3 — Field Spell: every face-up Warrior (both sides) gains 500 ATK. */
  FLD_WARRIOR: stayingCard('FLD_WARRIOR', 'Field', [
    { kind: 'ModifyStat', stat: 'atk', amount: 500, side: 'self', filter: { race: 'Warrior' } },
    { kind: 'ModifyStat', stat: 'atk', amount: 500, side: 'opponent', filter: { race: 'Warrior' } },
  ]),
  /** Field Spell: the opponent's face-up monsters lose 400 ATK. */
  FLD_WEAK: stayingCard('FLD_WEAK', 'Field', [
    { kind: 'ModifyStat', stat: 'atk', amount: -400, side: 'opponent' },
  ]),
  /** Field Spell with an OnDestroyed trigger `e3` (heal 600), to prove a destroyed Field Spell fires it. */
  FLD_DES: {
    ...stayingCard('FLD_DES', 'Field', [
      { kind: 'ModifyStat', stat: 'def', amount: 200, side: 'self' },
    ]),
    effects: [
      { id: 'e1', trigger: { kind: 'Ignition' }, operations: [] },
      {
        id: 'e2',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'def', amount: 200, side: 'self' }],
      },
      {
        id: 'e3',
        trigger: { kind: 'OnDestroyed', mandatory: true },
        operations: [{ kind: 'Heal', amount: 600, target: 'self' }],
      },
    ],
  } as CardDefinition,
  /** Continuous Spell: your face-up monsters gain 300 ATK (activation does nothing else). */
  CS_BUFF: stayingCard('CS_BUFF', 'ContinuousSpell', [
    { kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self' },
  ]),
  /** Continuous Spell: gain 500 LP when it resolves, then your face-up monsters gain 200 DEF. */
  CS_HEAL_BUFF: stayingCard(
    'CS_HEAL_BUFF',
    'ContinuousSpell',
    [{ kind: 'ModifyStat', stat: 'def', amount: 200, side: 'self' }],
    { operations: [{ kind: 'Heal', amount: 500, target: 'self' }] },
  ),
  /** Continuous Trap: the opponent's face-up monsters lose 300 ATK. */
  CT_WEAK: stayingCard('CT_WEAK', 'ContinuousTrap', [
    { kind: 'ModifyStat', stat: 'atk', amount: -300, side: 'opponent' },
  ]),
  /** Continuous Trap: 200 damage when it resolves, then the opponent's face-up monsters lose 300 ATK. */
  CT_BURN_WEAK: stayingCard(
    'CT_BURN_WEAK',
    'ContinuousTrap',
    [{ kind: 'ModifyStat', stat: 'atk', amount: -300, side: 'opponent' }],
    { operations: [{ kind: 'Damage', amount: 200, target: 'opponent' }] },
  ),
  /** Task 4.2c — Equip Spell: equip to 1 of your face-up monsters; it gains 500 ATK. */
  EQ_POWER: equipSpell('EQ_POWER', 'self', { stat: 'atk', amount: 500 }),
  /** Equip Spell: equip to 1 of the opponent's face-up monsters; it loses 500 ATK. */
  EQ_WEAK: equipSpell('EQ_WEAK', 'opponent', { stat: 'atk', amount: -500 }),
  /** Task 4.2b — OnFlip mandatory: 400 damage to the opponent (ATK 1000 / DEF 1000). */
  FLIP_BURN: effectMonster('FLIP_BURN', {
    trigger: { kind: 'OnFlip', mandatory: true },
    operations: [{ kind: 'Damage', amount: 400, target: 'opponent' }],
  }),
  /** OnFlip optional: destroy 1 of the opponent's monsters. */
  FLIP_KILL: effectMonster('FLIP_KILL', {
    trigger: { kind: 'OnFlip' },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  /** `e1` OnFlip mandatory (draw 1) + `e2` OnDestroyed mandatory (300 damage): both fire when destroyed by an attack. */
  FLIP_DES: {
    ...monster('FLIP_DES'),
    category: 'Effect',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'OnFlip', mandatory: true },
        operations: [{ kind: 'Draw', count: 1, target: 'self' }],
      },
      {
        id: 'e2',
        trigger: { kind: 'OnDestroyed', mandatory: true },
        operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
      },
    ],
  } as CardDefinition,
  /** Task 4.2a — Level 5 OnSummon mandatory: Special Summon 1 monster from your graveyard (e.g. its own Tribute). */
  SUM_REVIVE_L5: effectMonster(
    'SUM_REVIVE_L5',
    {
      trigger: { kind: 'OnSummon', mandatory: true },
      target: {
        kind: 'Card',
        zone: 'Graveyard',
        side: 'self',
        count: 1,
        filter: { kind: 'Monster' },
      },
      operations: [{ kind: 'SpecialSummon' }],
    },
    { level: 5, atk: 2000, def: 1000 },
  ),
  /** Task 4.2a — Special Summon 1 monster from your hand (Attack Position by default). */
  SS_HAND: spell('SS_HAND', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'Hand', side: 'self', count: 1, filter: { kind: 'Monster' } },
    operations: [{ kind: 'SpecialSummon' }],
  }),
  /** Special Summon 1 monster from your graveyard in face-up Defense Position. */
  SS_GY_DEF: spell('SS_GY_DEF', {
    trigger: { kind: 'Ignition' },
    target: {
      kind: 'Card',
      zone: 'Graveyard',
      side: 'self',
      count: 1,
      filter: { kind: 'Monster' },
    },
    operations: [{ kind: 'SpecialSummon', position: 'DefenseUp' }],
  }),
  /** Special Summon 2 monsters from your graveyard. */
  SS_GY2: spell('SS_GY2', {
    trigger: { kind: 'Ignition' },
    target: {
      kind: 'Card',
      zone: 'Graveyard',
      side: 'self',
      count: 2,
      filter: { kind: 'Monster' },
    },
    operations: [{ kind: 'SpecialSummon' }],
  }),
  /** Quick-Play: Special Summon 1 monster from your graveyard (lets the opponent's Trap race it on the chain). */
  QP_SS_GY: quickPlay('QP_SS_GY', {
    target: {
      kind: 'Card',
      zone: 'Graveyard',
      side: 'self',
      count: 1,
      filter: { kind: 'Monster' },
    },
    operations: [{ kind: 'SpecialSummon' }],
  }),
  M1: monster('M1'),
  M2: monster('M2', 2, 'Dragon'),
  D: monster('D'),
  DRAW: spell('DRAW', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Draw', count: 1, target: 'self' }],
  }),
  DRAW3: spell('DRAW3', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Draw', count: 3, target: 'self' }],
  }),
  BURN: spell('BURN', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Damage', amount: 500, target: 'opponent' }],
  }),
  BURN_ALL: spell('BURN_ALL', {
    trigger: { kind: 'Ignition' },
    operations: [
      { kind: 'Damage', amount: 9000, target: 'opponent' },
      { kind: 'Heal', amount: 1000, target: 'self' },
    ],
  }),
  HEAL: spell('HEAL', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Heal', amount: 700, target: 'self' }],
  }),
  KILL: spell('KILL', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  DRAW_OPP: spell('DRAW_OPP', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Draw', count: 2, target: 'opponent' }],
  }),
  KILL2: spell('KILL2', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 2 },
    operations: [{ kind: 'Destroy' }],
  }),
  DISCARD2: spell('DISCARD2', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Discard', count: 2 }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  DISCARD_LV: spell('DISCARD_LV', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Discard', count: 1, filter: { level: { min: 1 } } }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  KILL_DRAGON: spell('KILL_DRAGON', {
    trigger: { kind: 'Ignition' },
    target: {
      kind: 'Card',
      zone: 'MonsterZone',
      side: 'opponent',
      count: 1,
      filter: { race: 'Dragon' },
    },
    operations: [{ kind: 'Destroy' }],
  }),
  KILL_ST: spell('KILL_ST', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  KILL_DEADLY: spell('KILL_DEADLY', {
    // Destroy without a Card target is a malformed effect.
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Destroy' }],
  }),
  PAY_BURN: spell('PAY_BURN', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'PayLP', amount: 500 }],
    operations: [{ kind: 'Damage', amount: 1000, target: 'opponent' }],
  }),
  DISCARD_DRAW: spell('DISCARD_DRAW', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Discard', count: 1 }],
    operations: [{ kind: 'Draw', count: 2, target: 'self' }],
  }),
  DISCARD_MONSTER: spell('DISCARD_MONSTER', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Discard', count: 1, filter: { kind: 'Monster' } }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  TRIBUTE_HEAL: spell('TRIBUTE_HEAL', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Tribute', count: 1 }],
    operations: [{ kind: 'Heal', amount: 500, target: 'self' }],
  }),
  NEEDS_MONSTER: spell('NEEDS_MONSTER', {
    trigger: { kind: 'Ignition' },
    condition: [{ kind: 'ZoneCount', zone: 'MonsterZone', side: 'self', min: 1 }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  MAIN2_ONLY: spell('MAIN2_ONLY', {
    trigger: { kind: 'Ignition' },
    condition: [{ kind: 'PhaseIs', phase: 'Main2' }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  ODD_TRIGGER: spell('ODD_TRIGGER', {
    trigger: { kind: 'Quick' },
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  QP_HEAL: quickPlay('QP_HEAL', { operations: [{ kind: 'Heal', amount: 300, target: 'self' }] }),
  QP_BURN: quickPlay('QP_BURN', {
    operations: [{ kind: 'Damage', amount: 200, target: 'opponent' }],
  }),
  QP_KILL: quickPlay('QP_KILL', {
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  QP_KILL_ST: quickPlay('QP_KILL_ST', {
    target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  QP_PAY: quickPlay('QP_PAY', {
    cost: [{ kind: 'PayLP', amount: 400 }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  QP_IGNITION: {
    // A Quick-Play whose effect is not a Quick trigger: malformed, never activatable.
    id: 'QP_IGNITION',
    kind: 'Spell',
    name: text('QP_IGNITION'),
    subType: 'QuickPlay',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
      },
    ],
  },
  NO_EFFECT: { id: 'NO_EFFECT', kind: 'Spell', name: text('NO_EFFECT'), subType: 'Normal' },
  CONT: {
    id: 'CONT',
    kind: 'Spell',
    name: text('CONT'),
    subType: 'Continuous',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'Draw', count: 1, target: 'self' }],
      },
    ],
  },
  TRAP: {
    id: 'TRAP',
    kind: 'Trap',
    name: text('TRAP'),
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
      },
    ],
  },
  /** A Trap with no effect yet (like the SMP-201 placeholder): never activatable, never opens a window. */
  TRAP_PLAIN: { id: 'TRAP_PLAIN', kind: 'Trap', name: text('TRAP_PLAIN'), subType: 'Normal' },
  TRAP_BURN: trap('TRAP_BURN', {
    operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
  }),
  TRAP_KILL_ST: trap('TRAP_KILL_ST', {
    target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  TRAP_IGNITION: trap('TRAP_IGNITION', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  CONT_TRAP: trap(
    'CONT_TRAP',
    { operations: [{ kind: 'Heal', amount: 100, target: 'self' }] },
    'Continuous',
  ),
  COUNTER: trap(
    'COUNTER',
    { operations: [{ kind: 'Heal', amount: 50, target: 'self' }] },
    'Counter',
  ),
  /** Destroys one of the opponent's monsters (e.g. the attacker / the monster just Summoned) — task 3.4c. */
  TRAP_KILL_MON: trap('TRAP_KILL_MON', {
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  /** Destroys one of its owner's own monsters (e.g. the attack target) — task 3.4c. */
  TRAP_KILL_OWN: trap('TRAP_KILL_OWN', {
    target: { kind: 'Card', zone: 'MonsterZone', side: 'self', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  TRAP_LETHAL: trap('TRAP_LETHAL', {
    operations: [{ kind: 'Damage', amount: 9000, target: 'opponent' }],
  }),
  /** ATK 2000 / DEF 500 monster, so battles have a clear winner. */
  BIG: { ...monster('BIG'), atk: 2000, def: 500 } as CardDefinition,
  /** Level 5: needs one tribute. */
  BIG_L5: { ...monster('BIG_L5', 5), atk: 2200, def: 500 } as CardDefinition,
  /** Normal Trap declared Speed 3 explicitly: `spellSpeed` overrides the default. */
  TRAP_SPEED3: trap('TRAP_SPEED3', {
    spellSpeed: 3,
    operations: [{ kind: 'Heal', amount: 10, target: 'self' }],
  }),
};

export const fixtureCtx: ActionContext = { cardDefinitions: (id) => FIXTURE_DEFS[id] };

export function inst(
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1 = 0,
): CardInstance {
  return { instanceId, definitionId, position: null, ownerIndex };
}

export interface FixtureSetup {
  /** Definition ids for player 0's hand; instance ids are h0, h1, ... */
  hand?: string[];
  phase?: Phase;
  /** Player 0 monsters as [zone, definitionId, position?]; instance ids m0-<zone>. Position defaults to Attack. */
  myMonsters?: [number, string, ('Attack' | 'DefenseUp' | 'DefenseDown')?][];
  /** Player 1 monsters; instance ids o0-<zone>. `DefenseDown` = face-down. */
  oppMonsters?: [number, string, ('Attack' | 'DefenseUp' | 'DefenseDown')?][];
  /** Player 1 Spell/Trap Zone cards (face-down); instance ids os-<zone>. Third item = `setTurn` (omitted = long ago). */
  oppSpellTraps?: [number, string, number?][];
  /** Player 0 Spell/Trap Zone cards (face-down); instance ids ms-<zone>. Third item = `setTurn` (omitted = long ago). */
  mySpellTraps?: [number, string, number?][];
  /**
   * Task 4.3 — the card in player 0's / player 1's Field Zone as [definitionId, position?, setTurn?]; instance ids
   * `mf` / `of`. Position defaults to `DefenseDown` (Set); `Attack` = face-up (already activated).
   */
  myField?: [string, ('Attack' | 'DefenseDown')?, number?];
  oppField?: [string, ('Attack' | 'DefenseDown')?, number?];
  /** Player 0 graveyard (definition ids, bottom → top); instance ids g0, g1, ... (task 4.2a). */
  myGraveyard?: string[];
  /** Player 0 deck (definition ids) — defaults to 40 × D. */
  deck?: string[];
  myLp?: number;
  oppLp?: number;
}

/** Duel in turn 1, player 0 to act. Player 0's deck is the top of the deck list (instance ids d0, d1, ...). */
export function fixtureState(s: FixtureSetup = {}): GameState {
  const deckList = s.deck ?? Array.from({ length: 40 }, () => 'D');
  const started = applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed: 'seed-effects',
      playerIds: ['alice', 'bob'],
      deckLists: [deckList, Array.from({ length: 40 }, () => 'D')],
    },
  }).state;
  const zones = <T>(
    fill: (i: number) => T | null,
  ): [T | null, T | null, T | null, T | null, T | null] => [
    fill(0),
    fill(1),
    fill(2),
    fill(3),
    fill(4),
  ];
  const mine = new Map((s.myMonsters ?? []).map(([z, d, p]) => [z, { d, p: p ?? 'Attack' }]));
  const theirs = new Map((s.oppMonsters ?? []).map(([z, d, p]) => [z, { d, p: p ?? 'Attack' }]));
  const backrow = (list: [number, string, number?][] | undefined, prefix: string, owner: 0 | 1) => {
    const byZone = new Map((list ?? []).map(([z, d, t]) => [z, { d, t }]));
    return zones((i) => {
      const c = byZone.get(i);
      if (!c) return null;
      const placed: CardInstance = {
        ...inst(`${prefix}-${i}`, c.d, owner),
        position: 'DefenseDown',
      };
      return c.t === undefined ? placed : { ...placed, setTurn: c.t };
    });
  };
  const p0 = started.players[0];
  const p1 = started.players[1];
  const hand = (s.hand ?? []).map((d, i) => inst(`h${i}`, d));
  const monsterZones0 = zones((i) => {
    const m = mine.get(i);
    return m ? ({ ...inst(`m0-${i}`, m.d), position: m.p } as CardInstance) : null;
  });
  const monsterZones1 = zones((i) => {
    const t = theirs.get(i);
    return t ? ({ ...inst(`o0-${i}`, t.d, 1), position: t.p } as CardInstance) : null;
  });
  const spellTrapZones0 = backrow(s.mySpellTraps, 'ms', 0);
  const spellTrapZones1 = backrow(s.oppSpellTraps, 'os', 1);
  const field = (
    f: FixtureSetup['myField'],
    instanceId: string,
    owner: 0 | 1,
  ): CardInstance | null => {
    if (!f) return null;
    const placed: CardInstance = {
      ...inst(instanceId, f[0], owner),
      position: f[1] ?? 'DefenseDown',
    };
    return f[2] === undefined ? placed : { ...placed, setTurn: f[2] };
  };
  return {
    ...started,
    phase: s.phase ?? 'Main1',
    players: [
      {
        ...p0,
        hand,
        graveyard: (s.myGraveyard ?? []).map((d, i) => inst(`g${i}`, d)),
        lifePoints: s.myLp ?? p0.lifePoints,
        board: {
          monsterZones: monsterZones0,
          spellTrapZones: spellTrapZones0,
          fieldZone: field(s.myField, 'mf', 0),
        },
      },
      {
        ...p1,
        lifePoints: s.oppLp ?? p1.lifePoints,
        board: {
          monsterZones: monsterZones1,
          spellTrapZones: spellTrapZones1,
          fieldZone: field(s.oppField, 'of', 1),
        },
      },
    ],
  };
}
