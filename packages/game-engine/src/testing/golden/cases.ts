import type { CardDefinition } from '@yugi/shared';
import type { Action } from '../../actions/types.js';
import type { GoldenCase } from './replay.js';

function monster(id: string, level: number, atk: number, def: number): CardDefinition {
  return {
    id,
    kind: 'Monster',
    name: { vi: `Golden ${id}`, en: `Golden ${id}` },
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level,
    atk,
    def,
  };
}

/** Test-only Effect Monster with one trigger effect (task 3.5). */
function triggerMonster(
  id: string,
  atk: number,
  trigger: { kind: 'OnSummon' | 'OnDestroyed' | 'OnFlip'; mandatory?: boolean },
  operation: NonNullable<CardDefinition['effects']>[number]['operations'][number],
): CardDefinition {
  return {
    ...monster(id, 4, atk, 1000),
    category: 'Effect',
    effects: [{ id: 'e1', trigger, operations: [operation] }],
  } as CardDefinition;
}

/** Test-only Normal Spell: Special Summon 1 of your monsters from `zone` (task 4.2a). */
function ssSpell(id: string, zone: 'Hand' | 'Graveyard'): CardDefinition {
  return {
    id,
    kind: 'Spell',
    name: { vi: `Golden ${id}`, en: `Golden ${id}` },
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Ignition' },
        target: { kind: 'Card', zone, side: 'self', count: 1, filter: { kind: 'Monster' } },
        operations: [{ kind: 'SpecialSummon' }],
      },
    ],
  };
}

/** Test-only Equip Spell (task 4.2c): equip to 1 of your face-up monsters, +500 ATK. */
function equipSpell(id: string): CardDefinition {
  return {
    id,
    kind: 'Spell',
    name: { vi: `Golden ${id}`, en: `Golden ${id}` },
    subType: 'Equip',
    effects: [
      {
        id: 'e1',
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
        id: 'e2',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'atk', amount: 500, equipped: true }],
      },
    ],
  };
}

/**
 * Test-only card that stays on the field (task 4.3): `e1` only activates the card (Spell: Ignition, Trap: Quick), `e2`
 * is the Continuous effect that then holds.
 */
function stayingCard(
  id: string,
  kind: 'Spell' | 'Trap',
  subType: 'Field' | 'Continuous',
  aura: NonNullable<CardDefinition['effects']>[number]['operations'],
): CardDefinition {
  return {
    id,
    kind,
    name: { vi: `Golden ${id}`, en: `Golden ${id}` },
    subType,
    effects: [
      { id: 'e1', trigger: { kind: kind === 'Trap' ? 'Quick' : 'Ignition' }, operations: [] },
      { id: 'e2', trigger: { kind: 'Continuous' }, operations: aura },
    ],
  } as CardDefinition;
}

