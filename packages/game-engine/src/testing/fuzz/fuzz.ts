import {
  SAMPLE_CARDS,
  staysOnField,
  type CardDefinition,
  type EffectDefinition,
} from '@yugi/shared';
import type { Action, ActionContext, StartDuelAction } from '../../actions/types.js';
import type { ApplyActionResult } from '../../apply-action.js';
import { applyAction } from '../../apply-action.js';
import { hasLegalActivation } from '../../actions/handlers/activate-effect.js';
import { activeContinuousEffects, effectiveStats } from '../../effects/continuous.js';
import { EngineError } from '../../errors.js';
import { createRng, nextInt } from '../../rng/seeded-rng.js';
import type { RngState } from '../../rng/seeded-rng.js';
import type { CardInstance, GameState, Phase } from '../../state/types.js';
import { deepFreeze } from '../deep-freeze.js';

/*
 * Seeded fuzz harness. It generates mostly-plausible (state-aware) plus some garbage actions, runs them through the
 * engine and checks invariants after every call. It asserts NOTHING about specific game outcomes — only that
 * "things that must never happen" never happen. Everything derives from `seed`, so a failure is reproducible from
 * (seed, log). Test-only: never imported by engine code.
 */

export type ApplyFn = (
  state: GameState | null,
  action: Action,
  ctx: ActionContext,
) => ApplyActionResult;

/**
 * Task 4.7 — the REAL cards of batch 2 (SMP-048…061, SMP-117…124, SMP-211…214), read from the shared pool so the fuzz
 * plays the very data players get. They sit in FUZZ_DEFS but OUTSIDE the default deck pool (BATCH2_ONLY below): only
 * the runs that ask for BATCH2_DECK_POOL ever draw them.
 */
const inRange = (id: string, from: number, to: number): boolean => {
  const n = Number(id.slice(4));
  return id.startsWith('SMP-') && n >= from && n <= to;
};
const BATCH2_REAL: Readonly<Record<string, CardDefinition>> = Object.fromEntries(
  SAMPLE_CARDS.filter(
    (c) => inRange(c.id, 48, 61) || inRange(c.id, 117, 124) || inRange(c.id, 211, 214),
  ).map((c) => [c.id, c]),
);

/** Small monster table (levels 2/4/5/7 exercise 0/1/2 tributes) plus a Spell for "not a monster" rejections. */
export const FUZZ_DEFS: Readonly<Record<string, CardDefinition>> = {
  M2: monster('M2', 2, 800, 400),
  M4: monster('M4', 4, 1600, 900),
  M5: monster('M5', 5, 2100, 1500),
  M7: monster('M7', 7, 2800, 2000),
  SP: spell('SP', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Draw', count: 1, target: 'self' }],
  }),
  SPK: spell('SPK', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  SPP: spell('SPP', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'PayLP', amount: 500 }],
    operations: [{ kind: 'Damage', amount: 700, target: 'opponent' }],
  }),
  SPD: spell('SPD', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Discard', count: 1 }],
    operations: [{ kind: 'Heal', amount: 300, target: 'self' }],
  }),
  // Test-only Quick-Play Spells (Speed 2): from the hand on your turn, or Set (task 3.4) on either turn.
  QPH: quickPlay('QPH', {
    operations: [{ kind: 'Heal', amount: 200, target: 'self' }],
  }),
  QPK: quickPlay('QPK', {
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  // Test-only Traps (task 3.4): Set, then activated from a later turn. Normal = Speed 2, Counter = Speed 3.
  TRB: trap('TRB', 'Normal', { operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }] }),
  TRK: trap('TRK', 'Normal', {
    target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  TRC: trap('TRC', 'Counter', {
    cost: [{ kind: 'PayLP', amount: 300 }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  // Test-only trigger effects (task 3.5): OnSummon mandatory / optional with a target, OnDestroyed optional / mandatory.
  MS: effectMonster('MS', 4, 1400, 1200, {
    trigger: { kind: 'OnSummon', mandatory: true },
    operations: [{ kind: 'Damage', amount: 200, target: 'opponent' }],
  }),
  MSO: effectMonster('MSO', 3, 1200, 1000, {
    trigger: { kind: 'OnSummon' },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  MD: effectMonster('MD', 4, 1500, 1000, {
    trigger: { kind: 'OnDestroyed' },
    operations: [{ kind: 'Draw', count: 1, target: 'self' }],
  }),
  MDM: effectMonster('MDM', 2, 700, 700, {
    trigger: { kind: 'OnDestroyed', mandatory: true },
    cost: [{ kind: 'PayLP', amount: 100 }],
    operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
  }),
  // Task 3.6 — Continuous effects (hold while face-up): +500 ATK to the other Warriors of its side; −700 ATK / −1000 DEF
  // to every opponent monster (clamps at 0); a Continuous Spell (never activatable until P4) and a script Spell.
  MCB: {
    ...effectMonster('MCB', 4, 1300, 1100, {
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
    }),
    race: 'Fiend',
  } as CardDefinition,
  MCW: effectMonster('MCW', 3, 900, 900, {
    trigger: { kind: 'Continuous' },
    operations: [
      { kind: 'ModifyStat', stat: 'atk', amount: -700, side: 'opponent' },
      { kind: 'ModifyStat', stat: 'def', amount: -1000, side: 'opponent' },
    ],
  }),
  CSB: {
    id: 'CSB',
    kind: 'Spell',
    name: { vi: 'Fuzz CSB', en: 'Fuzz CSB' },
    subType: 'Continuous',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'def', amount: 300, side: 'self' }],
      },
    ],
  },
  // Task 4.2c — Equip Spells: +500 ATK to one of yours / −500 ATK to one of the opponent's (clamps at 0).
  EQP: equipSpell('EQP', 'self', 500),
  EQW: equipSpell('EQW', 'opponent', -500),
  // Task 4.2b — Flip effects: OnFlip mandatory (300 damage) / optional with a target (destroy 1 opponent monster).
  MF: effectMonster('MF', 3, 1000, 1500, {
    trigger: { kind: 'OnFlip', mandatory: true },
    operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
  }),
  MFO: effectMonster('MFO', 2, 600, 1200, {
    trigger: { kind: 'OnFlip' },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  // Task 4.2a — Special Summon one of your monsters from the hand / from the graveyard (face-up Defense).
  SSH: spell('SSH', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'Hand', side: 'self', count: 1, filter: { kind: 'Monster' } },
    operations: [{ kind: 'SpecialSummon' }],
  }),
  SSG: spell('SSG', {
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
  SPH: spell('SPH', {
    trigger: { kind: 'Ignition' },
    scriptId: 'test.halve-opponent-lp',
    operations: [],
  }),
  TRD: {
    ...trap('TRD', 'Normal', { operations: [{ kind: 'Heal', amount: 100, target: 'self' }] }),
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
      },
      {
        id: 'e2',
        trigger: { kind: 'OnDestroyed', mandatory: true },
        target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  // Task 4.3 — cards that stay face-up after their activation resolves: two Field Spells (so one replaces the other),
  // a Continuous Spell and a Continuous Trap. `e1` activates the card, `e2` is the Continuous effect.
  FLD: stayingCard('FLD', 'Spell', 'Field', { stat: 'atk', amount: 400, side: 'self' }),
  FLD2: stayingCard('FLD2', 'Spell', 'Field', { stat: 'def', amount: -300, side: 'opponent' }),
  CSA: stayingCard('CSA', 'Spell', 'Continuous', { stat: 'atk', amount: 200, side: 'self' }),
  CTR: stayingCard('CTR', 'Trap', 'Continuous', { stat: 'atk', amount: -200, side: 'opponent' }),
  // A Normal Spell that destroys a Spell/Trap — or the Field Spell — of the opponent, so those cards also leave the field.
  SPS: spell('SPS', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  // Task 4.4 — Negate: a Normal Trap that negates an attack, a Counter Trap that negates a Spell/Trap activation (with
  // a cost, which must stay paid) and a Counter Trap that negates a Normal / Flip Summon.
  TNA: trap('TNA', 'Normal', { operations: [{ kind: 'NegateAttack' }] }),
  CNA: trap('CNA', 'Counter', {
    cost: [{ kind: 'PayLP', amount: 200 }],
    operations: [{ kind: 'NegateActivation', cardKinds: ['Spell', 'Trap'] }],
  }),
  CNS: trap('CNS', 'Counter', { operations: [{ kind: 'NegateSummon' }] }),
  // Task 4.5 — Fusion: a fusion Spell (hand + field), one that also takes materials from the Deck, and three Fusion
  // Monsters (2 materials; 3 with a repeated one; 2 with an OnSummon trigger). NOT in the default deck pool (below).
  FUS: spell('FUS', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'FusionSummon', sources: ['Hand', 'Field'] }],
  }),
  FUD: spell('FUD', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'FusionSummon', sources: ['Hand', 'Field', 'Deck'] }],
  }),
  FX1: fusionMonster('FX1', ['M2', 'M4']),
  FX2: fusionMonster('FX2', ['M2', 'M2', 'M4']),
  FXS: fusionMonster('FXS', ['M4', 'M5'], {
    trigger: { kind: 'OnSummon', mandatory: true },
    operations: [{ kind: 'Damage', amount: 200, target: 'opponent' }],
  }),
  ...BATCH2_REAL,
};
/** Task 4.5 cards: played only by the Fusion runs, so the default pool — and every older seed's game — is unchanged. */
const FUSION_ONLY: readonly string[] = ['FUS', 'FUD', 'FX1', 'FX2', 'FXS'];
/** Task 4.7 cards: played only by the batch-2 runs (same reason). */
const BATCH2_ONLY: readonly string[] = Object.keys(BATCH2_REAL);
const DECK_POOL = Object.keys(FUZZ_DEFS).filter(
  (id) => !FUSION_ONLY.includes(id) && !BATCH2_ONLY.includes(id),
);
const isBatch2Fusion = (id: string): boolean => {
  const def = BATCH2_REAL[id];
  return def?.kind === 'Monster' && def.category === 'Fusion';
};
/**
 * Task 4.7 — Main Deck pool of the batch-2 runs (own seeds `batch2-<i>`): every Main Deck card of the batch once, the
 * four fusion materials and the plain monsters their filters look for twice more, and the fusion Spell `FUS`.
 */
