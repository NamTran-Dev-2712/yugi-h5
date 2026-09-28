import {
  createRng,
  nextInt,
  type Action,
  type ActivateEffectAction,
  type CardInstance,
  type GameState,
  type PassPriorityAction,
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
 * Task 3.4b: + chain on the wire — Set Traps / Quick-Play / Counter Trap answering in chain and reaction windows,
 * trigger monsters (optional/mandatory OnSummon, OnDestroyed) with `TriggerActivation` prompts (accepted/declined),
 * a Continuous monster (effective stats in the view). The acting seat follows prompt → chain priority → turn player.
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

/** Task 3.4b: chain responders (Set Traps, Quick-Play, Counter Trap) — test-only. */
const chainCard = (
  id: string,
  kind: 'Trap' | 'Spell',
  subType: string,
  effect: Omit<EffectDefinition, 'id' | 'trigger'>,
): CardDefinition =>
  ({
    id,
    kind,
    name: text(id),
    subType,
    effects: [{ id: 'e1', trigger: { kind: 'Quick' }, ...effect }],
  }) as CardDefinition;

const FUZZ_CHAIN: readonly CardDefinition[] = [
  chainCard('FZ-TRAP-KILL', 'Trap', 'Normal', {
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  chainCard('FZ-TRAP-KILL-ST', 'Trap', 'Normal', {
    target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  chainCard('FZ-TRAP-BURN', 'Trap', 'Normal', {
    operations: [{ kind: 'Damage', amount: 200, target: 'opponent' }],
  }),
  chainCard('FZ-QP-HEAL', 'Spell', 'QuickPlay', {
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  chainCard('FZ-COUNTER', 'Trap', 'Counter', {
    operations: [{ kind: 'Damage', amount: 100, target: 'opponent' }],
  }),
];

/** Task 3.4b: trigger / Continuous monsters — test-only. */
const effectMonster = (id: string, atk: number, effect: Omit<EffectDefinition, 'id'>) =>
  ({
    id,
    kind: 'Monster',
    name: text(id),
    category: 'Effect',
    attribute: 'DARK',
    race: 'Fiend',
    level: 4,
    atk,
    def: 1000,
    effects: [{ id: 'e1', ...effect }],
  }) as CardDefinition;

const FUZZ_MONSTERS: readonly CardDefinition[] = [
  effectMonster('FZ-SUM-OPT-KILL', 1400, {
    trigger: { kind: 'OnSummon' },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  effectMonster('FZ-SUM-MAND', 1500, {
    trigger: { kind: 'OnSummon', mandatory: true },
    operations: [{ kind: 'Damage', amount: 100, target: 'opponent' }],
  }),
  effectMonster('FZ-DES-HEAL', 1600, {
    trigger: { kind: 'OnDestroyed', mandatory: true },
    operations: [{ kind: 'Heal', amount: 300, target: 'self' }],
  }),
  effectMonster('FZ-SUM-OPT-DRAW', 1300, {
    trigger: { kind: 'OnSummon' },
    operations: [{ kind: 'Draw', count: 1, target: 'self' }],
  }),
  effectMonster('FZ-CONT-WEAKEN', 1200, {
    trigger: { kind: 'Continuous' },
    operations: [{ kind: 'ModifyStat', stat: 'atk', amount: -500, side: 'opponent' }],
  }),
];

const DEFS = new Map<string, CardDefinition>(
  [...SAMPLE_CARDS, ...FUZZ_SPELLS, ...FUZZ_CHAIN, ...FUZZ_MONSTERS].map((c) => [c.id, c]),
);
const MONSTERS = SAMPLE_CARDS.filter((c) => c.kind === 'Monster').map((c) => c.id);

/**
 * 40 cards: SMP-101, SMP-201, every fuzz Spell ×3 (the 3.2 paths stay covered), every chain responder and effect
 * monster ×2, then plain monsters if any room is left.
 */
function deckList(): string[] {
  const deck = ['SMP-101', 'SMP-201'];
  for (const c of FUZZ_SPELLS) deck.push(c.id, c.id, c.id);
  for (const c of [...FUZZ_CHAIN, ...FUZZ_MONSTERS]) deck.push(c.id, c.id);
  for (let i = 0; deck.length < 40; i++) deck.push(MONSTERS[i % MONSTERS.length]!);
  return deck;
}

/** Who has to act: the prompted player, else the chain priority holder, else the turn player (as DuelManager). */
const actorOf = (state: GameState): 0 | 1 =>
  state.pendingPrompt?.playerIndex ?? state.chainWindow?.priorityPlayer ?? state.turnPlayerIndex;

const WATCHED = [
  'SpellTrapSet',
  'EffectActivated',
  'EffectResolved',
  'CardSentToGraveyard',
  'LifePointsRecovered',
  'LifePointsPaid',
  'SpellTrapDestroyed',
  'ChainLinkAdded',
  'ChainResolved',
] as const satisfies readonly EventView['type'][];

interface Stats {
  steps: number;
  duels: number;
  rejected: number;
  targetPrompts: number;
  /** Task 3.4b coverage. */
  triggerPrompts: number;
  declines: number;
  reactionWindows: number;
  multiLinkChains: number;
  setActivations: number;
  passes: number;
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
    // SelectEffectTarget / TriggerActivation payloads are for the prompted player only.
    const prompt = view.pendingPrompt;
    if (
      prompt &&
      (prompt.kind === 'SelectEffectTarget' || prompt.kind === 'TriggerActivation') &&
      prompt.playerIndex !== viewer &&
      prompt.payload !== null
    ) {
      stats.violations.push({
        viewer,
        path: '$.view.pendingPrompt.payload',
        instanceId: null,
        definitionId: '(prompt payload)',
        reason: `${prompt.kind} payload sent to the player who is not asked`,
      });
    }
    // The chain is public and identical for both seats; effective stats only on face-up monsters.
    const otherView = await manager.getView(duelId, (1 - viewer) as 0 | 1);
    if (JSON.stringify(view.chain) !== JSON.stringify(otherView.chain)) {
      stats.violations.push({
        viewer,
        path: '$.view.chain',
        instanceId: null,
        definitionId: '(chain)',
        reason: 'the two seats see different chains',
      });
    }
    for (const p of view.players) {
      const cards = [...p.board.spellTrapZones, ...p.hand, ...p.graveyard];
      for (const c of [...p.board.monsterZones, ...cards]) {
        if (!c || c.hidden || !c.effectiveStats) continue;
        const faceUpMonster =
          p.board.monsterZones.includes(c) &&
          (c.position === 'Attack' || c.position === 'DefenseUp');
        if (!faceUpMonster) {
          stats.violations.push({
            viewer,
            path: '$.view.players',
            instanceId: c.instanceId,
            definitionId: c.definitionId,
            reason: 'effectiveStats on a card that is not a face-up monster',
          });
        }
      }
    }
  }
}

/**
 * A Spell/Trap (or PassPriority) action the NON-acting seat tries with its own card: the engine must refuse it. Its
 * Set cards are tried too (they must not answer without priority).
 */
function illegalAttempt(
  state: GameState,
  rng: RngState,
): [SetSpellTrapAction | ActivateEffectAction | PassPriorityAction | null, RngState] {
  const actor = actorOf(state);
  const other = (1 - actor) as 0 | 1;
  const [mode, r0] = nextInt(rng, 4);
  if (mode === 0) return [{ type: 'PassPriority', payload: { playerIndex: other } }, r0];
  const cards: CardInstance[] = [
    ...state.players[other].hand,
    ...state.players[other].board.spellTrapZones.filter((c): c is CardInstance => c !== null),
  ];
  if (cards.length === 0) return [null, r0];
  const [card, r1] = pick(r0, cards);
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
  // In a window, answer more often than not (chains of 2+ links), else pass.
  const inWindow = candidates.some((a) => a.type === 'PassPriority');
  const answers = candidates.filter((a) => a.type === 'ActivateEffect');
  if (inWindow && answers.length > 0 && roll < 60) return pick(r1, answers);
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
    const actor = actorOf(state);

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
    if (action.type === 'PassPriority') stats.passes++;
    if (action.type === 'ResolvePendingPrompt' && action.payload.decline === true) stats.declines++;
    if (
      action.type === 'ActivateEffect' &&
      state.players[actor].board.spellTrapZones.some(
        (c) => c?.instanceId === action.payload.cardInstanceId,
      )
    ) {
      stats.setActivations++;
    }
    for (const e of result.eventsByViewer[0]) {
      stats.events.set(e.type, (stats.events.get(e.type) ?? 0) + 1);
      if (e.type === 'ChainLinkAdded' && e.chainIndex >= 2) stats.multiLinkChains++;
    }
    const after = await rawState(manager, duelId);
    if (after.pendingPrompt?.kind === 'SelectEffectTarget') stats.targetPrompts++;
    if (after.pendingPrompt?.kind === 'TriggerActivation') stats.triggerPrompts++;
    if (after.chainWindow?.reactionTo) stats.reactionWindows++;
    await checkBothViewers(manager, duelId, result, actor, stats);
  }
}

describe(`fuzz gate: no hidden definitionId over the wire with Spell/Trap (${SEEDS} seeds × ${STEPS} steps)`, () => {
  const stats: Stats = {
    steps: 0,
    duels: 0,
    rejected: 0,
    targetPrompts: 0,
    triggerPrompts: 0,
    declines: 0,
    reactionWindows: 0,
    multiLinkChains: 0,
    setActivations: 0,
    passes: 0,
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

  it('covered every task 3.2 / chain event, prompts, windows and refused attempts', () => {
    console.info('[fuzz 3.2b/3.4b]', {
      steps: stats.steps,
      duels: stats.duels,
      rejected: stats.rejected,
      targetPrompts: stats.targetPrompts,
      triggerPrompts: stats.triggerPrompts,
      declines: stats.declines,
      reactionWindows: stats.reactionWindows,
      multiLinkChains: stats.multiLinkChains,
      setActivations: stats.setActivations,
      passes: stats.passes,
      events: Object.fromEntries(WATCHED.map((t) => [t, stats.events.get(t) ?? 0])),
    });
    for (const t of WATCHED) expect(stats.events.get(t) ?? 0, t).toBeGreaterThan(0);
    expect(stats.targetPrompts).toBeGreaterThan(0);
    expect(stats.rejected).toBeGreaterThan(0);
    // Task 3.4b coverage.
    expect(stats.triggerPrompts, 'triggerPrompts').toBeGreaterThan(0);
    expect(stats.declines, 'declines').toBeGreaterThan(0);
    expect(stats.reactionWindows, 'reactionWindows').toBeGreaterThan(0);
    expect(stats.multiLinkChains, 'multiLinkChains').toBeGreaterThan(0);
    expect(stats.setActivations, 'setActivations').toBeGreaterThan(0);
    expect(stats.passes, 'passes').toBeGreaterThan(0);
    expect(stats.violations).toEqual([]);
  });
});
