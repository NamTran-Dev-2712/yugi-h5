import {
  createRng,
  nextInt,
  type Action,
  type ActivateEffectAction,
  type GameState,
  type RngState,
  type SetSpellTrapAction,
} from '@yugi/game-engine';
import {
  SAMPLE_CARDS,
  type CardDefinition,
  type EffectDefinition,
  type EventView,
  type PlayerAction,
} from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { DuelManager, type SubmitActionResult } from './duel-manager';
import { DuelServiceError } from './duel-errors';
import { InMemoryDuelStore } from './duel-store';
import { findLeaks, type LeakViolation } from './testing/leak-check';

/**
 * Task 3.2b GATE: "no response leaks the definitionId of a card hidden from its viewer", fuzzed through the same
 * DuelManager output the HTTP layer serializes (view + filtered events + legalActions), with Spell/Trap in play.
 * Each step picks a random legal action (Spell/Trap actions favoured), sometimes an illegal one, then checks
 * EVERYTHING each viewer would receive against the raw server state with `findLeaks` (shape-agnostic oracle).
 *
 * Default: FUZZ_SEEDS=8 × FUZZ_STEPS=120. Long run: `FUZZ_SEEDS=200 FUZZ_STEPS=400 pnpm --filter @yugi/api exec
 * vitest run src/modules/duels/event-visibility.fuzz.spec.ts`.
 */

const SEEDS = Number(process.env['FUZZ_SEEDS'] ?? 8);
const STEPS = Number(process.env['FUZZ_STEPS'] ?? 120);

const text = (s: string) => ({ vi: s, en: s });
/** Test-only Spells (not in SAMPLE_CARDS; no new card data): one per effect path of task 3.2. */
const spell = (id: string, effect: Omit<EffectDefinition, 'id'>): CardDefinition =>
  ({
    id,
    kind: 'Spell',
    name: text(id),
    subType: 'Normal',
    effects: [{ id: 'e1', ...effect }],
  }) as CardDefinition;