export const BATCH2_DECK_POOL: readonly string[] = [
  ...BATCH2_ONLY.filter((id) => !isBatch2Fusion(id)),
  ...['SMP-050', 'SMP-057', 'SMP-058', 'SMP-054', 'SMP-050', 'SMP-057', 'SMP-058', 'SMP-054'],
  ...['M2', 'M2', 'M4', 'M4', 'FUS', 'FUS'],
];
/** Task 4.7 — Extra Deck pool of the batch-2 runs: the two Fusion Monsters of the batch. */
export const BATCH2_EXTRA_DECK_POOL: readonly string[] = BATCH2_ONLY.filter(isBatch2Fusion);
/**
 * Task 4.5 — Main Deck pool of the Fusion runs (own seeds `fusion-<i>`): the materials, the two fusion Spells, and
 * cards that interfere (a negation of the Spell, a Quick-Play that destroys a material — or the Fusion Monster — in
 * response, a monster with an OnDestroyed trigger so triggers are owed across the pause).
 */
export const FUSION_DECK_POOL: readonly string[] = [
  ...['M2', 'M2', 'M4', 'M4', 'M5', 'MDM'],
  ...['FUS', 'FUS', 'FUS', 'FUD', 'CNA', 'CNA', 'CNA', 'QPK', 'QPK', 'QPK'],
];
/** Task 4.5 — Extra Deck pool of the Fusion runs (`FuzzOptions.extraDeckPool`). */
export const FUSION_EXTRA_DECK_POOL: readonly string[] = ['FX1', 'FX1', 'FX2', 'FXS'];
/**
 * Task 4.4 — a pool heavy on the Negate cards and on what they answer (Spells that stay on the field, attackers,
 * Summons), for the coverage run of its own (`FuzzOptions.deckPool`): with the full pool a negation is too rare to be
 * reached by random play. The default pool (and so every older seed's deck draw) is not affected by this list.
 */
export const NEGATE_DECK_POOL: readonly string[] = [
  ...['M2', 'M4', 'M4', 'SP', 'SP', 'CSA', 'FLD', 'EQP', 'TRB'],
  ...['TNA', 'TNA', 'CNA', 'CNA', 'CNA', 'CNS', 'CNS'],
];
/**
 * Task 4.4c — a pool of monsters with "when Summoned / flipped" triggers against cards that answer a Summon (a Summon
 * negation, a plain Trap), for the coverage run of the "Summon window before the triggers" order. Own seeds
 * (`sumwin-<i>`); the default pool and the Negate pool are not affected.
 */
export const SUMMON_TRIGGER_DECK_POOL: readonly string[] = [
  ...['MS', 'MS', 'MS', 'MSO', 'MF', 'MF', 'MFO', 'M2', 'M4'],
  ...['CNS', 'CNS', 'CNS', 'TRB', 'TRB', 'CNA'],
];
const PHASES: readonly Phase[] = ['Draw', 'Standby', 'Main1', 'Battle', 'Main2', 'End'];

function spell(id: string, effect: Omit<EffectDefinition, 'id'>): CardDefinition {
  return {
    id,
    kind: 'Spell',
    name: { vi: `Fuzz ${id}`, en: `Fuzz ${id}` },
    subType: 'Normal',
    effects: [{ id: 'e1', ...effect } as EffectDefinition],
  };
}

function quickPlay(id: string, effect: Omit<EffectDefinition, 'id' | 'trigger'>): CardDefinition {
  return {
    id,
    kind: 'Spell',
    name: { vi: `Fuzz ${id}`, en: `Fuzz ${id}` },
    subType: 'QuickPlay',
    effects: [{ id: 'e1', trigger: { kind: 'Quick' }, ...effect } as EffectDefinition],
  };
}

function trap(
  id: string,
  subType: 'Normal' | 'Counter',
  effect: Omit<EffectDefinition, 'id' | 'trigger'>,
): CardDefinition {
  return {
    id,
    kind: 'Trap',
    name: { vi: `Fuzz ${id}`, en: `Fuzz ${id}` },
    subType,
    effects: [{ id: 'e1', trigger: { kind: 'Quick' }, ...effect } as EffectDefinition],
  };
}

function equipSpell(id: string, side: 'self' | 'opponent', amount: number): CardDefinition {
  return {
    id,
    kind: 'Spell',
    name: { vi: `Fuzz ${id}`, en: `Fuzz ${id}` },
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
        operations: [{ kind: 'ModifyStat', stat: 'atk', amount, equipped: true }],
      },
    ],
  } as CardDefinition;
}

function stayingCard(
  id: string,
  kind: 'Spell' | 'Trap',
  subType: 'Field' | 'Continuous',
  modify: { stat: 'atk' | 'def'; amount: number; side: 'self' | 'opponent' },
): CardDefinition {
  return {
    id,
    kind,
    name: { vi: `Fuzz ${id}`, en: `Fuzz ${id}` },
    subType,
    effects: [
      { id: 'e1', trigger: { kind: kind === 'Trap' ? 'Quick' : 'Ignition' }, operations: [] },
      {
        id: 'e2',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', ...modify }],
      },
    ],
  } as CardDefinition;
}

function effectMonster(
  id: string,
  level: number,
  atk: number,
  def: number,
  effect: Omit<EffectDefinition, 'id'>,
): CardDefinition {
  return {
    ...monster(id, level, atk, def),
    category: 'Effect',
    effects: [{ id: 'e1', ...effect } as EffectDefinition],
  } as CardDefinition;
}

function fusionMonster(
  id: string,
  fusionMaterials: string[],
  effect?: Omit<EffectDefinition, 'id'>,
): CardDefinition {
  return {
    ...monster(id, 6, 2400, 2000),
    category: 'Fusion',
    fusionMaterials,
    ...(effect ? { effects: [{ id: 'e1', ...effect } as EffectDefinition] } : {}),
  } as CardDefinition;
}

const isFusionMonster = (definitionId: string): boolean => {
  const def = FUZZ_DEFS[definitionId];
  return def?.kind === 'Monster' && def.category === 'Fusion';
};

function monster(id: string, level: number, atk: number, def: number): CardDefinition {
  return {
    id,
    kind: 'Monster',
    name: { vi: `Fuzz ${id}`, en: `Fuzz ${id}` },
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level,
    atk,
    def,
  };
}

export interface FuzzOptions {
  readonly seed: string | number;
  /** Number of actions to run (StartDuel restarts count). Default 300. */
  readonly steps?: number;
  /** Engine under test; injectable so the harness itself can be tested against deliberately broken engines. */
  readonly apply?: ApplyFn;
  /** Extra per-state check run after every accepted action; return a violation message or null. */
  readonly onState?: (state: GameState, ctx: ActionContext, step: number) => string | null;
  /** Definition ids the random decks are drawn from. Default: every card of `FUZZ_DEFS`. */
  readonly deckPool?: readonly string[];
  /**
   * Task 4.5: definition ids the random Extra Decks (0–5 cards each) are drawn from. Omitted = no Extra Deck, and the
   * random stream is exactly the one older seeds always had.
   */
  readonly extraDeckPool?: readonly string[];
}

