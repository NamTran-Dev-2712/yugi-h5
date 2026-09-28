import type { Action, CardInstance, GameState } from '@yugi/game-engine';
import type { CardDefinition, EffectDefinition, PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { DuelManager, type CreateDuelConfig } from './duel-manager';
import { InMemoryDuelStore, initialStateOf } from './duel-store';
import { applyAction } from '@yugi/game-engine';

/**
 * Task 3.4b: chain, reaction windows and trigger prompts over the manager, `solo-vs-ai` (human seat 0, AI seat 1).
 * Test-only cards (not SAMPLE_CARDS). The AI must answer every window/prompt it holds inside the human's request
 * (never AI_LOOP_LIMIT / AiNoActionError), and a window the HUMAN holds must come back to them with PassPriority.
 */

const text = (s: string) => ({ vi: s, en: s });
const monster = (id: string, atk: number, effect?: Omit<EffectDefinition, 'id'>): CardDefinition =>
  ({
    id,
    kind: 'Monster',
    name: text(id),
    category: effect ? 'Effect' : 'Normal',
    attribute: 'DARK',
    race: 'Fiend',
    level: 4,
    atk,
    def: 1000,
    ...(effect ? { effects: [{ id: 'e1', ...effect }] } : {}),
  }) as CardDefinition;
const trap = (id: string, effect: Omit<EffectDefinition, 'id' | 'trigger'>): CardDefinition =>
  ({
    id,
    kind: 'Trap',
    name: text(id),
    subType: 'Normal',
    effects: [{ id: 'e1', trigger: { kind: 'Quick' }, ...effect }],
  }) as CardDefinition;

const DEFS = new Map<string, CardDefinition>(
  [
    monster('C-MON', 1500),
    monster('C-BIG', 2000),
    // Destroys one of the opponent's monsters: worth activating for the AI.
    trap('C-TRAP-KILL', {
      target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
      operations: [{ kind: 'Destroy' }],
    }),
    // Harmless for the opponent: the AI passes instead.
    trap('C-TRAP-HEAL', { operations: [{ kind: 'Heal', amount: 100, target: 'self' }] }),
    monster('C-SUM-OPT', 1800, {
      trigger: { kind: 'OnSummon' },
      operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
    }),
    monster('C-SUM-MAND', 1800, {
      trigger: { kind: 'OnSummon', mandatory: true },
      operations: [{ kind: 'Heal', amount: 200, target: 'self' }],
    }),
  ].map((c) => [c.id, c]),
);
const cardDefinitions = (id: string) => DEFS.get(id);

function makeManager() {
  const store = new InMemoryDuelStore();
  const manager = new DuelManager({ store, cardDefinitions, newDuelId: () => 'duel-c' });
  return { manager, store };
}

const config = (humanDeck: string, aiDeck: string): CreateDuelConfig => ({
  playerIds: ['human', 'ai'],
  deckLists: [Array(20).fill(humanDeck), Array(20).fill(aiDeck)],
  mode: 'solo-vs-ai',
  ownerId: 'human',
  aiSeat: 1,
  seed: 'chain-seed',
});

const inst = (
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1,
  position: CardInstance['position'],
  extra: Partial<CardInstance> = {},
): CardInstance => ({ instanceId, definitionId, ownerIndex, position, ...extra });

type Five = readonly [
  CardInstance | null,
  CardInstance | null,
  CardInstance | null,
  CardInstance | null,
  CardInstance | null,
];
const five = (xs: (CardInstance | null)[]): Five =>
  [0, 1, 2, 3, 4].map((i) => xs[i] ?? null) as unknown as Five;

/** Rewrites the stored state (turn, phase, boards, hands) the way the Sandbox would; the session stays replayable. */
async function arrange(
  store: InMemoryDuelStore,
  duelId: string,
  patch: {
    turnCount: number;
    turnPlayerIndex: 0 | 1;
    phase: GameState['phase'];
    monsters?: [(CardInstance | null)[], (CardInstance | null)[]];
    backrow?: [(CardInstance | null)[], (CardInstance | null)[]];
    hands?: [CardInstance[] | null, CardInstance[] | null];
  },
) {
  const session = (await store.get(duelId))!;
  const players = session.state.players.map((p, i) => ({
    ...p,
    hand: patch.hands?.[i] ?? p.hand,
    board: {
      ...p.board,
      monsterZones: patch.monsters ? five(patch.monsters[i]!) : p.board.monsterZones,
      spellTrapZones: patch.backrow ? five(patch.backrow[i]!) : p.board.spellTrapZones,
    },
  })) as unknown as GameState['players'];
  const state: GameState = {
    ...session.state,
    turnCount: patch.turnCount,
    turnPlayerIndex: patch.turnPlayerIndex,
    phase: patch.phase,
    players,
  };
  // Replay starts from the arranged state (like a Sandbox session).
  await store.save({ ...session, state, initialState: state, actionLog: [] });
}

/** legalActions come in the wire shape; the manager takes the engine's Action (same objects). */
const act = (a: PlayerAction): Action => a as unknown as Action;

const attack = (playerIndex: 0 | 1, attackerInstanceId: string): Action => ({
  type: 'DeclareAttack',
  payload: { playerIndex, attackerInstanceId, targetInstanceId: null },
});

describe('Chain over the wire (task 3.4b) — the AI answers the windows it holds', () => {
  it('human attacks, the AI activates a harmful Set Trap in the reaction window, all in one request', async () => {
    const { manager, store } = makeManager();
    const { duelId } = await manager.createDuel(config('C-MON', 'C-MON'));
    await arrange(store, duelId, {
      turnCount: 3,
      turnPlayerIndex: 0,
      phase: 'Battle',
      monsters: [[inst('h-atk', 'C-MON', 0, 'Attack', { summonedTurn: 1 })], []],
      backrow: [[], [inst('ai-trap', 'C-TRAP-KILL', 1, 'DefenseDown', { setTurn: 2 })]],
    });

    const result = await manager.submitAction(duelId, 0, attack(0, 'h-atk'));
    expect(result.aiActions.map((a) => a.action.type)).toContain('ActivateEffect');
    const types = result.events.map((e) => e.type);
    expect(types).toContain('ChainLinkAdded');
    expect(types).toContain('ChainResolved');
    expect(types).toContain('MonsterDestroyed');
    expect(types).not.toContain('DamageDealt'); // the attacker is gone: the attack stops
    expect(result.view.chainWindow).toBeNull();
    expect(result.view.players[1].lifePoints).toBe(8000);
    expect(result.legalActions.some((a) => a.type === 'EndPhase')).toBe(true);
  });

  it('human attacks, the AI holds a harmless Trap: it passes and the attack goes through', async () => {
    const { manager, store } = makeManager();
    const { duelId } = await manager.createDuel(config('C-MON', 'C-MON'));
    await arrange(store, duelId, {
      turnCount: 3,
      turnPlayerIndex: 0,
      phase: 'Battle',
      monsters: [[inst('h-atk', 'C-MON', 0, 'Attack', { summonedTurn: 1 })], []],
      backrow: [[], [inst('ai-trap', 'C-TRAP-HEAL', 1, 'DefenseDown', { setTurn: 2 })]],
    });

    const result = await manager.submitAction(duelId, 0, attack(0, 'h-atk'));
    expect(result.aiActions.map((a) => a.action)).toEqual([
      { type: 'PassPriority', payload: { playerIndex: 1 } },
    ]);
    expect(result.events.map((e) => e.type)).toContain('DamageDealt');
    expect(result.view.players[1].lifePoints).toBe(6500);
    // The Trap stays face-down: passing reveals nothing.
    expect(JSON.stringify(result.view)).not.toContain('C-TRAP-HEAL');
  });

  it('the AI attacks, the human holds a Trap: the response stops with the window open for the human', async () => {
    const { manager, store } = makeManager();
    const { duelId } = await manager.createDuel(config('C-MON', 'C-BIG'));
    // Human is in Main2 of turn 2 with a Set Trap; ending the turn lets the AI (turn 3) summon and attack.
    await arrange(store, duelId, {
      turnCount: 2,
      turnPlayerIndex: 0,
      phase: 'Main2',
      monsters: [[], [inst('ai-atk', 'C-BIG', 1, 'Attack', { summonedTurn: 1 })]],
      backrow: [[inst('h-trap', 'C-TRAP-KILL', 0, 'DefenseDown', { setTurn: 1 })], []],
    });

    let result = await manager.submitAction(duelId, 0, {
      type: 'EndPhase',
      payload: { playerIndex: 0 },
    });
    result = await manager.submitAction(duelId, 0, {
      type: 'EndPhase',
      payload: { playerIndex: 0 },
    });
    // First the AI summons: the human (who has a Trap that could answer) gets the Summon reaction window.
    expect(result.aiActions.map((a) => a.action.type)).toContain('NormalSummon');
    expect(result.view.chainWindow).toEqual({
      priorityPlayer: 0,
      passCount: 0,
      reactionTo: { kind: 'Summon' },
    });
    result = await manager.submitAction(duelId, 0, {
      type: 'PassPriority',
      payload: { playerIndex: 0 },
    });
    expect(result.aiActions.map((a) => a.action.type)).toContain('DeclareAttack');
    expect(result.view.chainWindow).toMatchObject({
      priorityPlayer: 0,
      passCount: 0,
      reactionTo: { kind: 'Attack', playerIndex: 1 },
    });
    expect(result.legalActions).toContainEqual({
      type: 'PassPriority',
      payload: { playerIndex: 0 },
    });
    expect(result.legalActions.some((a) => a.type === 'ActivateEffect')).toBe(true);

    // The human passes: damage happens, the AI finishes its turn, control comes back.
    const passed = await manager.submitAction(duelId, 0, {
      type: 'PassPriority',
      payload: { playerIndex: 0 },
    });
    expect(passed.events.map((e) => e.type)).toContain('DamageDealt');
    expect(passed.view.chainWindow).toBeNull();
    // Two attackers: the summoned C-BIG and the one already there (the human's Trap still answers the second).
    expect(passed.view.players[0].lifePoints).toBeLessThan(8000);
    const state = (await manager.getDuel(duelId)).state;
    expect(state.turnPlayerIndex).toBe(0);
  });

  it('the human may answer the AI attack with its Trap instead (chain resolves, attack stops)', async () => {
    const { manager, store } = makeManager();
    const { duelId } = await manager.createDuel(config('C-MON', 'C-BIG'));
    await arrange(store, duelId, {
      turnCount: 2,
      turnPlayerIndex: 0,
      phase: 'Main2',
      monsters: [[], [inst('ai-atk', 'C-BIG', 1, 'Attack', { summonedTurn: 1 })]],
      backrow: [[inst('h-trap', 'C-TRAP-KILL', 0, 'DefenseDown', { setTurn: 1 })], []],
    });
    await manager.submitAction(duelId, 0, { type: 'EndPhase', payload: { playerIndex: 0 } });
    await manager.submitAction(duelId, 0, { type: 'EndPhase', payload: { playerIndex: 0 } });
    // Pass the Summon reaction window; the AI then attacks and the human holds the Attack window.
    const opened = await manager.submitAction(duelId, 0, {
      type: 'PassPriority',
      payload: { playerIndex: 0 },
    });
    expect(opened.view.chainWindow?.reactionTo?.kind).toBe('Attack');
    const activate = opened.legalActions.find((a) => a.type === 'ActivateEffect')!;
    let result = await manager.submitAction(duelId, 0, act(activate));
    // Two AI monsters are valid targets: the engine asks which one (the attacker).
    expect(result.view.pendingPrompt?.kind).toBe('SelectEffectTarget');
    const attackerId =
      opened.view.chainWindow?.reactionTo?.kind === 'Attack'
        ? opened.view.chainWindow.reactionTo.attackerInstanceId
        : '';
    const pickAttacker = result.legalActions.find(
      (a) => a.type === 'ResolvePendingPrompt' && a.payload.cardInstanceIds[0] === attackerId,
    )!;
    result = await manager.submitAction(duelId, 0, act(pickAttacker));
    // The AI cannot answer the link, so the engine auto-passes it and the chain resolves in this call.
    const all = result.events.map((e) => e.type);
    expect(all).toContain('ChainLinkAdded');
    expect(all).toContain('ChainResolved');
    expect(result.aiActions.map((a) => a.action.type)).not.toContain('PassPriority');
    expect(all).toContain('MonsterDestroyed');
    // The attacker is gone, so that attack dealt nothing before the destruction.
    expect(all.indexOf('MonsterDestroyed')).toBeLessThan(
      all.indexOf('DamageDealt') === -1 ? Infinity : all.indexOf('DamageDealt'),
    );
    const session = await manager.getDuel(duelId);
    // Replay from the log reproduces the final state.
    let replayed = initialStateOf(session);
    for (const entry of session.actionLog) {
      replayed = applyAction(replayed, entry.action, { cardDefinitions }).state;
    }
    expect(replayed).toEqual(session.state);
  });
});

describe('Trigger prompts over the wire (task 3.4b)', () => {
  it('the AI answers its optional OnSummon prompt (accepts a harmful trigger)', async () => {
    const { manager, store } = makeManager();
    const { duelId } = await manager.createDuel(config('C-MON', 'C-SUM-OPT'));
    await arrange(store, duelId, { turnCount: 2, turnPlayerIndex: 0, phase: 'Main2' });
    await manager.submitAction(duelId, 0, { type: 'EndPhase', payload: { playerIndex: 0 } });
    const result = await manager.submitAction(duelId, 0, {
      type: 'EndPhase',
      payload: { playerIndex: 0 },
    });
    const ai = result.aiActions.map((a) => a.action);
    expect(ai.some((a) => a.type === 'NormalSummon')).toBe(true);
    const answer = ai.find((a) => a.type === 'ResolvePendingPrompt');
    expect(answer).toBeDefined();
    expect(answer?.type === 'ResolvePendingPrompt' && answer.payload.decline).not.toBe(true);
    expect(result.view.players[0].lifePoints).toBeLessThan(8000);
  });

  it('a mandatory trigger needs no answer from the AI and never stalls', async () => {
    const { manager, store } = makeManager();
    const { duelId } = await manager.createDuel(config('C-MON', 'C-SUM-MAND'));
    await arrange(store, duelId, { turnCount: 2, turnPlayerIndex: 0, phase: 'Main2' });
    await manager.submitAction(duelId, 0, { type: 'EndPhase', payload: { playerIndex: 0 } });
    const result = await manager.submitAction(duelId, 0, {
      type: 'EndPhase',
      payload: { playerIndex: 0 },
    });
    expect(result.events.map((e) => e.type)).toContain('ChainLinkAdded');
    expect(result.view.players[1].lifePoints).toBe(8200);
    expect((await manager.getDuel(duelId)).state.turnPlayerIndex).toBe(0);
  });

  it('the human gets a TriggerActivation prompt with decline in legalActions; the AI never sees its payload', async () => {
    const { manager, store } = makeManager();
    const { duelId } = await manager.createDuel(config('C-SUM-OPT', 'C-MON'));
    await arrange(store, duelId, {
      turnCount: 3,
      turnPlayerIndex: 0,
      phase: 'Main1',
      hands: [[inst('h-sum', 'C-SUM-OPT', 0, null)], null],
    });
    const result = await manager.submitAction(duelId, 0, {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'h-sum', zoneIndex: 0 },
    });
    expect(result.view.pendingPrompt?.kind).toBe('TriggerActivation');
    const decline = result.legalActions.find(
      (a) => a.type === 'ResolvePendingPrompt' && a.payload.decline === true,
    );
    expect(decline).toBeDefined();
    expect((await manager.getView(duelId, 1)).pendingPrompt?.payload).toBeNull();
    const declined = await manager.submitAction(duelId, 0, act(decline!));
    expect(declined.view.pendingPrompt).toBeNull();
    expect(declined.view.players[1].lifePoints).toBe(8000);
  });
});