/** Placeholder cards only (no official names). */
export const GOLDEN_DEFS: Readonly<Record<string, CardDefinition>> = {
  /** Task 4.3 — Field Spell: every face-up Warrior on the field gains 500 ATK. */
  G_FIELD_WARRIOR: stayingCard('G_FIELD_WARRIOR', 'Spell', 'Field', [
    { kind: 'ModifyStat', stat: 'atk', amount: 500, side: 'self', filter: { race: 'Warrior' } },
    { kind: 'ModifyStat', stat: 'atk', amount: 500, side: 'opponent', filter: { race: 'Warrior' } },
  ]),
  /** Field Spell: the opponent's face-up monsters lose 400 ATK. */
  G_FIELD_WEAK: stayingCard('G_FIELD_WEAK', 'Spell', 'Field', [
    { kind: 'ModifyStat', stat: 'atk', amount: -400, side: 'opponent' },
  ]),
  /** Continuous Spell: your face-up monsters gain 300 ATK. */
  G_CONT_SPELL: stayingCard('G_CONT_SPELL', 'Spell', 'Continuous', [
    { kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self' },
  ]),
  /** Continuous Trap: the opponent's face-up monsters lose 300 ATK. */
  G_CONT_TRAP: stayingCard('G_CONT_TRAP', 'Trap', 'Continuous', [
    { kind: 'ModifyStat', stat: 'atk', amount: -300, side: 'opponent' },
  ]),
  /** Normal Spell: destroy 1 Spell/Trap (or Field Spell) the opponent controls. */
  G_KILL_ST: {
    id: 'G_KILL_ST',
    kind: 'Spell',
    name: { vi: 'Golden G_KILL_ST', en: 'Golden G_KILL_ST' },
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Ignition' },
        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  G_SUM_BURN: triggerMonster(
    'G_SUM_BURN',
    1200,
    { kind: 'OnSummon', mandatory: true },
    { kind: 'Damage', amount: 300, target: 'opponent' },
  ),
  G_SUM_HEAL: triggerMonster(
    'G_SUM_HEAL',
    1100,
    { kind: 'OnSummon' },
    { kind: 'Heal', amount: 500, target: 'self' },
  ),
  G_DES_BURN: triggerMonster(
    'G_DES_BURN',
    1000,
    { kind: 'OnDestroyed', mandatory: true },
    { kind: 'Damage', amount: 400, target: 'opponent' },
  ),
  /** Task 4.2c — Equip Spell: +500 ATK to one of your face-up monsters. */
  G_EQ_POWER: equipSpell('G_EQ_POWER'),
  /** Task 4.8 — Equip Spell that goes on an OPPONENT's face-up monster: −600 ATK. */
  G_EQ_WEAK: {
    id: 'G_EQ_WEAK',
    kind: 'Spell',
    name: { vi: 'Golden G_EQ_WEAK', en: 'Golden G_EQ_WEAK' },
    subType: 'Equip',
    effects: [
      {
        id: 'e1',
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
        id: 'e2',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'atk', amount: -600, equipped: true }],
      },
    ],
  },
  /** Task 4.8 — ATK 1500, OnDestroyed OPTIONAL: destroy 1 Spell/Trap the opponent controls. */
  G_DES_KILL_ST: {
    ...monster('G_DES_KILL_ST', 4, 1500, 1000),
    category: 'Effect',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'OnDestroyed' },
        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  } as CardDefinition,
  /** Task 4.2b — OnFlip mandatory: 400 damage to the opponent (ATK 1000 / DEF 1000). */
  G_FLIP_BURN: triggerMonster(
    'G_FLIP_BURN',
    1000,
    { kind: 'OnFlip', mandatory: true },
    { kind: 'Damage', amount: 400, target: 'opponent' },
  ),
  /** Task 4.2a — Special Summon 1 monster from your hand / from your graveyard. */
  G_SS_HAND: ssSpell('G_SS_HAND', 'Hand'),
  G_SS_GY: ssSpell('G_SS_GY', 'Graveyard'),
  M1000: monster('M1000', 4, 1000, 1000),
  M1800: monster('M1800', 4, 1800, 600),
  L5: monster('L5', 5, 2100, 1500),
  G_DRAW: {
    id: 'G_DRAW',
    kind: 'Spell',
    name: { vi: 'Golden G_DRAW', en: 'Golden G_DRAW' },
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'Draw', count: 1, target: 'self' }],
      },
    ],
  },
  G_QP_HEAL: {
    id: 'G_QP_HEAL',
    kind: 'Spell',
    name: { vi: 'Golden G_QP_HEAL', en: 'Golden G_QP_HEAL' },
    subType: 'QuickPlay',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Heal', amount: 300, target: 'self' }],
      },
    ],
  },
  G_QP_BURN: {
    id: 'G_QP_BURN',
    kind: 'Spell',
    name: { vi: 'Golden G_QP_BURN', en: 'Golden G_QP_BURN' },
    subType: 'QuickPlay',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Damage', amount: 200, target: 'opponent' }],
      },
    ],
  },
  G_TRAP_BURN: {
    id: 'G_TRAP_BURN',
    kind: 'Trap',
    name: { vi: 'Golden G_TRAP_BURN', en: 'Golden G_TRAP_BURN' },
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
      },
    ],
  },
  G_TRAP_KILL: {
    id: 'G_TRAP_KILL',
    kind: 'Trap',
    name: { vi: 'Golden G_TRAP_KILL', en: 'Golden G_TRAP_KILL' },
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  /** Task 3.6 — Continuous: the OTHER face-up Warriors its controller has gain 500 ATK. */
  G_CONT_BUFF: {
    ...monster('G_CONT_BUFF', 4, 1000, 1000),
    category: 'Effect',
    race: 'Fiend',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Continuous' },
        operations: [
          {
            kind: 'ModifyStat',
            stat: 'atk',
            amount: 500,
            side: 'self',
            filter: { race: 'Warrior' },
            excludeSource: true,
          },
        ],
      },
    ],
  } as CardDefinition,
  /** Normal Spell: destroy 1 of the opponent's monsters. */
  G_KILL: {
    id: 'G_KILL',
    kind: 'Spell',
    name: { vi: 'Golden G_KILL', en: 'Golden G_KILL' },
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Ignition' },
        target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  G_COUNTER: {
    id: 'G_COUNTER',
    kind: 'Trap',
    name: { vi: 'Golden G_COUNTER', en: 'Golden G_COUNTER' },
    subType: 'Counter',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
      },
    ],
  },
  /** Task 4.4 — Counter Trap: pay 1000 LP, negate the activation of the opponent's Spell/Trap. */
  G_NEG_ACT: {
    id: 'G_NEG_ACT',
    kind: 'Trap',
    name: { vi: 'Golden G_NEG_ACT', en: 'Golden G_NEG_ACT' },
    subType: 'Counter',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        cost: [{ kind: 'PayLP', amount: 1000 }],
        operations: [{ kind: 'NegateActivation', cardKinds: ['Spell', 'Trap'] }],
      },
    ],
  },
  /** Normal Trap: negate the opponent's declared attack. */
  G_NEG_ATK: {
    id: 'G_NEG_ATK',
    kind: 'Trap',
    name: { vi: 'Golden G_NEG_ATK', en: 'Golden G_NEG_ATK' },
    subType: 'Normal',
    effects: [{ id: 'e1', trigger: { kind: 'Quick' }, operations: [{ kind: 'NegateAttack' }] }],
  },
  /** Counter Trap: negate the opponent's Normal / Flip Summon. */
  G_NEG_SUM: {
    id: 'G_NEG_SUM',
    kind: 'Trap',
    name: { vi: 'Golden G_NEG_SUM', en: 'Golden G_NEG_SUM' },
    subType: 'Counter',
    effects: [{ id: 'e1', trigger: { kind: 'Quick' }, operations: [{ kind: 'NegateSummon' }] }],
  },
  /** Task 4.5 — Normal Spell: Fusion Summon with materials from your hand or your field. */
  G_FUS: {
    id: 'G_FUS',
    kind: 'Spell',
    name: { vi: 'Golden G_FUS', en: 'Golden G_FUS' },
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'FusionSummon', sources: ['Hand', 'Field'] }],
      },
    ],
  },
  /** Fusion Monster (2400 ATK): M1000 + M1800. */
  G_FM_AB: {
    ...monster('G_FM_AB', 6, 2400, 2000),
    category: 'Fusion',
    fusionMaterials: ['M1000', 'M1800'],
  } as CardDefinition,
  /** Fusion Monster with an OnSummon mandatory trigger (300 damage): M1000 + M1800. */
  G_FM_SUM: {
    ...monster('G_FM_SUM', 6, 2200, 1800),
    category: 'Fusion',
    fusionMaterials: ['M1000', 'M1800'],
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'OnSummon', mandatory: true },
        operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
      },
    ],
  } as CardDefinition,
};

/** Fusion (task 4.5): P0 holds the fusion Spell and the materials, P1 the cards that interfere. */
const FUSION_DECK_P0 = Array.from(
  { length: 40 },
  (_, i) => ['G_FUS', 'M1000', 'M1800', 'G_DES_BURN'][i % 4]!,
);
const FUSION_DECK_P1 = Array.from(
  { length: 40 },
  (_, i) => ['G_NEG_ACT', 'G_TRAP_KILL', 'M1000', 'M1800'][i % 4]!,
);
/**
 * The five task 4.5 cases share one deal (seed `g-fus-75`). T1 (P0) hand: p0-32 G_FUS, p0-31 G_DES_BURN, p0-20 G_FUS,
 * p0-2 M1800, p0-25 M1000 (T3 draws p0-0 G_FUS). T2 (P1) hand: p1-6 M1000, p1-19 M1800, p1-39 M1800,
 * p1-29 G_TRAP_KILL, p1-12 G_NEG_ACT (+ draws p1-27 M1800). P0's Extra Deck: p0-x0 G_FM_AB, p0-x1 G_FM_SUM.
 * A Fusion prompt's id is `fusion-<turn>-<version of the state the prompt was opened from>`.
 */
const fusionStart: GoldenCase['start'] = {
  type: 'StartDuel',
  payload: {
    matchId: 'golden',
    seed: 'g-fus-75',
    playerIds: ['alice', 'bob'],
    deckLists: [FUSION_DECK_P0, FUSION_DECK_P1],
    extraDeckLists: [['G_FM_AB', 'G_FM_SUM'], []],
  },
};
const fusionAnswer = (promptId: string, cardInstanceIds: string[]): Action => ({
  type: 'ResolvePendingPrompt',
  payload: { playerIndex: 0, promptId, cardInstanceIds },
});
const activateBy = (playerIndex: 0 | 1, cardInstanceId: string): Action => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId: 'e1' },
});

/** Counter Trap / Negate (task 4.4): P0 plays the Spells and monsters, P1 holds the three negating Traps. */
const NEGATE_DECK_P0 = Array.from(
  { length: 40 },
  (_, i) => ['G_DRAW', 'G_CONT_SPELL', 'M1000', 'M1800'][i % 4]!,
);
const NEGATE_DECK_P1 = Array.from(
  { length: 40 },
  (_, i) => ['G_NEG_ACT', 'G_NEG_ATK', 'G_NEG_SUM', 'M1000'][i % 4]!,
);
/**
 * The four task 4.4 cases share one deal (seed `g-neg-4`). T1 (P0) hand: p0-12 G_DRAW, p0-31 M1800, p0-11 M1800,
 * p0-5 G_CONT_SPELL, p0-21 G_CONT_SPELL. T2 (P1) hand: p1-36 G_NEG_ACT, p1-16 G_NEG_ACT, p1-26 G_NEG_SUM,
 * p1-21 G_NEG_ATK, p1-38 G_NEG_SUM (+ draws p1-34 G_NEG_SUM).
 */
