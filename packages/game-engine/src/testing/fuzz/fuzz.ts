import type { CardDefinition, EffectDefinition } from '@yugi/shared';
import type { Action, ActionContext, StartDuelAction } from '../../actions/types.js';
import type { ApplyActionResult } from '../../apply-action.js';
import { applyAction } from '../../apply-action.js';
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
  return {
    type: 'SetSpellTrap',
    payload: {
      playerIndex: p,
      cardInstanceId: rand.pick(hand).instanceId,
      zoneIndex: free.length > 0 ? rand.pick(free) : rand.int(5),
    },
  };
}

/** A hand card + its first effect; cost ids are drawn from the matching pools (may still be wrong: engine decides). */
function plausibleActivate(state: GameState, rand: Rand): Action | null {
  const p = state.turnPlayerIndex;
  const hand = state.players[p].hand;
  if (hand.length === 0) return null;
  const card = rand.pick(hand);
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
  switch (rand.int(10)) {
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
      prompt.kind === 'SelectEffectTarget' && Array.isArray(payload.candidateInstanceIds)
        ? payload.candidateInstanceIds
        : state.players[prompt.playerIndex].hand.map((c) => c.instanceId);
    return {
      type: 'ResolvePendingPrompt',
      payload: {
        playerIndex: prompt.playerIndex,
        promptId: prompt.promptId,
        cardInstanceIds: shuffledPrefix(pool, count, rand),
      },
    };
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
      action = rand.chance(0.25) ? endPhase : attack();
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
    const custom = options.onState?.(next, ctx, step);
    if (custom) return fail(step, custom);
    state = next;
  }

  return { ok: true, seed, log, stats: { accepted, rejected, duelsStarted, duelsEnded } };
}