export interface FuzzStats {
  readonly accepted: Record<string, number>;
  readonly rejected: number;
  readonly duelsStarted: number;
  readonly duelsEnded: number;
  /** Longest chain seen in a state between actions (a chain that resolves within one action is not counted). */
  readonly maxChainLength: number;
  /** Links added from a Set card in the Spell/Trap Zone (task 3.4), and links of Spell Speed 3. */
  readonly fieldLinks: number;
  /** Reaction windows opened by an attack or a Summon/Set (task 3.4c), counted in the states between actions. */
  readonly reactionWindows: number;
  readonly speed3Links: number;
  /** Trigger links (task 3.5) and TriggerActivation prompts opened. */
  readonly triggerLinks: number;
  readonly triggerPrompts: number;
  /** States (between actions) where a Continuous effect changed some monster's ATK/DEF (task 3.6). */
  readonly continuousApplied: number;
  /** Monsters Special Summoned by an effect (task 4.2a). */
  readonly specialSummons: number;
  /** Equip Spells equipped, and Equip Spells that followed their monster to the graveyard (task 4.2c). */
  readonly equips: number;
  readonly equipsDetached: number;
  /** Flip Summons, and OnFlip effects put on the chain (task 4.2b). */
  readonly flipSummons: number;
  readonly flipLinks: number;
  /**
   * Task 4.3 — Field Spells Set / activated (links), replaced by their controller's new one, destroyed by an effect;
   * Continuous Spells/Traps that resolved and stayed face-up; Normal Spells activated from where they were Set.
   */
  readonly fieldSpellSets: number;
  readonly fieldSpellLinks: number;
  readonly fieldSpellsReplaced: number;
  readonly fieldSpellsDestroyed: number;
  readonly continuousCardsStayed: number;
  readonly setNormalSpellLinks: number;
  /**
   * Task 4.4 — activations negated (and, among them, cards that would have stayed on the field: Continuous / Field /
   * Equip), attacks negated, Summons negated, Counter Trap links.
   */
  readonly activationsNegated: number;
  readonly stayingCardsNegated: number;
  readonly attacksNegated: number;
  readonly summonsNegated: number;
  readonly counterTrapLinks: number;
  /**
   * Task 4.4c — Summon windows (states between actions) opened for a monster that has an OnSummon / OnFlip trigger
   * still owed; such Summons that were then negated (the trigger never happened); and trigger links / prompts of such
   * a monster that came once its Summon window was done.
   */
  readonly summonWindowsBeforeTrigger: number;
  readonly triggerSummonsNegated: number;
  readonly triggersAfterSummonWindow: number;
  /** Task 4.4c — Equip Spells activated from the Spell/Trap Zone they were Set in. */
  readonly setEquipLinks: number;
  /**
   * Task 4.5 — Fusion Summons done; materials taken from a Monster Zone / from the Deck; fusion Spells whose activation
   * was negated; fusion links that resolved without effect (no Fusion Monster could be made any more); OnSummon links
   * of a Fusion Monster; chains paused for a Fusion Summon with triggers owed by the links above.
   */
  readonly fusionSummons: number;
  readonly fusionFieldMaterials: number;
  readonly fusionDeckMaterials: number;
  readonly fusionsNegated: number;
  readonly fusionsWithoutEffect: number;
  readonly fusionTriggerLinks: number;
  readonly fusionPausesWithOwedTriggers: number;
}

export type FuzzResult =
  | {
      readonly ok: true;
      readonly seed: string | number;
      readonly log: Action[];
      readonly stats: FuzzStats;
    }
  | {
      readonly ok: false;
      readonly seed: string | number;
      /** 0-based index into `log` of the action after which the invariant broke. */
      readonly step: number;
      readonly violation: string;
      readonly log: Action[];
    };

/** Human-readable failure report: seed, step, violation and the exact action log to reproduce it. */
export function formatFuzzFailure(result: FuzzResult): string {
  if (result.ok) return 'fuzz ok';
  return [
    `Fuzz invariant violated — seed=${JSON.stringify(result.seed)} step=${result.step}`,
    `Violation: ${result.violation}`,
    `Action log (0..${result.step}):`,
    JSON.stringify(result.log.slice(0, result.step + 1)),
  ].join('\n');
}

interface Rand {
  int(maxExclusive: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
}

function makeRand(seed: string | number): Rand {
  let rng: RngState = createRng(seed);
  const int = (maxExclusive: number): number => {
    const [value, next] = nextInt(rng, maxExclusive);
    rng = next;
    return value;
  };
  return {
    int,
    chance: (p) => int(1_000_000) < p * 1_000_000,
    pick: (items) => items[int(items.length)]!,
  };
}

const other = (i: 0 | 1): 0 | 1 => (i === 0 ? 1 : 0);
const monstersOf = (state: GameState, i: 0 | 1): CardInstance[] =>
  state.players[i].board.monsterZones.filter((c): c is CardInstance => c !== null);

function allCards(state: GameState): CardInstance[] {
  const cards: CardInstance[] = [];
  for (const p of state.players) {
    cards.push(...p.hand, ...p.deck, ...p.graveyard, ...p.banished, ...p.extraDeck);
    for (const c of [...p.board.monsterZones, ...p.board.spellTrapZones, p.board.fieldZone]) {
      if (c) cards.push(c);
    }
  }
  // Cards activated from the HAND and waiting on the chain (task 3.3) are neither in the hand nor in the graveyard.
  // A Set card activated from the field stays in its zone (task 3.4): its link only holds a copy.
  cards.push(
    ...state.chainStack.filter((link) => link.source.zone === 'Hand').map((link) => link.card),
  );
  return cards;
}

/** Sorted instance ids across every zone; equal before/after means no card was lost or duplicated. */
function cardIds(state: GameState): string[] {
  return allCards(state)
    .map((c) => c.instanceId)
    .sort();
}

function randomStartDuel(
  rand: Rand,
  seed: string | number,
  duelNo: number,
  pool: readonly string[],
  extraPool: readonly string[] | undefined,
): StartDuelAction {
  const deckSize = 8 + rand.int(33);
  const deck = () => Array.from({ length: deckSize }, () => rand.pick(pool));
  const lp = () => 1000 + rand.int(4) * 1000;
  const deckLists: [string[], string[]] = [deck(), deck()];
  const startingLP: [number, number] = [lp(), lp()];
  // Task 4.5: drawn last and only when asked for, so a run without an Extra Deck pool consumes the same numbers as ever.
  const extra = (from: readonly string[]) =>
    Array.from({ length: rand.int(6) }, () => rand.pick(from));
  return {
    type: 'StartDuel',
    payload: {
      matchId: `fuzz-${seed}-${duelNo}`,
      seed: `${seed}#${duelNo}`,
      playerIds: ['alice', 'bob'],
      deckLists,
      startingLP,
      ...(extraPool ? { extraDeckLists: [extra(extraPool), extra(extraPool)] } : {}),
    },
  };
}

function tributesNeeded(definitionId: string): number {
  const def = FUZZ_DEFS[definitionId];
  if (!def || def.kind !== 'Monster') return 0;
  return def.level >= 7 ? 2 : def.level >= 5 ? 1 : 0;
}

function plausibleFromHand(
  state: GameState,
  rand: Rand,
  type: 'NormalSummon' | 'SetMonster',
): Action | null {
  const p = state.turnPlayerIndex;
  const hand = state.players[p].hand;
  if (hand.length === 0) return null;
  const card = rand.pick(hand);
  const own = monstersOf(state, p);
  const need = tributesNeeded(card.definitionId);
  const tributes = own.length >= need ? shuffledPrefix(own, need, rand) : [];
  const freeZones = state.players[p].board.monsterZones.flatMap((c, i) => (c === null ? [i] : []));
  const tributeZones = tributes.map((t) =>
    state.players[p].board.monsterZones.findIndex((c) => c?.instanceId === t.instanceId),
  );
  const zoneChoices = [...freeZones, ...tributeZones];
  const zoneIndex = zoneChoices.length > 0 ? rand.pick(zoneChoices) : rand.int(5);
  return {
    type,
    payload: {
      playerIndex: p,
      cardInstanceId: card.instanceId,
      zoneIndex,
      ...(tributes.length > 0 ? { tributeInstanceIds: tributes.map((t) => t.instanceId) } : {}),
    },
  };
}

function plausibleSetSpellTrap(state: GameState, rand: Rand): Action | null {
  const p = state.turnPlayerIndex;
  const hand = state.players[p].hand;
  if (hand.length === 0) return null;
  const board = state.players[p].board.spellTrapZones;
  const free = board.flatMap((c, i) => (c === null ? [i] : []));
  const card = rand.pick(hand);
  const anyZone = free.length > 0 ? rand.pick(free) : rand.int(5);
  // Task 4.3: a Field Spell goes to the Field Zone (zoneIndex 0); any other index must be rejected.
  const def = FUZZ_DEFS[card.definitionId];
  const isField = def?.kind === 'Spell' && def.subType === 'Field';
  return {
    type: 'SetSpellTrap',
    payload: {
      playerIndex: p,
      cardInstanceId: card.instanceId,
      zoneIndex: isField && rand.chance(0.9) ? 0 : anyZone,
    },
  };
}

/**
 * A hand card + its first effect (every fuzz card names it `e1`; the real batch-2 cards of task 4.7 have ids of their
 * own); cost ids are drawn from the matching pools (may still be wrong: engine decides).
 */
function plausibleActivate(state: GameState, rand: Rand): Action | null {
  const p = state.chainWindow?.priorityPlayer ?? state.turnPlayerIndex;
  const hand = state.players[p].hand;
  // Hand cards and (task 3.4) the player's own Spell/Trap Zone, face-down or not (face-up ones must be rejected),
  // and (task 4.3) their Field Zone.
  const board = state.players[p].board;
  const backrow = [...board.spellTrapZones, board.fieldZone].filter(
    (c): c is CardInstance => c !== null,
  );
  const pool = backrow.length > 0 && rand.chance(0.5) ? backrow : hand;
  if (pool.length === 0) return null;
  const card = rand.pick(pool);
  const def = FUZZ_DEFS[card.definitionId];
  const effect = def && def.kind !== 'Monster' ? def.effects?.[0] : undefined;
  const costIds: string[] = [];
  for (const cost of effect?.cost ?? []) {
    if (cost.kind === 'Discard') {
      costIds.push(
        ...shuffledPrefix(
          hand.filter((c) => c.instanceId !== card.instanceId),
          cost.count,
          rand,
        ).map((c) => c.instanceId),
      );
    } else if (cost.kind === 'Tribute') {
      costIds.push(
        ...shuffledPrefix(monstersOf(state, p), cost.count, rand).map((c) => c.instanceId),
      );
    }
  }
  return {
    type: 'ActivateEffect',
    payload: {
      playerIndex: p,
      cardInstanceId: card.instanceId,
      effectId: rand.chance(0.05) ? 'bogus' : (effect?.id ?? 'e1'),
      ...(costIds.length > 0 || rand.chance(0.1) ? { costInstanceIds: costIds } : {}),
    },
  };
}

function shuffledPrefix<T>(items: readonly T[], count: number, rand: Rand): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rand.int(i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, count);
}