const negateStart: GoldenCase['start'] = {
  type: 'StartDuel',
  payload: {
    matchId: 'golden',
    seed: 'g-neg-4',
    playerIds: ['alice', 'bob'],
    deckLists: [NEGATE_DECK_P0, NEGATE_DECK_P1],
  },
};

const SPELL_DECK = Array.from({ length: 40 }, (_, i) => ['M1000', 'M1800', 'L5', 'G_DRAW'][i % 4]!);

/** Test-only Quick-Play Spells (Speed 2) so a multi-link chain can be recorded (task 3.3). */
const CHAIN_DECK = Array.from(
  { length: 40 },
  (_, i) => ['G_DRAW', 'G_QP_HEAL', 'G_QP_BURN', 'M1000'][i % 4]!,
);

/** Set Trap / Set Quick-Play / Counter Trap chain (task 3.4). */
const TRAP_DECK = Array.from(
  { length: 40 },
  (_, i) => ['G_DRAW', 'G_QP_BURN', 'G_TRAP_BURN', 'G_COUNTER', 'M1000'][i % 5]!,
);

/** Reaction windows after a Set / an attack (task 3.4c). */
const REACTION_DECK = Array.from(
  { length: 40 },
  (_, i) => ['M1000', 'G_TRAP_KILL', 'M1800'][i % 3]!,
);

/** Trigger effects (task 3.5). */
const TRIGGER_DECK = Array.from(
  { length: 40 },
  (_, i) => ['G_SUM_BURN', 'G_SUM_HEAL', 'G_DES_BURN', 'M1800'][i % 4]!,
);

/** Continuous effects (task 3.6): P0 runs the buff source, P1 the Spell that destroys it. */
const CONT_DECK_P0 = Array.from({ length: 40 }, (_, i) => ['G_CONT_BUFF', 'M1800'][i % 2]!);
const CONT_DECK_P1 = Array.from({ length: 40 }, (_, i) => ['G_KILL', 'M1800'][i % 2]!);

/** Special Summon from the hand / the graveyard (task 4.2a). */
const SS_DECK = Array.from(
  { length: 40 },
  (_, i) => ['G_SS_HAND', 'G_SS_GY', 'M1800', 'G_SUM_BURN'][i % 4]!,
);

/** Flip Summon + flip effects (task 4.2b). */
const FLIP_DECK = Array.from({ length: 40 }, (_, i) => ['G_FLIP_BURN', 'M1800', 'M1000'][i % 3]!);

/** Equip Spells (task 4.2c). */
const EQUIP_DECK = Array.from({ length: 40 }, (_, i) => ['G_EQ_POWER', 'M1000', 'M1800'][i % 3]!);

/** Field Spells (task 4.3): P0 runs the two Field Spells, P1 the Spell that destroys one. */
const FIELD_DECK_P0 = Array.from(
  { length: 40 },
  (_, i) => ['G_FIELD_WARRIOR', 'G_FIELD_WEAK', 'M1000', 'M1800'][i % 4]!,
);
const FIELD_DECK_P1 = Array.from({ length: 40 }, (_, i) => ['G_KILL_ST', 'M1800'][i % 2]!);

/** Continuous Spell / Continuous Trap / a Set Normal Spell (task 4.3). */
const STAY_DECK = Array.from(
  { length: 40 },
  (_, i) => ['G_CONT_SPELL', 'G_CONT_TRAP', 'G_DRAW', 'M1000'][i % 4]!,
);

const MIXED_DECK = Array.from({ length: 40 }, (_, i) => ['M1000', 'M1800', 'L5'][i % 3]!);

/**
 * Task 4.8 — an Equip Spell on a monster whose "when destroyed" trigger targets a Spell/Trap (seed `g-p7-1`). P0 hand:
 * p0-25 / p0-19 / p0-37 M1800, p0-0 / p0-33 G_EQ_WEAK; P0 draws p0-28 M1800 (T3), p0-17 G_DRAW (T5). P1 hand: p1-12 /
 * p1-2 G_DES_KILL_ST, three M1000.
 */
const EQUIP_TRIGGER_DECK_P0 = Array.from(
  { length: 40 },
  (_, i) => ['G_EQ_WEAK', 'M1800', 'G_DRAW'][i % 3]!,
);
const EQUIP_TRIGGER_DECK_P1 = Array.from(
  { length: 40 },
  (_, i) => ['G_DES_KILL_ST', 'M1000'][i % 2]!,
);

const endPhase = (playerIndex: 0 | 1, times = 1): Action[] =>
  Array.from({ length: times }, () => ({ type: 'EndPhase', payload: { playerIndex } }));

/**
 * Summon window before the OnSummon / OnFlip triggers (task 4.4c): P0 runs the trigger monsters, P1 the Traps.
 * Both cases share one deal (seed `g-sumwin-3`). T1 (P0) hand: p0-17 G_FLIP_BURN, p0-14 M1000, p0-32 G_SUM_BURN,
 * p0-27 M1800, p0-28 G_SUM_BURN. T2 (P1) hand: p1-7 M1800, p1-5 G_TRAP_BURN, p1-21 G_TRAP_BURN, p1-16 G_NEG_SUM,
 * p1-36 G_NEG_SUM.
 */
