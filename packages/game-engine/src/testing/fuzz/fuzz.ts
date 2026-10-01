import { staysOnField, type CardDefinition, type EffectDefinition } from '@yugi/shared';
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
};
const DECK_POOL = Object.keys(FUZZ_DEFS);
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

function randomStartDuel(rand: Rand, seed: string | number, duelNo: number): StartDuelAction {
  const deckSize = 8 + rand.int(33);
  const deck = () => Array.from({ length: deckSize }, () => rand.pick(DECK_POOL));
  const lp = () => 1000 + rand.int(4) * 1000;
  return {
    type: 'StartDuel',
    payload: {
      matchId: `fuzz-${seed}-${duelNo}`,
      seed: `${seed}#${duelNo}`,
      playerIds: ['alice', 'bob'],
      deckLists: [deck(), deck()],
      startingLP: [lp(), lp()],
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

/** A hand card + its first effect; cost ids are drawn from the matching pools (may still be wrong: engine decides). */
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
      effectId: rand.chance(0.05) ? 'bogus' : 'e1',
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
      (prompt.kind === 'SelectEffectTarget' || prompt.kind === 'TriggerActivation') &&
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
  }

  const ids = cardIds(state);
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

export function runFuzz(options: FuzzOptions): FuzzResult {
  const { seed, steps = 300, apply = applyAction } = options;
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
        ? randomStartDuel(rand, seed, duelsStarted)
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
    // Task 4.3.
    for (const e of result.events) {
      if (e.type === 'FieldSpellSet') fieldSpellSets++;
      if (e.type === 'FieldSpellDestroyed') fieldSpellsDestroyed++;
      if (e.type === 'CardSentToGraveyard') {
        if (e.from === 'FieldZone') {
          fieldSpellsReplaced++;
          continue;
        }
        // A Continuous Spell/Trap or Field Spell is never sent to the graveyard as "used": only replaced or destroyed.
        const def = FUZZ_DEFS[e.definitionId];
        if (def && staysOnField(def))
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
    },
  };
}