function garbageAction(state: GameState, rand: Rand): Action {
  const wrong = other(state.turnPlayerIndex);
  const anyPlayer = rand.pick<0 | 1>([0, 1]);
  const anyCard = rand.pick([...allCards(state).map((c) => c.instanceId), 'bogus-id', '']);
  switch (rand.int(11)) {
    case 10:
      return { type: 'PassPriority', payload: { playerIndex: anyPlayer } };
    case 8:
      return {
        type: 'SetSpellTrap',
        payload: { playerIndex: anyPlayer, cardInstanceId: anyCard, zoneIndex: rand.int(7) - 1 },
      };
    case 9:
      return {
        type: 'ActivateEffect',
        payload: {
          playerIndex: anyPlayer,
          cardInstanceId: anyCard,
          effectId: rand.pick(['e1', 'bogus']),
          costInstanceIds: rand.pick([[], [anyCard], [anyCard, anyCard]]),
        },
      };
    case 0:
      return { type: 'EndPhase', payload: { playerIndex: wrong } };
    case 1:
      return {
        type: 'NormalSummon',
        payload: { playerIndex: anyPlayer, cardInstanceId: anyCard, zoneIndex: rand.int(9) - 2 },
      };
    case 2:
      return {
        type: 'SetMonster',
        payload: { playerIndex: anyPlayer, cardInstanceId: anyCard, zoneIndex: rand.int(7) },
      };
    case 3:
      return {
        type: 'ChangePosition',
        payload: {
          playerIndex: anyPlayer,
          cardInstanceId: anyCard,
          toPosition: rand.pick(['Attack', 'DefenseUp'] as const),
        },
      };
    case 4:
      return {
        type: 'DeclareAttack',
        payload: {
          playerIndex: anyPlayer,
          attackerInstanceId: anyCard,
          targetInstanceId: rand.pick([anyCard, null, 'bogus-id']),
        },
      };
    case 5:
      return { type: 'Draw', payload: { playerIndex: anyPlayer, count: rand.int(5) - 1 } };
    case 6:
      return {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: anyPlayer, promptId: 'bogus', cardInstanceIds: [anyCard] },
      };
    default:
      return {
        type: 'NormalSummon',
        payload: {
          playerIndex: anyPlayer,
          cardInstanceId: anyCard,
          zoneIndex: 0,
          tributeInstanceIds: [anyCard, anyCard],
        },
      };
  }
}

function nextAction(state: GameState, rand: Rand): Action {
  const p = state.turnPlayerIndex;

  if (state.pendingPrompt && rand.chance(0.7)) {
    const prompt = state.pendingPrompt;
    const payload = prompt.payload as { count?: unknown; candidateInstanceIds?: string[] };
    const count = typeof payload.count === 'number' ? payload.count : 1;
    const pool =
      (prompt.kind === 'SelectEffectTarget' ||
        prompt.kind === 'TriggerActivation' ||
        // Task 4.5: a random pick of the material candidates is often not the right set — it must then be rejected.
        prompt.kind === 'SelectFusionMonster' ||
        prompt.kind === 'SelectFusionMaterials') &&
      Array.isArray(payload.candidateInstanceIds)
        ? payload.candidateInstanceIds
        : state.players[prompt.playerIndex].hand.map((c) => c.instanceId);
    // Task 3.5: sometimes decline (rejected for a mandatory trigger / any other prompt).
    const decline = rand.chance(prompt.kind === 'TriggerActivation' ? 0.3 : 0.03);
    return {
      type: 'ResolvePendingPrompt',
      payload: {
        playerIndex: prompt.playerIndex,
        promptId: prompt.promptId,
        cardInstanceIds: decline && rand.chance(0.8) ? [] : shuffledPrefix(pool, count, rand),
        ...(decline ? { decline: true } : {}),
      },
    };
  }

  // Chain window (task 3.3): the holder mostly passes or chains a response; other picks must be rejected.
  if (state.chainWindow && !state.pendingPrompt && rand.chance(0.8)) {
    const holder = state.chainWindow.priorityPlayer;
    if (rand.chance(0.5)) return { type: 'PassPriority', payload: { playerIndex: holder } };
    const response = plausibleActivate(state, rand);
    if (response) return response;
  }

  if (rand.chance(0.15)) return garbageAction(state, rand);

  const own = monstersOf(state, p);
  const opp = monstersOf(state, other(p));
  const endPhase: Action = { type: 'EndPhase', payload: { playerIndex: p } };
  const roll = rand.int(100);

  // Rare, phase-independent actions.
  if (roll < 1) return { type: 'Surrender', payload: { playerIndex: rand.pick<0 | 1>([0, 1]) } };
  if (roll < 3) return { type: 'Draw', payload: { playerIndex: p, count: 1 + rand.int(2) } };

  const changePosition = (): Action | null =>
    own.length === 0
      ? null
      : {
          type: 'ChangePosition',
          payload: {
            playerIndex: p,
            cardInstanceId: rand.pick(own).instanceId,
            toPosition: rand.pick(['Attack', 'DefenseUp'] as const),
          },
        };
  // Task 4.2b: mostly a face-down monster of the player (face-up ones must be rejected).
  const flipSummon = (): Action | null => {
    if (own.length === 0) return null;
    const faceDown = own.filter((c) => c.position === 'DefenseDown');
    const pool = faceDown.length > 0 && rand.chance(0.85) ? faceDown : own;
    return {
      type: 'FlipSummon',
      payload: { playerIndex: p, cardInstanceId: rand.pick(pool).instanceId },
    };
  };
  const attack = (): Action | null => {
    if (own.length === 0) return null;
    const direct = opp.length === 0 || rand.chance(0.1);
    return {
      type: 'DeclareAttack',
      payload: {
        playerIndex: p,
        attackerInstanceId: rand.pick(own).instanceId,
        ...(direct ? {} : { targetInstanceId: rand.pick(opp).instanceId }),
      },
    };
  };
  const mainPhaseAction = (): Action | null => {
    const r = rand.int(100);
    if (r < 40) return plausibleFromHand(state, rand, 'NormalSummon');
    if (r < 60) return plausibleFromHand(state, rand, 'SetMonster');
    if (r < 70) return plausibleSetSpellTrap(state, rand);
    if (r < 85) return plausibleActivate(state, rand);
    if (r < 93) return flipSummon();
    return changePosition();
  };

  // Phase-aware choice so most actions have a chance to be legal; illegal picks still occur and must just be rejected.
  let action: Action | null = null;
  switch (state.phase) {
    case 'Main1':
    case 'Main2':
      action = rand.chance(state.phase === 'Main1' ? 0.25 : 0.4) ? endPhase : mainPhaseAction();
      break;
    case 'Battle':
      // Set Traps / Quick-Play may be activated in any phase (task 3.4).
      action = rand.chance(0.25)
        ? endPhase
        : rand.chance(0.15)
          ? (plausibleActivate(state, rand) ?? attack())
          : attack();
      break;
    default:
      action = rand.chance(0.9) ? endPhase : (mainPhaseAction() ?? attack());
  }
  return action ?? endPhase;
}