const SUMMON_WINDOW_DECK_P0 = Array.from(
  { length: 40 },
  (_, i) => ['G_SUM_BURN', 'G_FLIP_BURN', 'M1000', 'M1800'][i % 4]!,
);
const SUMMON_WINDOW_DECK_P1 = Array.from(
  { length: 40 },
  (_, i) => ['G_NEG_SUM', 'G_TRAP_BURN', 'M1000', 'M1800'][i % 4]!,
);
const summonWindowStart: GoldenCase['start'] = {
  type: 'StartDuel',
  payload: {
    matchId: 'golden',
    seed: 'g-sumwin-3',
    playerIds: ['alice', 'bob'],
    deckLists: [SUMMON_WINDOW_DECK_P0, SUMMON_WINDOW_DECK_P1],
  },
};
/** T1: P0 Sets G_FLIP_BURN (p0-17). T2: P1 Sets G_NEG_SUM (p1-16) and G_TRAP_BURN (p1-5). */
const summonWindowSetup: Action[] = [
  ...endPhase(0, 2),
  { type: 'SetMonster', payload: { playerIndex: 0, cardInstanceId: 'p0-17', zoneIndex: 0 } },
  ...endPhase(0, 4),
  ...endPhase(1, 2),
  { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-16', zoneIndex: 0 } },
  { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-5', zoneIndex: 1 } },
  ...endPhase(1, 4),
];

/*
 * Turn shape reminder (6 EndPhase per full turn): Draw→Standby (draws unless turn 1), Standby→Main1,
 * [Main1 actions], Main1→Battle, [Battle actions], Battle→Main2, Main2→End, End→next turn.
 * Instance ids (`p<player>-<n>`) depend on the seeded shuffle; they were read off the engine once and are pinned
 * by the golden files (changing the shuffle would change them — that is a deliberate regression signal).
 */
export const GOLDEN_CASES: readonly GoldenCase[] = [
  {
    name: 'direct-attack-lp-zero',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-attack',
        playerIds: ['alice', 'bob'],
        deckLists: [MIXED_DECK, MIXED_DECK],
        startingLP: [1000, 1000],
      },
    },
    actions: [
      // T1 (P0): Normal Summon M1000 (p0-39), end turn.
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-39', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): pass.
      ...endPhase(1, 6),
      // T3 (P0): direct attack for exactly 1000 → LP 0.
      ...endPhase(0, 3),
      { type: 'DeclareAttack', payload: { playerIndex: 0, attackerInstanceId: 'p0-39' } },
      // After the duel ended, everything is rejected.
      ...endPhase(0, 1),
    ],
  },
  {
    name: 'tribute-position-flip-attack',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-tribute',
        playerIds: ['alice', 'bob'],
        deckLists: [MIXED_DECK, MIXED_DECK],
      },
    },
    actions: [
      // T1 (P0): Normal Summon M1000 (p0-36).
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-36', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): Set M1000 (p1-9).
      ...endPhase(1, 2),
      { type: 'SetMonster', payload: { playerIndex: 1, cardInstanceId: 'p1-9', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): Tribute Summon L5 (p0-20) over p0-36; it cannot attack the turn it is summoned (rejected).
      ...endPhase(0, 2),
      {
        type: 'NormalSummon',
        payload: {
          playerIndex: 0,
          cardInstanceId: 'p0-20',
          zoneIndex: 0,
          tributeInstanceIds: ['p0-36'],
        },
      },
      ...endPhase(0, 1),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-20', targetInstanceId: 'p1-9' },
      },
      ...endPhase(0, 3),
      // T4 (P1): pass.
      ...endPhase(1, 6),
      // T5 (P0): attack the Set monster (Flip-on-Attack, ATK > DEF), then try to switch to Defense in Main2 (rejected: it already attacked).
      ...endPhase(0, 3),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-20', targetInstanceId: 'p1-9' },
      },
      ...endPhase(0, 1),
      {
        type: 'ChangePosition',
        payload: { playerIndex: 0, cardInstanceId: 'p0-20', toPosition: 'DefenseUp' },
      },
      ...endPhase(0, 2),
    ],
  },
  {
    name: 'surrender-mid-duel',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-hand',
        playerIds: ['alice', 'bob'],
        deckLists: [MIXED_DECK, MIXED_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-18', zoneIndex: 2 } },
      // The non-turn player concedes during P0's Main1.
      { type: 'Surrender', payload: { playerIndex: 1 } },
      // Both a repeated Surrender and normal play are rejected afterwards.
      { type: 'Surrender', payload: { playerIndex: 0 } },
      ...endPhase(0, 1),
    ],
  },
  {
    name: 'deck-out',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-deckout',
        playerIds: ['alice', 'bob'],
        // Exactly the opening hand: the first real draw (P1, turn 2) has nothing to draw.
        deckLists: [Array(5).fill('M1000'), Array(5).fill('M1000')],
      },
    },
    actions: [...endPhase(0, 6), ...endPhase(1, 1), ...endPhase(1, 1)],
  },
  {
    name: 'hand-limit-discard',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-hand',
        playerIds: ['alice', 'bob'],
        deckLists: [MIXED_DECK, MIXED_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      // Hand 5 → 7, so leaving Main2 must open a discard-1 prompt.
      { type: 'Draw', payload: { playerIndex: 0, count: 2 } },
      ...endPhase(0, 3),
      // Wrong answers are rejected without changing anything, then the real one resolves.
      { type: 'EndPhase', payload: { playerIndex: 0 } },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'nope', cardInstanceIds: ['p0-18'] },
      },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'discard-1', cardInstanceIds: ['p0-18'] },
      },
      ...endPhase(0, 1),
    ],
  },
  {
    name: 'spell-set-and-activate',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-spell',
        playerIds: ['alice', 'bob'],
        deckLists: [SPELL_DECK, SPELL_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      // T1 (P0) hand: p0-17 M1800, p0-14 L5, p0-3 G_DRAW, p0-10 L5, p0-32 M1000.
      // Rejects (state untouched): a monster is not a Spell, unknown effect id.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-17', effectId: 'e1' },
      },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-3', effectId: 'nope' },
      },
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-17', zoneIndex: 0 } },
      // The real activation: draw 1, the Spell goes to the graveyard.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-3', effectId: 'e1' },
      },
      ...endPhase(0, 4),
      // T2 (P1) hand after its draw includes p1-19 G_DRAW: Set it face-down, then activate it from its zone on the same
      // turn (task 4.3 [RULE]; before 4.3 a Set Normal Spell was NOT_ACTIVATABLE).
      ...endPhase(1, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-19', zoneIndex: 2 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-19', effectId: 'e1' },
      },
      ...endPhase(1, 4),
    ],
  },
  {
    name: 'chain-three-links',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-chain-3',
        playerIds: ['alice', 'bob'],
        deckLists: [CHAIN_DECK, CHAIN_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      // T1 (P0) hand: p0-36 G_DRAW, p0-9 G_QP_HEAL, p0-22 G_QP_BURN, p0-12 G_DRAW, p0-8 G_DRAW.
      // Link 1 (Speed 1). P1 cannot respond (auto-pass); P0 still holds Quick-Plays, so the window stays open.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-36', effectId: 'e1' },
      },
      // Rejects while the window is open: wrong player passes, other actions, a Speed 1 response.
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      { type: 'EndPhase', payload: { playerIndex: 0 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-12', effectId: 'e1' },
      },
      // Link 2 (Speed 2); P0 can still respond with the last Quick-Play.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-9', effectId: 'e1' },
      },
      // Link 3: nobody can respond any more → the chain resolves LIFO (BURN, HEAL, DRAW) in this call.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-22', effectId: 'e1' },
      },
      // No window left.
      { type: 'PassPriority', payload: { playerIndex: 0 } },
      ...endPhase(0, 4),
    ],
  },
  {
    name: 'set-trap-quickplay-counter-chain',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-trap-qp',
        playerIds: ['alice', 'bob'],
        deckLists: [TRAP_DECK, TRAP_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      // T1 (P0) hand: p0-2 G_TRAP_BURN, p0-14 M1000, p0-36 G_QP_BURN, p0-38 G_COUNTER, p0-19 M1000.
      // Set a Trap, a Quick-Play and a Counter Trap; neither Set card may be activated the turn it was Set.
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-2', zoneIndex: 0 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-2', effectId: 'e1' },
      },
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-36', zoneIndex: 1 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-36', effectId: 'e1' },
      },
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-38', zoneIndex: 2 } },
      ...endPhase(0, 4),
      // T2 (P1) hand: p1-26 G_QP_BURN, p1-18 G_COUNTER, p1-0 G_DRAW, p1-4 M1000, p1-19 M1000 (+ draws p1-38).
      ...endPhase(1, 2),
      // Link 1 (Speed 1): P0 holds Set cards from an earlier turn, so the window opens for P0.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-0', effectId: 'e1' },
      },
      // Link 2: P0's Set Quick-Play on the opponent's turn. P1 could answer with its hand Quick-Play (own turn).
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-36', effectId: 'e1' },
      },
      // Reject: a Counter Trap in the hand is not Set.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-18', effectId: 'e1' },
      },
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      // Link 3: P0's Set Normal Trap (Speed 2).
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-2', effectId: 'e1' },
      },
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      // Link 4: Counter Trap (Speed 3). P1 has nothing at Speed 3 → the chain resolves LIFO in this call.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-38', effectId: 'e1' },
      },
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      ...endPhase(1, 4),
    ],
  },
  {
    name: 'attack-and-summon-reaction',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-reaction',
        playerIds: ['alice', 'bob'],
        deckLists: [REACTION_DECK, REACTION_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      // T1 (P0): P1 has no Set card, so the Summon opens no window.
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-3', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1) hand: p1-37 G_TRAP_KILL, ...: Set it.
      ...endPhase(1, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-37', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): Setting a monster opens a reaction window for P1 (its Trap was Set last turn).
      ...endPhase(0, 2),
      { type: 'SetMonster', payload: { playerIndex: 0, cardInstanceId: 'p0-12', zoneIndex: 1 } },
      // Rejects while the window is open: the turn player can neither act on nor pass it.
      { type: 'EndPhase', payload: { playerIndex: 0 } },
      { type: 'PassPriority', payload: { playerIndex: 0 } },
      // P1 passes once: the empty window closes.
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      ...endPhase(0, 1),
      // Direct attack → window for P1 before damage.
      { type: 'DeclareAttack', payload: { playerIndex: 0, attackerInstanceId: 'p0-3' } },
      // P1's Trap has two possible targets → target prompt; it destroys the attacker, so the attack stops (no damage).
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-37', effectId: 'e1' },
      },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 1, promptId: 'effect-3-21', cardInstanceIds: ['p0-3'] },
      },
      ...endPhase(0, 3),
    ],
  },
  {
    name: 'on-summon-mandatory',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-trig-1',
        playerIds: ['alice', 'bob'],
        deckLists: [TRIGGER_DECK, TRIGGER_DECK],
      },
    },
    actions: [
      // T1 (P0): Normal Summon G_SUM_BURN (p0-32) → its mandatory OnSummon goes on the chain and resolves (300 damage).
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-32', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): a Set (p1-19 M1800) fires nothing.
      ...endPhase(1, 2),
      { type: 'SetMonster', payload: { playerIndex: 1, cardInstanceId: 'p1-19', zoneIndex: 0 } },
      ...endPhase(1, 4),
    ],
  },
  {
    name: 'on-summon-optional-declined',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-trig-1',
        playerIds: ['alice', 'bob'],
        deckLists: [TRIGGER_DECK, TRIGGER_DECK],
      },
    },
    actions: [
      // T1 (P0): Normal Summon G_SUM_HEAL (p0-33) → TriggerActivation prompt for P0.
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-33', zoneIndex: 0 } },
      // Rejected while the prompt waits: EndPhase, P1 answering, an id where none is expected.
      ...endPhase(0, 1),
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 1, promptId: 'trigger-1-3', cardInstanceIds: [], decline: true },
      },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'trigger-1-3', cardInstanceIds: ['p0-33'] },
      },
      // P0 declines: nothing happens.
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'trigger-1-3', cardInstanceIds: [], decline: true },
      },
      ...endPhase(0, 4),
      // T2 (P1): Normal Summon G_SUM_HEAL (p1-21) and accept: heal 500.
      ...endPhase(1, 2),
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-21', zoneIndex: 0 } },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 1, promptId: 'trigger-2-11', cardInstanceIds: [] },
      },
      ...endPhase(1, 4),
    ],
  },
  {
    name: 'on-destroyed-in-combat',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-trig-1',
        playerIds: ['alice', 'bob'],
        deckLists: [TRIGGER_DECK, TRIGGER_DECK],
      },
    },
    actions: [
      // T1 (P0): Normal Summon M1800 (p0-15).
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-15', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): Normal Summon G_DES_BURN (p1-34, ATK 1000) in Attack Position.
      ...endPhase(1, 2),
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-34', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): M1800 attacks it → destroyed, 800 to P1; its mandatory OnDestroyed (from the graveyard) → 400 to P0.
      ...endPhase(0, 3),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-15', targetInstanceId: 'p1-34' },
      },
      ...endPhase(0, 3),
    ],
  },
  {
    name: 'continuous-atk-buff',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-cont-1',
        playerIds: ['alice', 'bob'],
        deckLists: [CONT_DECK_P0, CONT_DECK_P1],
      },
    },
    actions: [
      // T1 (P0): Normal Summon M1800 (p0-17, Warrior).
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-17', zoneIndex: 1 } },
      ...endPhase(0, 4),
      // T2 (P1): Normal Summon M1800 (p1-37).
      ...endPhase(1, 2),
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-37', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): Summon G_CONT_BUFF (p0-38): p0-17 is now 2300 ATK → it destroys p1-37 (1800), 500 to P1.
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-38', zoneIndex: 0 } },
      // Rejected: a Continuous effect is never activated.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-38', effectId: 'e1' },
      },
      ...endPhase(0, 1),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-17', targetInstanceId: 'p1-37' },
      },
      ...endPhase(0, 3),
      // T4 (P1): G_KILL (p1-32) destroys the buff source p0-38, then Summon M1800 (p1-3).
      ...endPhase(1, 2),
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-32', effectId: 'e1' },
      },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 1, promptId: 'effect-4-25', cardInstanceIds: ['p0-38'] },
      },
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-3', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T5 (P0): the buff is gone at once: p0-17 (1800) attacks p1-3 (1800) → both destroyed, no damage.
      ...endPhase(0, 3),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-17', targetInstanceId: 'p1-3' },
      },
      ...endPhase(0, 3),
    ],
  },
  {
    name: 'special-summon-hand-and-graveyard',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-ss-2',
        playerIds: ['alice', 'bob'],
        deckLists: [SS_DECK, SS_DECK],
      },
    },
    actions: [
      // T1 (P0): G_SS_HAND (p0-16) → 3 monsters in hand → target prompt; Special Summon G_SUM_BURN (p0-7): its OnSummon
      // fires (300 to P1). The Normal Summon is still available: M1800 (p0-26).
      ...endPhase(0, 2),
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-16', effectId: 'e1' },
      },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'effect-1-3', cardInstanceIds: ['p0-7'] },
      },
      // Rejected: no monster in the graveyard yet.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-13', effectId: 'e1' },
      },
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-26', zoneIndex: 1 } },
      ...endPhase(0, 4),
      // T2 (P1): Normal Summon M1800 (p1-18).
      ...endPhase(1, 2),
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-18', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): M1800 vs M1800 → both destroyed; G_SUM_BURN attacks directly (1200). Main2: G_SS_GY (p0-13) brings
      // back M1800 (p0-26) from the graveyard into the lowest empty zone.
      ...endPhase(0, 3),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-26', targetInstanceId: 'p1-18' },
      },
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-7', targetInstanceId: null },
      },
      ...endPhase(0, 1),
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-13', effectId: 'e1' },
      },
      ...endPhase(0, 2),
    ],
  },
  {
    name: 'flip-summon-and-battle-flip-effect',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-flip-1',
        playerIds: ['alice', 'bob'],
        deckLists: [FLIP_DECK, FLIP_DECK],
      },
    },
    actions: [
      // T1 (P0): Set G_FLIP_BURN (p0-12). Rejected: Flip Summon on the turn it was Set.
      ...endPhase(0, 2),
      { type: 'SetMonster', payload: { playerIndex: 0, cardInstanceId: 'p0-12', zoneIndex: 0 } },
      { type: 'FlipSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-12' } },
      ...endPhase(0, 4),
      // T2 (P1): Set G_FLIP_BURN (p1-24).
      ...endPhase(1, 2),
      { type: 'SetMonster', payload: { playerIndex: 1, cardInstanceId: 'p1-24', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): Flip Summon p0-12 → its OnFlip: 400 to P1. Rejected: changing its position again this turn.
      // It then attacks the face-down p1-24 → flipped → P1's OnFlip: 400 to P0 (1000 vs DEF 1000: nothing destroyed).
      ...endPhase(0, 2),
      { type: 'FlipSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-12' } },
      {
        type: 'ChangePosition',
        payload: { playerIndex: 0, cardInstanceId: 'p0-12', toPosition: 'DefenseUp' },
      },
      ...endPhase(0, 1),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-12', targetInstanceId: 'p1-24' },
      },
      ...endPhase(0, 3),
    ],
  },
  {
    name: 'equip-buff-and-detach',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-eq-1',
        playerIds: ['alice', 'bob'],
        deckLists: [EQUIP_DECK, EQUIP_DECK],
      },
    },
    actions: [
      // T1 (P0): rejected — G_EQ_POWER (p0-21) with no face-up monster to equip. Then Summon M1000 (p0-31) and equip it:
      // the Equip stays face-up in Spell/Trap Zone 0, M1000 is now 1500 ATK.
      ...endPhase(0, 2),
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-21', effectId: 'e1' },
      },
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-31', zoneIndex: 0 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-21', effectId: 'e1' },
      },
      ...endPhase(0, 4),
      // T2 (P1): Summon M1800 (p1-2).
      ...endPhase(1, 2),
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-2', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): the equipped M1000 (1500) attacks M1800 → destroyed, 300 to P0; its Equip follows it to the graveyard.
      ...endPhase(0, 3),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-31', targetInstanceId: 'p1-2' },
      },
      ...endPhase(0, 3),
    ],
  },
  {
    name: 'field-spell-activate-replace',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-field-1',
        playerIds: ['alice', 'bob'],
        deckLists: [FIELD_DECK_P0, FIELD_DECK_P1],
      },
    },
    actions: [
      // T1 (P0) hand: p0-8 G_FIELD_WARRIOR, p0-1 G_FIELD_WEAK, p0-24 G_FIELD_WARRIOR, p0-34 M1000, p0-20 G_FIELD_WARRIOR.
      // Rejected: a Field Spell is Set in the Field Zone (zoneIndex 0 only). Then Set p0-8, Summon M1000 (p0-34) and
      // activate the Set Field Spell on the same turn: it stays face-up, M1000 is 1500. Rejected: activating the
      // face-up card again / its Continuous effect.
      ...endPhase(0, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-8', zoneIndex: 3 } },
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-8', zoneIndex: 0 } },
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-34', zoneIndex: 0 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-8', effectId: 'e1' },
      },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-8', effectId: 'e1' },
      },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-8', effectId: 'e2' },
      },
      ...endPhase(0, 4),
      // T2 (P1): Summon M1800 (p1-17), then G_KILL_ST (p1-20) destroys P0's Field Spell (its only Spell/Trap target).
      ...endPhase(1, 2),
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-17', zoneIndex: 0 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-20', effectId: 'e1' },
      },
      ...endPhase(1, 4),
      // T3 (P0): G_FIELD_WARRIOR (p0-24) from the hand, then G_FIELD_WEAK (p0-1) replaces it (the old one is sent to
      // the graveyard). M1000 attacks M1800 (now 1400): destroyed, 400 to P0 instead of 800.
      ...endPhase(0, 2),
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-24', effectId: 'e1' },
      },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-1', effectId: 'e1' },
      },
      ...endPhase(0, 1),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-34', targetInstanceId: 'p1-17' },
      },
      ...endPhase(0, 3),
      // T4 (P1): G_KILL_ST (p1-8) destroys the second Field Spell; M1800 attacks directly at its printed 1800.
      ...endPhase(1, 2),
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-8', effectId: 'e1' },
      },
      ...endPhase(1, 1),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 1, attackerInstanceId: 'p1-17', targetInstanceId: null },
      },
      ...endPhase(1, 3),
    ],
  },
  {
    name: 'continuous-spell-trap-stay',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-stay-1',
        playerIds: ['alice', 'bob'],
        deckLists: [STAY_DECK, STAY_DECK],
      },
    },
    actions: [
      // T1 (P0) hand: p0-39 M1000, p0-32 G_CONT_SPELL, p0-33 G_CONT_TRAP, p0-20 G_CONT_SPELL, p0-37 G_CONT_TRAP.
      // Summon M1000, activate the Continuous Spell from the hand (stays face-up in zone 0; M1000 is 1300). Rejected:
      // activating it again. Set the Continuous Trap (p0-33). Rejected: activating it this turn / a Trap from the hand.
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-39', zoneIndex: 0 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-32', effectId: 'e1' },
      },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-32', effectId: 'e1' },
      },
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-33', zoneIndex: 2 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-33', effectId: 'e1' },
      },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-37', effectId: 'e1' },
      },
      ...endPhase(0, 4),
      // T2 (P1) hand: p1-3 M1000, p1-38 G_DRAW, p1-17 G_CONT_TRAP, p1-22 G_DRAW, p1-36 G_CONT_SPELL (+ the draw).
      // Set G_DRAW (p1-38) and activate it from its zone on the same turn; P0 chains the Set Continuous Trap (p0-33):
      // the Trap resolves first and stays face-up, then G_DRAW resolves and goes to the graveyard.
      ...endPhase(1, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-38', zoneIndex: 1 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-38', effectId: 'e1' },
      },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-33', effectId: 'e1' },
      },
      // P1 Summons M1000 (p1-3: 700 under the Trap), Sets its own Continuous Spell (p1-36) and activates it (1000).
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-3', zoneIndex: 0 } },
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-36', zoneIndex: 0 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-36', effectId: 'e1' },
      },
      ...endPhase(1, 4),
      // T3 (P0): M1000 (1300) attacks P1's M1000 (1000 − 300 + 300 = 1000): destroyed, 300 to P1.
      ...endPhase(0, 3),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-39', targetInstanceId: 'p1-3' },
      },
      ...endPhase(0, 3),
    ],
  },
  {
    name: 'counter-negates-spell',
    definitions: GOLDEN_DEFS,
    start: negateStart,
    actions: [
      ...endPhase(0, 6),
      // T2 (P1): Set two Counter Traps. Rejected: a Trap is not activated on the turn it was Set.
      ...endPhase(1, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-36', zoneIndex: 0 } },
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-16', zoneIndex: 1 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-36', effectId: 'e1' },
      },
      ...endPhase(1, 4),
      // T3 (P0): G_DRAW (p0-12) → the window opens for P1. Rejected: P0 moving on while it is open.
      ...endPhase(0, 2),
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-12', effectId: 'e1' },
      },
      ...endPhase(0, 1),
      // P1 answers with the Counter Trap (pays 1000): the Spell is negated and sent to the graveyard, nothing is drawn.
      // P1's second Counter Trap cannot answer P1's own link, so the chain resolves in this call.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-36', effectId: 'e1' },
      },
      ...endPhase(0, 4),
      // T4 (P1). Rejected: a Counter Trap never starts a chain.
      ...endPhase(1, 2),
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-16', effectId: 'e1' },
      },
      ...endPhase(1, 1),
    ],
  },
  {
    name: 'counter-negates-continuous-spell',
    definitions: GOLDEN_DEFS,
    start: negateStart,
    actions: [
      // T1 (P0): Normal Summon M1800 (p0-31).
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-31', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): Set a Counter Trap.
      ...endPhase(1, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-36', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): the Continuous Spell (p0-5) goes face-up into Spell/Trap Zone 0 when it is activated; P1 negates the
      // activation: the card is sent to the graveyard and never stays. M1800 then attacks directly at its printed 1800
      // (with the Spell it would have been 2100).
      ...endPhase(0, 2),
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-5', effectId: 'e1' },
      },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-36', effectId: 'e1' },
      },
      ...endPhase(0, 1),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-31', targetInstanceId: null },
      },
      ...endPhase(0, 3),
    ],
  },
  {
    name: 'negate-attack',
    definitions: GOLDEN_DEFS,
    start: negateStart,
    actions: [
      // T1 (P0): Normal Summon M1800 (p0-31).
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-31', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): Set G_NEG_ATK (p1-21). Rejected: not on the turn it was Set.
      ...endPhase(1, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-21', zoneIndex: 2 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-21', effectId: 'e1' },
      },
      ...endPhase(1, 4),
      // T3 (P0). Rejected in Main Phase 1: with no window open only the turn player acts (and there is no attack yet).
      ...endPhase(0, 2),
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-21', effectId: 'e1' },
      },
      ...endPhase(0, 1),
      // Direct attack → window for P1 → the attack is negated: no damage. Rejected: the same monster attacking again.
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-31', targetInstanceId: null },
      },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-21', effectId: 'e1' },
      },
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-31', targetInstanceId: null },
      },
      ...endPhase(0, 3),
    ],
  },
  {
    name: 'negate-summon',
    definitions: GOLDEN_DEFS,
    start: negateStart,
    actions: [
      // T1 (P0): Set M1800 (p0-31).
      ...endPhase(0, 2),
      { type: 'SetMonster', payload: { playerIndex: 0, cardInstanceId: 'p0-31', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): Set G_NEG_SUM (p1-26).
      ...endPhase(1, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-26', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): Flip Summon p0-31 → Summon window for P1, who lets it through. Normal Summon M1800 (p0-11) → window
      // again → negated: the monster goes to the graveyard, the Normal Summon stays used. The Flip Summoned monster
      // attacks directly.
      ...endPhase(0, 2),
      { type: 'FlipSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-31' } },
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-11', zoneIndex: 1 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-26', effectId: 'e1' },
      },
      ...endPhase(0, 1),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-31', targetInstanceId: null },
      },
      ...endPhase(0, 3),
    ],
  },
  {
    name: 'summon-negated-before-trigger',
    definitions: GOLDEN_DEFS,
    start: summonWindowStart,
    actions: [
      ...summonWindowSetup,
      // T3 (P0): Normal Summon G_SUM_BURN (p0-32) → the Summon window opens BEFORE its mandatory OnSummon trigger
      // (task 4.4c). P1 negates the Summon: the monster goes to the graveyard and the 300 damage never happens.
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-32', zoneIndex: 1 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-16', effectId: 'e1' },
      },
      // Flip Summon G_FLIP_BURN (p0-17): P1 still holds a Set G_TRAP_BURN → window; P1 passes → the OnFlip trigger goes
      // on the chain; P1 may answer that link and passes again → 400 damage to P1.
      { type: 'FlipSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-17' } },
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      ...endPhase(0, 4),
    ],
  },
  {
    name: 'summon-window-then-trigger',
    definitions: GOLDEN_DEFS,
    start: summonWindowStart,
    actions: [
      ...summonWindowSetup,
      // T3 (P0): Normal Summon G_SUM_BURN (p0-32) → Summon window; P0 cannot go on while it is open (rejected).
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-32', zoneIndex: 1 } },
      { type: 'EndPhase', payload: { playerIndex: 0 } },
      // P1 lets the Summon through: only now the OnSummon trigger goes on the chain, and P1 gets a second window — on
      // that link — where the Set G_TRAP_BURN answers it (LIFO: 300 to P0, then 300 to P1).
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-5', effectId: 'e1' },
      },
      // Flip Summon G_FLIP_BURN (p0-17) → Summon window again → negated by G_NEG_SUM: no OnFlip damage.
      { type: 'FlipSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-17' } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-16', effectId: 'e1' },
      },
      ...endPhase(0, 4),
    ],
  },
  {
    name: 'equip-set-then-activate',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-eq-1',
        playerIds: ['alice', 'bob'],
        deckLists: [EQUIP_DECK, EQUIP_DECK],
      },
    },
    actions: [
      // Same deal as 'equip-buff-and-detach'. T1 (P0): Set G_EQ_POWER (p0-21) in Spell/Trap Zone 3. Rejected: activating
      // it with no face-up monster to equip. Summon M1000 (p0-31), then activate the Set Equip on the very turn it was
      // Set (task 4.4c): it flips face-up in Zone 3 (it does not move) and M1000 is now 1500 ATK. Rejected: activating
      // it again.
      ...endPhase(0, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-21', zoneIndex: 3 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-21', effectId: 'e1' },
      },
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-31', zoneIndex: 0 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-21', effectId: 'e1' },
      },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-21', effectId: 'e1' },
      },
      ...endPhase(0, 4),
      // T2 (P1): Summon M1800 (p1-2).
      ...endPhase(1, 2),
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-2', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): the equipped M1000 (1500) attacks M1800 → destroyed, 300 to P0; its Equip follows it to the graveyard.
      ...endPhase(0, 3),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-31', targetInstanceId: 'p1-2' },
      },
      ...endPhase(0, 3),
    ],
  },
  {
    name: 'fusion-hand-and-field',
    definitions: GOLDEN_DEFS,
    start: fusionStart,
    actions: [
      // T1 (P0): Summon M1000 (p0-25) in zone 2, then activate G_FUS (p0-32): nobody can respond, so its link resolves
      // at once and the chain pauses on SelectFusionMonster. Rejected while it is open: EndPhase, a monster that is not
      // in the Extra Deck. Pick G_FM_AB (p0-x0) → SelectFusionMaterials. Rejected: a card that is no material. Then
      // M1000 from the field + M1800 (p0-2) from the hand: both to the graveyard, G_FM_AB lands in zone 0.
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-25', zoneIndex: 2 } },
      activateBy(0, 'p0-32'),
      ...endPhase(0),
      fusionAnswer('fusion-1-4', ['p0-x9']),
      fusionAnswer('fusion-1-4', ['p0-x0']),
      fusionAnswer('fusion-1-5', ['p0-25', 'p0-31']),
      fusionAnswer('fusion-1-5', ['p0-25', 'p0-2']),
      // Rejected: the Normal Summon of the turn went to M1000 (the Fusion Summon did not use one, nor give one back);
      // the Fusion Monster cannot change position on the turn it was Summoned.
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-31', zoneIndex: 1 } },
      {
        type: 'ChangePosition',
        payload: { playerIndex: 0, cardInstanceId: 'p0-x0', toPosition: 'DefenseUp' },
      },
      ...endPhase(0, 4),
      // T2 (P1): nothing.
      ...endPhase(1, 6),
      // T3 (P0): G_FM_AB (2400) attacks directly.
      ...endPhase(0, 3),
      { type: 'DeclareAttack', payload: { playerIndex: 0, attackerInstanceId: 'p0-x0' } },
      ...endPhase(0, 3),
    ],
  },
  {
    name: 'fusion-then-onsummon-trigger',
    definitions: GOLDEN_DEFS,
    start: fusionStart,
    actions: [
      // T1 (P0): G_FUS (p0-32) → G_FM_SUM (p0-x1) with M1000 (p0-25) + M1800 (p0-2), both from the hand. Its OnSummon
      // mandatory trigger starts a NEW chain after the fusion chain: 300 damage to P1.
      ...endPhase(0, 2),
      activateBy(0, 'p0-32'),
      fusionAnswer('fusion-1-3', ['p0-x1']),
      fusionAnswer('fusion-1-4', ['p0-25', 'p0-2']),
      // Rejected: the second G_FUS (p0-20) has no materials left.
      activateBy(0, 'p0-20'),
      ...endPhase(0, 4),
    ],
  },
  {
    name: 'fusion-negated-keeps-materials',
    definitions: GOLDEN_DEFS,
    start: fusionStart,
    actions: [
      // T1 (P0): nothing. T2 (P1): Set G_NEG_ACT (p1-12).
      ...endPhase(0, 6),
      ...endPhase(1, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-12', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): G_FUS (p0-32) → P1 answers with G_NEG_ACT (1000 LP): the activation is negated, no prompt, no
      // material used, G_FUS goes to the graveyard. The second G_FUS (p0-20) then fuses with the very same materials.
      ...endPhase(0, 2),
      activateBy(0, 'p0-32'),
      activateBy(1, 'p1-12'),
      activateBy(0, 'p0-20'),
      fusionAnswer('fusion-3-18', ['p0-x0']),
      fusionAnswer('fusion-3-19', ['p0-25', 'p0-2']),
      ...endPhase(0, 4),
    ],
  },
  {
    name: 'fusion-material-destroyed-in-response',
    definitions: GOLDEN_DEFS,
    start: fusionStart,
    actions: [
      // T1 (P0): nothing. T2 (P1): Set G_TRAP_KILL (p1-29).
      ...endPhase(0, 6),
      ...endPhase(1, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-29', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): Summon M1000 (p0-25) → P1 passes in the Summon window. G_FUS (p0-32) → P1 chains G_TRAP_KILL on
      // M1000, the only copy of that material: when G_FUS resolves no Fusion Monster can be made, so it resolves
      // without effect (no prompt; M1800 stays in the hand, the Extra Deck is untouched). Rejected: the second G_FUS.
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-25', zoneIndex: 0 } },
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      activateBy(0, 'p0-32'),
      activateBy(1, 'p1-29'),
      activateBy(0, 'p0-20'),
      ...endPhase(0, 4),
    ],
  },
  {
    name: 'fusion-owed-trigger-after-pause',
    definitions: GOLDEN_DEFS,
    start: fusionStart,
    actions: [
      // T1 (P0): nothing. T2 (P1): Set G_TRAP_KILL (p1-29).
      ...endPhase(0, 6),
      ...endPhase(1, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-29', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): Summon G_DES_BURN (p0-31) → P1 passes. G_FUS (p0-32) → P1 chains G_TRAP_KILL on G_DES_BURN. Link 2
      // destroys it (its OnDestroyed trigger is now owed), then the chain pauses on G_FUS: the prompt carries the owed
      // trigger. After the Fusion Summon (G_FM_AB, materials from the hand) the owed trigger goes on a new chain:
      // 400 damage to P1.
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-31', zoneIndex: 0 } },
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      activateBy(0, 'p0-32'),
      activateBy(1, 'p1-29'),
      fusionAnswer('fusion-3-19', ['p0-x0']),
      fusionAnswer('fusion-3-20', ['p0-25', 'p0-2']),
      ...endPhase(0, 4),
    ],
  },
  {
    name: 'p7-equip-leaves-with-destroyed-monster',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-p7-1',
        playerIds: ['alice', 'bob'],
        deckLists: [EQUIP_TRIGGER_DECK_P0, EQUIP_TRIGGER_DECK_P1],
      },
    },
    actions: [
      // T1 (P0): Summon M1800 (p0-25).
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-25', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): Summon G_DES_KILL_ST (p1-12, ATK 1500).
      ...endPhase(1, 2),
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-12', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): G_EQ_WEAK (p0-0) on p1-12 (now 900 ATK); M1800 destroys it (900 to P1). The Equip — P0's only
      // Spell/Trap — follows the monster to the graveyard in that action, so the trigger has no target: NO prompt, and
      // P0 simply ends the turn (before task 4.8: a prompt for P1 that refused every answer).
      ...endPhase(0, 2),
      activateBy(0, 'p0-0'),
      ...endPhase(0, 1),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-25', targetInstanceId: 'p1-12' },
      },
      ...endPhase(0, 3),
      // T4 (P1): Summon the second G_DES_KILL_ST (p1-2).
      ...endPhase(1, 2),
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-2', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T5 (P0): Set G_DRAW (p0-17) in zone 2, G_EQ_WEAK (p0-33) on p1-2, M1800 destroys it. The trigger now asks P1,
      // listing ONLY the Set card. Rejected: choosing the Equip that left. Then P1 chooses the Set card: destroyed.
      ...endPhase(0, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-17', zoneIndex: 2 } },
      activateBy(0, 'p0-33'),
      ...endPhase(0, 1),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-25', targetInstanceId: 'p1-2' },
      },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 1, promptId: 'trigger-5-35', cardInstanceIds: ['p0-33'] },
      },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 1, promptId: 'trigger-5-35', cardInstanceIds: ['p0-17'] },
      },
      ...endPhase(0, 3),
    ],
  },
];