const FUZZ_SPELLS: readonly CardDefinition[] = [
  spell('FZ-BURN', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
  }),
  spell('FZ-HEAL', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Heal', amount: 500, target: 'self' }],
  }),
  spell('FZ-PAY', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'PayLP', amount: 300 }],
    operations: [{ kind: 'Draw', count: 1, target: 'self' }],
  }),
  spell('FZ-DISCARD', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Discard', count: 1 }],
    operations: [{ kind: 'Draw', count: 2, target: 'self' }],
  }),
  // No filter: may target face-down cards; several candidates open a SelectEffectTarget prompt.
  spell('FZ-KILL-ST', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  spell('FZ-KILL-MON', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
];

const DEFS = new Map<string, CardDefinition>(
  [...SAMPLE_CARDS, ...FUZZ_SPELLS].map((c) => [c.id, c]),
);
const MONSTERS = SAMPLE_CARDS.filter((c) => c.kind === 'Monster').map((c) => c.id);

/** 40 cards: monsters, SMP-101 (Draw 1), SMP-201 (Trap, Set only until 3.4) and every fuzz Spell. */
function deckList(): string[] {
  const spells = ['SMP-101', 'SMP-101', 'SMP-201', 'SMP-201', 'SMP-201'];
  for (const s of FUZZ_SPELLS) spells.push(s.id, s.id);
  const deck = [...spells];
  for (let i = 0; deck.length < 40; i++) deck.push(MONSTERS[i % MONSTERS.length]!);
  return deck;
}

const WATCHED = [
  'SpellTrapSet',
  'EffectActivated',
  'EffectResolved',
  'CardSentToGraveyard',
  'LifePointsRecovered',
  'LifePointsPaid',
  'SpellTrapDestroyed',
] as const satisfies readonly EventView['type'][];

interface Stats {
  steps: number;
  duels: number;
  rejected: number;
  targetPrompts: number;
  events: Map<string, number>;
  violations: LeakViolation[];
}

const pick = <T>(rng: RngState, items: readonly T[]): [T, RngState] => {
  const [i, next] = nextInt(rng, items.length);
  return [items[i]!, next];
};

async function rawState(manager: DuelManager, duelId: string): Promise<GameState> {
  return (await manager.getDuel(duelId)).state;
}

/** Everything viewer `v` would receive after this step, as the HTTP layer would send it. */
async function checkBothViewers(
  manager: DuelManager,
  duelId: string,
  result: SubmitActionResult | null,
  sender: 0 | 1,
  stats: Stats,
): Promise<void> {
  const state = await rawState(manager, duelId);
  for (const viewer of [0, 1] as const) {
    const view = await manager.getView(duelId, viewer);
    const payload = {
      view,
      legalActions: await manager.getLegalActions(duelId, viewer),
      events: result?.eventsByViewer[viewer] ?? [],
      ...(result && viewer === sender
        ? { post: { view: result.view, events: result.events, legal: result.legalActions } }
        : {}),
    };
    stats.violations.push(...findLeaks(state, viewer, payload));
    // The prompt payload of a SelectEffectTarget is for the prompted player only.
    const prompt = view.pendingPrompt;
    if (prompt && prompt.kind === 'SelectEffectTarget' && prompt.playerIndex !== viewer) {
      if (prompt.payload !== null)
        stats.violations.push({
          viewer,
          path: '$.view.pendingPrompt.payload',
          instanceId: null,
          definitionId: '(prompt payload)',
          reason: 'SelectEffectTarget payload sent to the player who is not asked',
        });
    }
  }
}

/** A Spell/Trap action the NON-acting seat tries with its own hand card: the engine must refuse it. */
function illegalAttempt(
  state: GameState,
  rng: RngState,
): [SetSpellTrapAction | ActivateEffectAction | null, RngState] {
  const actor = state.pendingPrompt?.playerIndex ?? state.turnPlayerIndex;
  const other = (1 - actor) as 0 | 1;
  const hand = state.players[other].hand;
  if (hand.length === 0) return [null, rng];
  const [card, r1] = pick(rng, hand);
  const [zone, r2] = nextInt(r1, 5);
  const [flip, r3] = nextInt(r2, 2);
  const action: SetSpellTrapAction | ActivateEffectAction =
    flip === 0
      ? {
          type: 'SetSpellTrap',
          payload: { playerIndex: other, cardInstanceId: card.instanceId, zoneIndex: zone },
        }
      : {
          type: 'ActivateEffect',
          payload: { playerIndex: other, cardInstanceId: card.instanceId, effectId: 'e1' },
        };
  return [action, r3];
}

function choose(legal: readonly PlayerAction[], rng: RngState): [PlayerAction, RngState] {
  const candidates = legal.filter((a) => a.type !== 'Surrender');
  const spellTrap = candidates.filter(
    (a) => a.type === 'SetSpellTrap' || a.type === 'ActivateEffect',
  );
  const [roll, r1] = nextInt(rng, 100);
  if (spellTrap.length > 0 && roll < 40) return pick(r1, spellTrap);
  if (candidates.length === 0) return pick(r1, legal); // only Surrender left
  return pick(r1, candidates);
}

async function fuzzSeed(seed: number, stats: Stats): Promise<void> {
  let duelN = 0;
  const manager = new DuelManager({
    store: new InMemoryDuelStore(),
    cardDefinitions: (id) => DEFS.get(id),
    newDuelId: () => `fuzz-${seed}-${++duelN}`,
  });
  let rng = createRng(`fuzz-3.2b-${seed}`);
  const newDuel = async () =>
    (
      await manager.createDuel({
        playerIds: ['p0', 'p1'],
        deckLists: [deckList(), deckList()],
        seed: `duel-${seed}-${duelN}`,
      })
    ).duelId;

  let duelId = await newDuel();
  stats.duels++;
  await checkBothViewers(manager, duelId, null, 0, stats);

  for (let step = 0; step < STEPS; step++) {
    let state = await rawState(manager, duelId);
    if (state.winnerIndex !== null) {
      duelId = await newDuel();
      stats.duels++;
      await checkBothViewers(manager, duelId, null, 0, stats);
      state = await rawState(manager, duelId);
    }
    const actor = state.pendingPrompt?.playerIndex ?? state.turnPlayerIndex;

    const [roll, r0] = nextInt(rng, 100);
    rng = r0;
    if (roll < 8) {
      const [bad, r1] = illegalAttempt(state, rng);
      rng = r1;
      if (bad !== null) {
        const before = state;
        const seat = bad.payload.playerIndex as 0 | 1;
        await expect(manager.submitAction(duelId, seat, bad)).rejects.toBeInstanceOf(
          DuelServiceError,
        );
        expect(await rawState(manager, duelId)).toBe(before); // refused = untouched
        stats.rejected++;
        continue;
      }
    }

    const legal = await manager.getLegalActions(duelId, actor);
    const [action, r2] = choose(legal, rng);
    rng = r2;
    // PlayerAction is the wire shape of an engine Action (asserted in duels.dto.ts).
    const result = await manager.submitAction(duelId, actor, action as unknown as Action);
    stats.steps++;
    for (const e of result.eventsByViewer[0])
      stats.events.set(e.type, (stats.events.get(e.type) ?? 0) + 1);
    const after = await rawState(manager, duelId);
    if (after.pendingPrompt?.kind === 'SelectEffectTarget') stats.targetPrompts++;
    await checkBothViewers(manager, duelId, result, actor, stats);
  }
}

describe(`fuzz gate: no hidden definitionId over the wire with Spell/Trap (${SEEDS} seeds × ${STEPS} steps)`, () => {
  const stats: Stats = {
    steps: 0,
    duels: 0,
    rejected: 0,
    targetPrompts: 0,
    events: new Map(),
    violations: [],
  };

  it.each(Array.from({ length: SEEDS }, (_, i) => i))(
    'seed %i: every response to both viewers passes the leak oracle',
    async (seed) => {
      const before = stats.violations.length;
      await fuzzSeed(seed, stats);
      expect(stats.violations.slice(before).slice(0, 5)).toEqual([]);
    },
    120_000,
  );

  it('covered every task 3.2 event, the target prompt and refused Spell/Trap attempts', () => {
    console.info('[fuzz 3.2b]', {
      steps: stats.steps,
      duels: stats.duels,
      rejected: stats.rejected,
      targetPrompts: stats.targetPrompts,
      events: Object.fromEntries(WATCHED.map((t) => [t, stats.events.get(t) ?? 0])),
    });
    for (const t of WATCHED) expect(stats.events.get(t) ?? 0, t).toBeGreaterThan(0);
    expect(stats.targetPrompts).toBeGreaterThan(0);
    expect(stats.rejected).toBeGreaterThan(0);
    expect(stats.violations).toEqual([]);
  });
});