/** Returns a description of the first non-JSON-serializable value found, or null. */
function findNonPlainJson(value: unknown, path: string): string | null {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? null : `${path} is ${value}`;
  if (value === undefined) return path.endsWith(']') ? `${path} is undefined` : null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findNonPlainJson(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, child] of Object.entries(value)) {
      const found = findNonPlainJson(child, `${path}.${key}`);
      if (found) return found;
    }
    return null;
  }
  return `${path} is not plain JSON (${typeof value})`;
}

/** Invariants of a single state, independent of history. Returns the first violation or null. */
export function checkStateInvariants(
  state: GameState,
  initialIds: readonly string[],
): string | null {
  const plain = findNonPlainJson(state, 'state');
  if (plain) return `state not JSON-serializable: ${plain}`;

  if (!Number.isInteger(state.version) || state.version < 0) return `bad version ${state.version}`;
  if (!PHASES.includes(state.phase)) return `unknown phase ${state.phase}`;
  if (state.turnPlayerIndex !== 0 && state.turnPlayerIndex !== 1)
    return `bad turnPlayerIndex ${state.turnPlayerIndex}`;
  if (
    state.pendingPrompt &&
    state.pendingPrompt.playerIndex !== 0 &&
    state.pendingPrompt.playerIndex !== 1
  ) {
    return 'pendingPrompt.playerIndex out of range';
  }
  // A chain needs a window. A window with no chain is only an empty reaction window (task 3.4c): it says what it
  // reacts to, nobody passed yet, and it is held by the player who is NOT the turn player.
  if (state.chainWindow === null && state.chainStack.length > 0)
    return `no chainWindow with ${state.chainStack.length} chain link(s)`;
  if (state.chainWindow !== null && state.chainStack.length === 0) {
    const w = state.chainWindow;
    if (!w.reactionTo || w.passCount !== 0 || w.priorityPlayer === state.turnPlayerIndex)
      return `empty chainWindow ${JSON.stringify(w)} is not a valid reaction window`;
  }
  if (state.chainWindow && state.chainWindow.passCount !== 0 && state.chainWindow.passCount !== 1)
    return `chainWindow.passCount is ${state.chainWindow.passCount}`;
  for (const link of state.chainStack) {
    if (link.card.position !== null) return `chain link ${link.linkId} card has a position`;
  }
  // Task 3.4: a Spell/Trap is face-up on the field only while its own link (from that zone) waits on the chain —
  // or (task 4.2c) while it is equipped to a monster that is face-up on the field (no orphan Equip after any action),
  // or (task 4.3) because it is a Continuous Spell/Trap: those stay face-up once activated.
  const faceUpMonsterIds = new Set(
    [0, 1].flatMap((i) =>
      monstersOf(state, i as 0 | 1)
        .filter((c) => c.position !== 'DefenseDown')
        .map((c) => c.instanceId),
    ),
  );
  for (const i of [0, 1] as const) {
    const p = state.players[i];
    for (const c of [...p.hand, ...p.deck, ...p.graveyard, ...monstersOf(state, i)]) {
      if (c.equippedTo !== undefined)
        return `card ${c.instanceId} outside a Spell/Trap Zone has equippedTo`;
    }
    // Task 4.3: the Field Zone (one slot per player) only ever holds a Field Spell of that player, face-up or Set; a
    // Field Spell is never in a Spell/Trap Zone.
    const inField = p.board.fieldZone;
    if (inField) {
      const def = FUZZ_DEFS[inField.definitionId];
      if (!def || def.kind !== 'Spell' || def.subType !== 'Field')
        return `${inField.definitionId} (${inField.instanceId}) in a Field Zone is not a Field Spell`;
      if (inField.position !== 'Attack' && inField.position !== 'DefenseDown')
        return `Field Zone card ${inField.instanceId} has position ${inField.position}`;
      if (inField.ownerIndex !== i)
        return `Field Zone card ${inField.instanceId} of player ${i} is owned by ${inField.ownerIndex}`;
      if (inField.equippedTo !== undefined)
        return `Field Zone card ${inField.instanceId} has equippedTo`;
    }
    for (const c of p.board.spellTrapZones) {
      const def = c ? FUZZ_DEFS[c.definitionId] : undefined;
      if (c && def?.kind === 'Spell' && def.subType === 'Field')
        return `Field Spell ${c.instanceId} sits in a Spell/Trap Zone`;
    }
    const zones = p.board.spellTrapZones;
    for (let z = 0; z < zones.length; z++) {
      const c = zones[z];
      if (!c || c.position === 'DefenseDown') continue;
      if (c.equippedTo !== undefined) {
        if (!faceUpMonsterIds.has(c.equippedTo))
          return `Equip ${c.instanceId} in zone ${z} is equipped to ${c.equippedTo}, not a face-up monster`;
        continue;
      }
      const def = FUZZ_DEFS[c.definitionId];
      if (def && staysOnField(def)) continue;
      const waiting = state.chainStack.some(
        (l) =>
          l.card.instanceId === c.instanceId &&
          l.source.zone === 'SpellTrapZone' &&
          l.source.zoneIndex === z,
      );
      if (!waiting) return `face-up Spell/Trap ${c.instanceId} in zone ${z} has no chain link`;
    }
  }

  for (const i of [0, 1] as const) {
    const p = state.players[i];
    if (!Number.isInteger(p.lifePoints) || p.lifePoints < 0)
      return `player ${i} LP is ${p.lifePoints}`;
    if (p.lifePoints === 0 && state.winnerIndex === null)
      return `player ${i} has 0 LP but the duel is still running`;
    if (p.board.monsterZones.length !== 5 || p.board.spellTrapZones.length !== 5)
      return `player ${i} board size changed`;
    for (const c of [
      ...p.hand,
      ...p.deck,
      ...p.graveyard,
      ...p.banished,
      ...p.extraDeck,
      ...monstersOf(state, i),
    ]) {
      if (c.ownerIndex !== i)
        return `card ${c.instanceId} sits in player ${i}'s zones but is owned by ${c.ownerIndex}`;
    }
    for (const c of monstersOf(state, i)) {
      if (c.position === null) return `monster ${c.instanceId} on the field has no position`;
    }
    for (const c of [...p.hand, ...p.deck, ...p.graveyard]) {
      if (c.position !== null)
        return `card ${c.instanceId} outside the field has position ${c.position}`;
    }
    // Task 4.5: the Extra Deck holds Fusion Monsters only (off the field), and a Fusion Monster is never in a hand or a
    // Main Deck — it goes Extra Deck → Monster Zone → graveyard.
    for (const c of p.extraDeck) {
      if (!isFusionMonster(c.definitionId))
        return `${c.definitionId} (${c.instanceId}) in player ${i}'s Extra Deck is not a Fusion Monster`;
      if (c.position !== null) return `Extra Deck card ${c.instanceId} has position ${c.position}`;
    }
    for (const c of p.hand) {
      if (isFusionMonster(c.definitionId))
        return `Fusion Monster ${c.instanceId} is in player ${i}'s hand`;
    }
    for (const c of p.deck) {
      if (isFusionMonster(c.definitionId))
        return `Fusion Monster ${c.instanceId} is in player ${i}'s Deck`;
    }
  }

  // Task 4.5: a Fusion prompt only exists while its link — alone — is paused on the chain, held by the prompted player,
  // and only offers that player's own cards (Extra Deck for the monster; hand / Monster Zones / Deck for materials).
  const prompt = state.pendingPrompt;
  if (
    prompt &&
    (prompt.kind === 'SelectFusionMonster' || prompt.kind === 'SelectFusionMaterials')
  ) {
    const payload = prompt.payload as { linkId: string; candidateInstanceIds: readonly string[] };
    if (state.chainStack.length !== 1 || state.chainStack[0]?.linkId !== payload.linkId)
      return `${prompt.kind} prompt without its paused link alone on the chain`;
    if (state.chainStack[0].playerIndex !== prompt.playerIndex)
      return `${prompt.kind} prompt asks player ${prompt.playerIndex}, not the link's controller`;
    if (state.chainWindow?.priorityPlayer !== prompt.playerIndex)
      return `${prompt.kind} prompt while the other player holds the window`;
    const me = state.players[prompt.playerIndex];
    const own =
      prompt.kind === 'SelectFusionMonster'
        ? me.extraDeck
        : [...me.hand, ...monstersOf(state, prompt.playerIndex), ...me.deck];
    const ownIds = new Set(own.map((c) => c.instanceId));
    for (const id of payload.candidateInstanceIds) {
      if (!ownIds.has(id)) return `${prompt.kind} candidate ${id} is not the player's own card`;
    }
  }

  const ids = cardIds(state);
  // Task 4.5: no card is in two places at once (a material sent to the graveyard left where it was).
  for (let i = 1; i < ids.length; i++) {
    if (ids[i] === ids[i - 1]) return `card ${ids[i]} is in two places at once`;
  }
  if (ids.length !== initialIds.length)
    return `card count changed: ${initialIds.length} → ${ids.length}`;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] !== initialIds[i])
      return `card set changed (first difference at ${initialIds[i]} vs ${ids[i]})`;
  }
  return null;
}

/**
 * Task 3.6: effective ATK/DEF are never negative, and equal the printed stats when no Continuous effect is in force.
 * Returns [violation, whether some monster's stats were modified].
 */
function checkContinuous(state: GameState, ctx: ActionContext): [string | null, boolean] {
  const noneActive = activeContinuousEffects(state, ctx).length === 0;
  let modified = false;
  for (const i of [0, 1] as const) {
    for (const c of monstersOf(state, i)) {
      const printed = FUZZ_DEFS[c.definitionId];
      if (!printed || printed.kind !== 'Monster') continue;
      const s = effectiveStats(state, c, ctx);
      if (s.atk < 0 || s.def < 0)
        return [`${c.instanceId} has negative stats ${JSON.stringify(s)}`, false];
      const same = s.atk === printed.atk && s.def === printed.def;
      if (noneActive && !same)
        return [`${c.instanceId} modified with no Continuous effect in force`, false];
      if (!same) modified = true;
    }
  }
  return [null, modified];
}

/**
 * Task 4.4 — what must hold after an accepted action whose events negate something (ADR 065):
 * - a Counter Trap is only ever activated with a window already open (it never starts a chain);
 * - a negated activation never resolves afterwards, and its Spell/Trap card is in its owner's graveyard, not on the
 *   field (a monster's negated trigger leaves the monster where it was);
 * - a negated attack flips nothing, and the attacker (if still on the field) counts as having attacked;
 * - a monster whose Summon was negated is in its owner's graveyard, in no Monster Zone, and the Normal Summon of the
 *   turn is not given back;
 * - task 4.4c: none of that monster's effects is activated (or offered to its owner) after its Summon was negated.
 */
function checkNegations(
  prev: GameState,
  action: Action,
  next: GameState,
  events: ApplyActionResult['events'],
): {
  violation: string | null;
  negatedIds: string[];
  stayingCardsNegated: number;
  attacksNegated: number;
  summonsNegated: number;
  counterTrapLinks: number;
} {
  const out = {
    violation: null as string | null,
    negatedIds: [] as string[],
    stayingCardsNegated: 0,
    attacksNegated: 0,
    summonsNegated: 0,
    counterTrapLinks: 0,
  };
  const bad = (violation: string) => ({ ...out, violation });
  const isCounterTrap = (definitionId: string): boolean => {
    const def = FUZZ_DEFS[definitionId];
    return def?.kind === 'Trap' && def.subType === 'Counter';
  };
  const onField = (instanceId: string): boolean =>
    next.players.some((p) =>
      [...p.board.monsterZones, ...p.board.spellTrapZones, p.board.fieldZone].some(
        (c) => c?.instanceId === instanceId,
      ),
    );
  const inGraveyard = (owner: 0 | 1, instanceId: string): boolean =>
    next.players[owner].graveyard.some((c) => c.instanceId === instanceId);

  if (action.type === 'ActivateEffect') {
    const id = action.payload.cardInstanceId;
    const card = prev.players[action.payload.playerIndex].board.spellTrapZones.find(
      (c) => c?.instanceId === id,
    );
    if (card && isCounterTrap(card.definitionId)) {
      if (prev.chainWindow === null)
        return bad(`Counter Trap ${id} was activated with no window open (it started a chain)`);
    }
  }

  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.type === 'ChainLinkAdded' && isCounterTrap(e.definitionId)) out.counterTrapLinks++;
    if (e.type === 'ChainLinkNegated') {
      out.negatedIds.push(e.instanceId);
      const def = FUZZ_DEFS[e.definitionId];
      const later = events.slice(i + 1);
      if (
        later.some(
          (x) =>
            x.type === 'EffectResolved' &&
            x.instanceId === e.instanceId &&
            x.effectId === e.effectId,
        )
      )
        return bad(`negated link of ${e.instanceId} resolved anyway`);
      if (def && def.kind !== 'Monster') {
        if (onField(e.instanceId)) return bad(`negated card ${e.instanceId} is still on the field`);
        if (!inGraveyard(e.playerIndex, e.instanceId))
          return bad(`negated card ${e.instanceId} is not in its owner's graveyard`);
        if (staysOnField(def) || def.subType === 'Equip') out.stayingCardsNegated++;
      }
    }
    if (e.type === 'AttackNegated') {
      out.attacksNegated++;
      if (events.slice(i + 1).some((x) => x.type === 'MonsterFlipped'))
        return bad(`attack of ${e.attackerInstanceId} was negated but its battle went on`);
      const attacker = next.players[e.playerIndex].board.monsterZones.find(
        (c) => c?.instanceId === e.attackerInstanceId,
      );
      if (attacker && attacker.attackedTurn !== next.turnCount)
        return bad(`negated attacker ${e.attackerInstanceId} does not count as having attacked`);
    }
    if (e.type === 'SummonNegated') {
      out.summonsNegated++;
      if (onField(e.instanceId)) return bad(`${e.instanceId} is on the field after SummonNegated`);
      if (!inGraveyard(e.playerIndex, e.instanceId))
        return bad(`${e.instanceId} is not in the graveyard after SummonNegated`);
      if (
        prev.turnCount === next.turnCount &&
        prev.players[e.playerIndex].hasNormalSummonedThisTurn &&
        !next.players[e.playerIndex].hasNormalSummonedThisTurn
      )
        return bad(`SummonNegated gave the Normal Summon back to player ${e.playerIndex}`);
      // Task 4.4c [RULE]: a negated Summon never fires the monster's "when Summoned / flipped" triggers.
      if (
        events
          .slice(i + 1)
          .some((x) => x.type === 'EffectActivated' && x.instanceId === e.instanceId)
      )
        return bad(`an effect of ${e.instanceId} was activated after its Summon was negated`);
      const prompt = next.pendingPrompt;
      if (
        prompt?.kind === 'TriggerActivation' &&
        (prompt.payload as { trigger: { instanceId: string } }).trigger.instanceId === e.instanceId
      )
        return bad(`a trigger of ${e.instanceId} is offered after its Summon was negated`);
    }
  }
  return out;
}

/** Invariants relating a state to the one before the (accepted) action. */
function checkTransition(prev: GameState, next: GameState): string | null {
  if (next.version !== prev.version + 1)
    return `version ${prev.version} → ${next.version} (expected +1)`;
  if (next.turnCount < prev.turnCount)
    return `turnCount went backwards: ${prev.turnCount} → ${next.turnCount}`;
  if (prev.winnerIndex !== null && next.winnerIndex !== prev.winnerIndex)
    return 'winnerIndex changed after the duel ended';
  return null;
}

const hasFusionSummon = (definitionId: string): boolean =>
  (FUZZ_DEFS[definitionId]?.effects ?? []).some((e) =>
    e.operations.some((o) => o.kind === 'FusionSummon'),
  );

/**
 * Task 4.5 — what must hold after an accepted action whose events Fusion Summon (ADR 068):
 * - it only happens as the answer to the `SelectFusionMaterials` prompt of that player;
 * - the monster is a Fusion Monster that was in that player's Extra Deck and is in no Extra Deck any more; while it
 *   stands where it was Summoned it is face-up as announced and stamped with this turn;
 * - the materials are exactly the monster's `fusionMaterials`, each was the player's own card where its event says
 *   (hand / Monster Zone / Deck), and none is back in a hand or a Deck;
 * - the Normal Summon of the turn is not used;
 * - no material is sent without a Fusion Summon (a negated or effect-less fusion uses nothing).
 */
function checkFusion(
  prev: GameState,
  action: Action,
  next: GameState,
  events: ApplyActionResult['events'],
): { violation: string | null; summons: number; fieldMaterials: number; deckMaterials: number } {
  const out = { violation: null as string | null, summons: 0, fieldMaterials: 0, deckMaterials: 0 };
  const bad = (violation: string) => ({ ...out, violation });
  const sent = events.flatMap((e) => (e.type === 'FusionMaterialSent' ? [e] : []));
  const summoned = events.flatMap((e) => (e.type === 'MonsterFusionSummoned' ? [e] : []));
  if (sent.length > 0 && summoned.length === 0)
    return bad(`Fusion material ${sent[0]!.instanceId} was sent without a Fusion Summon`);
  if (summoned.length > 1) return bad('two Fusion Summons in one action');
  const e = summoned[0];
  if (!e) return out;

  const prompt = prev.pendingPrompt;
  if (
    action.type !== 'ResolvePendingPrompt' ||
    prompt?.kind !== 'SelectFusionMaterials' ||
    prompt.playerIndex !== e.playerIndex
  )
    return bad(`Fusion Summon of ${e.instanceId} outside its SelectFusionMaterials prompt`);
  const def = FUZZ_DEFS[e.definitionId];
  if (!def || def.kind !== 'Monster' || def.category !== 'Fusion')
    return bad(`${e.definitionId} (${e.instanceId}) was Fusion Summoned but is no Fusion Monster`);
  const before = prev.players[e.playerIndex];
  const after = next.players[e.playerIndex];
  if (!before.extraDeck.some((c) => c.instanceId === e.instanceId))
    return bad(`Fusion Monster ${e.instanceId} did not come from its controller's Extra Deck`);
  if (next.players.some((p) => p.extraDeck.some((c) => c.instanceId === e.instanceId)))
    return bad(`Fusion Monster ${e.instanceId} is still in an Extra Deck after its Summon`);
  const placed = after.board.monsterZones[e.zoneIndex];
  if (placed?.instanceId === e.instanceId) {
    if (placed.position !== e.position || placed.summonedTurn !== next.turnCount)
      return bad(`Fusion Monster ${e.instanceId} is not placed as its Summon event says`);
  }

  if (JSON.stringify(sent.map((m) => m.instanceId)) !== JSON.stringify(e.materialInstanceIds))
    return bad(`Fusion material events of ${e.instanceId} do not match its materials`);
  const provided = sent.map((m) => m.definitionId).sort();
  const required = [...(def.fusionMaterials ?? [])].sort();
  if (JSON.stringify(provided) !== JSON.stringify(required))
    return bad(`Fusion materials ${provided.join('+')} are not ${required.join('+')}`);
  for (const m of sent) {
    const wasThere =
      m.from === 'Hand'
        ? before.hand.some((c) => c.instanceId === m.instanceId)
        : m.from === 'Deck'
          ? before.deck.some((c) => c.instanceId === m.instanceId)
          : before.board.monsterZones[m.zoneIndex ?? -1]?.instanceId === m.instanceId;
    if (!wasThere)
      return bad(`Fusion material ${m.instanceId} was not in its controller's ${m.from}`);
    if ([...after.hand, ...after.deck].some((c) => c.instanceId === m.instanceId))
      return bad(`Fusion material ${m.instanceId} is back in a hand or a Deck`);
    if (m.from === 'MonsterZone') out.fieldMaterials++;
    if (m.from === 'Deck') out.deckMaterials++;
  }
  if (
    prev.turnCount === next.turnCount &&
    !before.hasNormalSummonedThisTurn &&
    after.hasNormalSummonedThisTurn
  )
    return bad(`Fusion Summon of ${e.instanceId} used the Normal Summon`);
  out.summons = 1;
  return out;
}

export function runFuzz(options: FuzzOptions): FuzzResult {
  const { seed, steps = 300, apply = applyAction, deckPool = DECK_POOL } = options;
  const rand = makeRand(seed);
  const ctx: ActionContext = { cardDefinitions: (id) => FUZZ_DEFS[id] };
  const log: Action[] = [];
  const accepted: Record<string, number> = {};
  let rejected = 0;
  let duelsStarted = 0;
  let duelsEnded = 0;
  let maxChainLength = 0;
  let fieldLinks = 0;
  let speed3Links = 0;
  let reactionWindows = 0;
  let triggerLinks = 0;
  let triggerPrompts = 0;
  let continuousApplied = 0;
  let specialSummons = 0;
  let flipSummons = 0;
  let equips = 0;
  let equipsDetached = 0;
  let flipLinks = 0;
  let fieldSpellSets = 0;
  let fieldSpellLinks = 0;
  let fieldSpellsReplaced = 0;
  let fieldSpellsDestroyed = 0;
  let continuousCardsStayed = 0;
  let setNormalSpellLinks = 0;
  let activationsNegated = 0;
  let stayingCardsNegated = 0;
  let attacksNegated = 0;
  let summonsNegated = 0;
  let counterTrapLinks = 0;
  let summonWindowsBeforeTrigger = 0;
  let triggerSummonsNegated = 0;
  let triggersAfterSummonWindow = 0;
  let setEquipLinks = 0;
  let fusionSummons = 0;
  let fusionFieldMaterials = 0;
  let fusionDeckMaterials = 0;
  let fusionsNegated = 0;
  let fusionsWithoutEffect = 0;
  let fusionTriggerLinks = 0;
  let fusionPausesWithOwedTriggers = 0;
  /** Does the Summoned monster have a trigger that this kind of Summon fires (OnSummon; OnFlip for a Flip Summon)? */
  const hasSummonTrigger = (owed: { type: string; definitionId: string }): boolean =>
    (FUZZ_DEFS[owed.definitionId]?.effects ?? []).some(
      (e) =>
        e.trigger.kind === 'OnSummon' ||
        (owed.type === 'FlipSummoned' && e.trigger.kind === 'OnFlip'),
    );
  let state: GameState | null = null;
  let initialIds: string[] = [];

  const fail = (step: number, violation: string): FuzzResult => ({
    ok: false,
    seed,
    step,
    violation,
    log,
  });

  for (let step = 0; step < steps; step++) {
    const needsNewDuel = state === null || (state.winnerIndex !== null && rand.chance(0.6));
    const action: Action =
      needsNewDuel || state === null
        ? randomStartDuel(rand, seed, duelsStarted, deckPool, options.extraDeckPool)
        : nextAction(state, rand);
    log.push(action);

    let result: ApplyActionResult;
    try {
      result = apply(action.type === 'StartDuel' ? null : state, action, ctx);
    } catch (error) {
      if (!(error instanceof EngineError)) {
        return fail(
          step,
          `uncontrolled exception (${action.type}): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
        );
      }
      if (action.type === 'StartDuel') return fail(step, `valid StartDuel rejected: ${error.code}`);
      rejected++;
      continue;
    }

    if (state !== null && state.winnerIndex !== null && action.type !== 'StartDuel') {
      return fail(step, `${action.type} was accepted after the duel ended`);
    }
    if (!Array.isArray(result.events)) return fail(step, 'events is not an array');

    const next = deepFreeze(result.state);
    accepted[action.type] = (accepted[action.type] ?? 0) + 1;

    if (action.type === 'StartDuel') {
      duelsStarted++;
      initialIds = cardIds(next);
    } else if (state !== null) {
      const broken = checkTransition(state, next);
      if (broken) return fail(step, broken);
      if (next.winnerIndex !== null && state.winnerIndex === null) duelsEnded++;
    }
    const broken = checkStateInvariants(next, initialIds);
    if (broken) return fail(step, broken);
    const [continuousBroken, modified] = checkContinuous(next, ctx);
    if (continuousBroken) return fail(step, continuousBroken);
    if (modified) continuousApplied++;
    // [ASSUMED] auto-pass: a window only stays open for a holder who can actually respond.
    const window = next.chainWindow;
    if (window && next.winnerIndex === null && next.pendingPrompt === null) {
      if (!hasLegalActivation(next, window.priorityPlayer, ctx))
        return fail(
          step,
          `chain window open for player ${window.priorityPlayer} who cannot respond`,
        );
    }
    // Task 4.4c: a Summon whose triggers are still owed only ever rides on the Summon window opened for that monster,
    // and while it does none of the monster's triggers is on the chain or offered yet (the window comes first [RULE]).
    const owed = window?.summonEvent;
    if (window && owed) {
      if (window.reactionTo?.kind !== 'Summon' || window.summoned?.instanceId !== owed.instanceId)
        return fail(step, `summonEvent of ${owed.instanceId} outside its Summon reaction window`);
      if (next.pendingPrompt?.kind === 'TriggerActivation')
        return fail(
          step,
          `a trigger is offered while the Summon window of ${owed.instanceId} is open`,
        );
      if (
        next.chainStack.some(
          (l) => l.linkId.startsWith('trigger-') && l.card.instanceId === owed.instanceId,
        )
      )
        return fail(
          step,
          `a trigger of ${owed.instanceId} is on the chain while its Summon window is open`,
        );
      if (hasSummonTrigger(owed) && window !== state?.chainWindow && next.chainStack.length === 0)
        summonWindowsBeforeTrigger++;
    }
    const wasOwed = state?.chainWindow?.summonEvent;
    if (wasOwed && hasSummonTrigger(wasOwed)) {
      if (
        result.events.some((e) => e.type === 'SummonNegated' && e.instanceId === wasOwed.instanceId)
      )
        triggerSummonsNegated++;
      const offered = next.pendingPrompt;
      if (
        result.events.some(
          (e) =>
            e.type === 'ChainLinkAdded' &&
            e.linkId.startsWith('trigger-') &&
            e.instanceId === wasOwed.instanceId,
        ) ||
        (offered?.kind === 'TriggerActivation' &&
          offered !== state?.pendingPrompt &&
          (offered.payload as { trigger: { instanceId: string } }).trigger.instanceId ===
            wasOwed.instanceId)
      )
        triggersAfterSummonWindow++;
    }
    maxChainLength = Math.max(maxChainLength, next.chainStack.length);
    if (next.chainWindow?.reactionTo && next.chainStack.length === 0) reactionWindows++;
    if (
      next.pendingPrompt?.kind === 'TriggerActivation' &&
      next.pendingPrompt !== state?.pendingPrompt
    )
      triggerPrompts++;
    // Task 4.2a: only monster cards ever stand in a Monster Zone; a Special Summon never uses the Normal Summon.
    for (const i of [0, 1] as const) {
      for (const c of monstersOf(next, i)) {
        if (FUZZ_DEFS[c.definitionId]?.kind !== 'Monster')
          return fail(step, `non-monster ${c.definitionId} (${c.instanceId}) in a Monster Zone`);
      }
    }
    flipSummons += result.events.filter((e) => e.type === 'FlipSummoned').length;
    // Task 4.4 — Counter Trap / Negate.
    const negatedIds = new Set<string>();
    if (state !== null) {
      const negation = checkNegations(state, action, next, result.events);
      if (negation.violation) return fail(step, negation.violation);
      for (const id of negation.negatedIds) negatedIds.add(id);
      activationsNegated += negation.negatedIds.length;
      stayingCardsNegated += negation.stayingCardsNegated;
      attacksNegated += negation.attacksNegated;
      summonsNegated += negation.summonsNegated;
      counterTrapLinks += negation.counterTrapLinks;
    }
    // Task 4.3.
    for (const e of result.events) {
      if (e.type === 'FieldSpellSet') fieldSpellSets++;
      if (e.type === 'FieldSpellDestroyed') fieldSpellsDestroyed++;
      if (e.type === 'CardSentToGraveyard') {
        if (e.from === 'FieldZone') {
          fieldSpellsReplaced++;
          continue;
        }
        // A Continuous Spell/Trap or Field Spell is never sent to the graveyard as "used": only replaced or destroyed —
        // or (task 4.4) because its activation was negated.
        const def = FUZZ_DEFS[e.definitionId];
        if (def && staysOnField(def) && !negatedIds.has(e.instanceId))
          return fail(
            step,
            `${e.definitionId} (${e.instanceId}) was sent to the graveyard after resolving`,
          );
      }
      if (e.type === 'EffectResolved') {
        const def = FUZZ_DEFS[e.definitionId];
        const stayed = next.players.some((p) =>
          p.board.spellTrapZones.some(
            (c) => c?.instanceId === e.instanceId && c.position === 'Attack',
          ),
        );
        if (def && def.kind !== 'Monster' && def.subType === 'Continuous' && stayed)
          continuousCardsStayed++;
      }
      if (e.type === 'ChainLinkAdded') {
        const def = FUZZ_DEFS[e.definitionId];
        if (def?.kind !== 'Spell') continue;
        if (def.subType === 'Field') fieldSpellLinks++;
        const wasSet = state?.players.some((p) =>
          p.board.spellTrapZones.some(
            (c) => c?.instanceId === e.instanceId && c.position === 'DefenseDown',
          ),
        );
        if (def.subType === 'Normal' && wasSet) setNormalSpellLinks++;
        // Task 4.4c: an Equip Spell activated from where it was Set flips in place — afterwards it is still in that
        // very zone (waiting / equipped) or gone from the field, never in another zone.
        if (def.subType === 'Equip' && wasSet && state) {
          setEquipLinks++;
          const zones = (s: GameState) => s.players[e.playerIndex].board.spellTrapZones;
          const from = zones(state).findIndex((c) => c?.instanceId === e.instanceId);
          const now = zones(next).findIndex((c) => c?.instanceId === e.instanceId);
          if (now !== -1 && now !== from)
            return fail(step, `Set Equip ${e.instanceId} moved from zone ${from} to zone ${now}`);
        }
      }
    }
    equips += result.events.filter((e) => e.type === 'CardEquipped').length;
    const wasEquipped = new Set(
      (state?.players ?? []).flatMap((p) =>
        p.board.spellTrapZones.flatMap((c) => (c?.equippedTo !== undefined ? [c.instanceId] : [])),
      ),
    );
    equipsDetached += result.events.filter(
      (e) => e.type === 'CardSentToGraveyard' && wasEquipped.has(e.instanceId),
    ).length;
    for (const e of result.events) {
      if (e.type !== 'MonsterSpecialSummoned') continue;
      specialSummons++;
      const before = state?.players[e.playerIndex];
      if (
        before &&
        state?.turnCount === next.turnCount &&
        !before.hasNormalSummonedThisTurn &&
        next.players[e.playerIndex].hasNormalSummonedThisTurn &&
        !result.events.some((x) => x.type === 'NormalSummoned' || x.type === 'MonsterSet')
      )
        return fail(step, `Special Summon of ${e.instanceId} used the Normal Summon`);
    }
    for (const e of result.events) {
      if (e.type !== 'ChainLinkAdded') continue;
      if (e.spellSpeed === 3) speed3Links++;
      if (e.linkId.startsWith('trigger-')) {
        triggerLinks++;
        const eff = FUZZ_DEFS[e.definitionId]?.effects?.find((x) => x.id === e.effectId);
        if (eff?.trigger.kind === 'OnFlip') flipLinks++;
      }
      if (
        state?.players.some((p) =>
          p.board.spellTrapZones.some((c) => c?.instanceId === e.instanceId),
        )
      )
        fieldLinks++;
    }
    // Task 4.5 — Fusion.
    if (state !== null) {
      const fusion = checkFusion(state, action, next, result.events);
      if (fusion.violation) return fail(step, fusion.violation);
      fusionSummons += fusion.summons;
      fusionFieldMaterials += fusion.fieldMaterials;
      fusionDeckMaterials += fusion.deckMaterials;
    }
    const fused = result.events.some((e) => e.type === 'MonsterFusionSummoned');
    for (const e of result.events) {
      if (e.type === 'ChainLinkNegated' && hasFusionSummon(e.definitionId)) fusionsNegated++;
      if (e.type === 'EffectResolved' && hasFusionSummon(e.definitionId) && !fused)
        fusionsWithoutEffect++;
      if (
        e.type === 'ChainLinkAdded' &&
        e.linkId.startsWith('trigger-') &&
        isFusionMonster(e.definitionId)
      )
        fusionTriggerLinks++;
    }
    const asked = next.pendingPrompt;
    if (
      asked?.kind === 'SelectFusionMonster' &&
      asked !== state?.pendingPrompt &&
      (asked.payload as { owedTriggers: readonly unknown[] }).owedTriggers.length > 0
    )
      fusionPausesWithOwedTriggers++;
    const custom = options.onState?.(next, ctx, step);
    if (custom) return fail(step, custom);
    state = next;
  }

  return {
    ok: true,
    seed,
    log,
    stats: {
      accepted,
      rejected,
      duelsStarted,
      duelsEnded,
      maxChainLength,
      fieldLinks,
      speed3Links,
      reactionWindows,
      triggerLinks,
      triggerPrompts,
      continuousApplied,
      specialSummons,
      flipSummons,
      flipLinks,
      equips,
      equipsDetached,
      fieldSpellSets,
      fieldSpellLinks,
      fieldSpellsReplaced,
      fieldSpellsDestroyed,
      continuousCardsStayed,
      setNormalSpellLinks,
      activationsNegated,
      stayingCardsNegated,
      attacksNegated,
      summonsNegated,
      counterTrapLinks,
      summonWindowsBeforeTrigger,
      triggerSummonsNegated,
      triggersAfterSummonWindow,
      setEquipLinks,
      fusionSummons,
      fusionFieldMaterials,
      fusionDeckMaterials,
      fusionsNegated,
      fusionsWithoutEffect,
      fusionTriggerLinks,
      fusionPausesWithOwedTriggers,
    },
  };
}
