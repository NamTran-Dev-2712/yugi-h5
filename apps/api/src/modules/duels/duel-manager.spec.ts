import { applyAction, type Action, type GameState } from '@yugi/game-engine';
import { SAMPLE_CARDS, type CardDefinition } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { DuelServiceError } from './duel-errors';
import { DuelManager, type CreateDuelConfig } from './duel-manager';
import { InMemoryDuelStore, type DuelSession, type DuelStore, initialStateOf } from './duel-store';

const defs = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const resolver = (id: string): CardDefinition | undefined => defs.get(id);

/** p0 deck = all SMP-001 (level 3, always summonable); p1 deck = all SMP-002 (distinct id for leak scans). */
const CONFIG: CreateDuelConfig = {
  playerIds: ['alice', 'bob'],
  deckLists: [Array(20).fill('SMP-001'), Array(20).fill('SMP-002')],
};

function makeManager(store: DuelStore = new InMemoryDuelStore(), cardDefinitions = resolver) {
  let n = 0;
  const manager = new DuelManager({
    store,
    cardDefinitions,
    newDuelId: () => `duel-${++n}`,
    newSeed: () => `seed-${n}`,
  });
  return { manager, store };
}

async function setup() {
  const { manager, store } = makeManager();
  const { duelId } = await manager.createDuel(CONFIG);
  return { manager, store, duelId };
}

const endPhase = (playerIndex: 0 | 1): Action => ({ type: 'EndPhase', payload: { playerIndex } });

/** Draw → Standby → Main1 for player 0 (turn 1: no draw). */
async function toMain1(manager: DuelManager, duelId: string) {
  await manager.submitAction(duelId, 0, endPhase(0));
  await manager.submitAction(duelId, 0, endPhase(0));
}

async function stateOf(manager: DuelManager, duelId: string): Promise<GameState> {
  const session = await manager.getDuel(duelId);
  return session.state;
}

async function expectDuelError(p: Promise<unknown>, code: string, engineCode?: string) {
  const err = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DuelServiceError);
  expect((err as DuelServiceError).code).toBe(code);
  if (engineCode) expect((err as DuelServiceError).engineCode).toBe(engineCode);
}

describe('DuelManager.createDuel', () => {
  it('creates a session and exposes the initial view per viewer', async () => {
    const { manager, duelId } = await setup();
    const view = await manager.getView(duelId, 0);
    expect(view.viewerIndex).toBe(0);
    expect(view.players[0].handCount).toBe(5);
    expect(view.players[0].deckCount).toBe(15);
    expect(view.players[0].lifePoints).toBe(8000);
    expect(view.version).toBe(1);
    const session = await manager.getDuel(duelId);
    expect(session.seed).toBe('seed-1');
    expect(session.actionLog).toEqual([]);
  });

  it('rejects malformed config with INVALID_CONFIG and creates nothing', async () => {
    const { manager, store } = makeManager();
    await expectDuelError(
      manager.createDuel({ ...CONFIG, playerIds: ['alice'] } as unknown as CreateDuelConfig),
      'INVALID_CONFIG',
    );
    await expectDuelError(manager.createDuel({ ...CONFIG, deckLists: [[], []] }), 'INVALID_CONFIG');
    expect(await store.get('duel-1')).toBeUndefined();
  });

  it('rejects unknown card ids with UNKNOWN_CARD', async () => {
    const { manager } = makeManager();
    await expectDuelError(
      manager.createDuel({ ...CONFIG, deckLists: [['NOPE-1'], ['SMP-001']] }),
      'UNKNOWN_CARD',
    );
  });
});

describe('DuelManager.submitAction', () => {
  it('applies a legal action, returns the sender view + events, and logs it', async () => {
    const { manager, duelId } = await setup();
    await toMain1(manager, duelId);
    const before = await stateOf(manager, duelId);
    const card = before.players[0].hand[0]!;
    const result = await manager.submitAction(duelId, 0, {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: card.instanceId, zoneIndex: 0 },
    });
    expect(result.view.viewerIndex).toBe(0);
    expect(result.view.version).toBe(before.version + 1);
    expect(result.view.players[0].board.monsterZones[0]).toMatchObject({
      hidden: false,
      definitionId: 'SMP-001',
      position: 'Attack',
    });
    expect(result.events.map((e) => e.type)).toEqual(['NormalSummoned']);
    const session = await manager.getDuel(duelId);
    expect(session.actionLog.map((l) => [l.playerIndex, l.action.type, l.version])).toEqual([
      [0, 'EndPhase', 2],
      [0, 'EndPhase', 3],
      [0, 'NormalSummon', 4],
    ]);
  });

  it('rejects the wrong turn player with ACTION_REJECTED + engine code', async () => {
    const { manager, duelId } = await setup();
    await expectDuelError(
      manager.submitAction(duelId, 1, endPhase(1)),
      'ACTION_REJECTED',
      'NOT_TURN_PLAYER',
    );
  });

  it('rejects impersonation (payload.playerIndex != caller) with PLAYER_MISMATCH', async () => {
    const { manager, duelId } = await setup();
    await expectDuelError(manager.submitAction(duelId, 1, endPhase(0)), 'PLAYER_MISMATCH');
    await expectDuelError(manager.submitAction(duelId, 0, endPhase(1)), 'PLAYER_MISMATCH');
  });

  it('forbids client-sent StartDuel and Draw', async () => {
    const { manager, duelId } = await setup();
    await expectDuelError(
      manager.submitAction(duelId, 0, { type: 'Draw', payload: { playerIndex: 0, count: 1 } }),
      'FORBIDDEN_ACTION',
    );
    await expectDuelError(
      manager.submitAction(duelId, 0, {
        ...({ type: 'StartDuel' } as object),
        payload: {},
      } as Action),
      'FORBIDDEN_ACTION',
    );
  });

  it('leaves state, version and log untouched when the engine rejects', async () => {
    const { manager, duelId } = await setup();
    const before = await manager.getDuel(duelId);
    await expectDuelError(manager.submitAction(duelId, 1, endPhase(1)), 'ACTION_REJECTED');
    const after = await manager.getDuel(duelId);
    expect(after.state).toBe(before.state);
    expect(after.actionLog).toHaveLength(0);
  });

  it('leaves state untouched and reports INTERNAL_ERROR when something unexpected throws', async () => {
    let explode = false;
    const { manager } = makeManager(new InMemoryDuelStore(), (id) => {
      if (explode) throw new Error('boom');
      return resolver(id);
    });
    const { duelId } = await manager.createDuel(CONFIG);
    await toMain1(manager, duelId);
    const before = await manager.getDuel(duelId);
    explode = true;
    await expectDuelError(
      manager.submitAction(duelId, 0, {
        type: 'NormalSummon',
        payload: {
          playerIndex: 0,
          cardInstanceId: before.state.players[0].hand[0]!.instanceId,
          zoneIndex: 0,
        },
      }),
      'INTERNAL_ERROR',
    );
    const after = await manager.getDuel(duelId);
    expect(after.state).toBe(before.state);
    expect(after.actionLog).toHaveLength(before.actionLog.length);
  });

  it('throws DUEL_NOT_FOUND for an unknown duel', async () => {
    const { manager } = makeManager();
    await expectDuelError(manager.submitAction('nope', 0, endPhase(0)), 'DUEL_NOT_FOUND');
    await expectDuelError(manager.getView('nope', 0), 'DUEL_NOT_FOUND');
    await expectDuelError(manager.getDuel('nope'), 'DUEL_NOT_FOUND');
    await expectDuelError(manager.closeDuel('nope'), 'DUEL_NOT_FOUND');
  });

  it('reports the finished duel as ACTION_REJECTED/DUEL_ENDED and keeps the winner', async () => {
    const { manager, duelId } = await setup();
    await manager.submitAction(duelId, 1, { type: 'Surrender', payload: { playerIndex: 1 } });
    expect((await manager.getView(duelId, 0)).winnerIndex).toBe(0);
    await expectDuelError(
      manager.submitAction(duelId, 0, endPhase(0)),
      'ACTION_REJECTED',
      'DUEL_ENDED',
    );
  });
});

describe('DuelManager with a pending prompt', () => {
  async function withPrompt() {
    const { manager, store, duelId } = await setup();
    const session = (await store.get(duelId))!;
    const [p0, p1] = session.state.players;
    const extra = [0, 1].map((i) => ({
      instanceId: `x${i}`,
      definitionId: 'SMP-001',
      position: null,
      ownerIndex: 0 as const,
    }));
    // Player 0 in Main2 holding 7 cards → EndPhase opens DiscardToHandLimit.
    await store.save({
      ...session,
      state: {
        ...session.state,
        phase: 'Main2',
        players: [{ ...p0, hand: [...p0.hand, ...extra] }, p1],
      },
    });
    await manager.submitAction(duelId, 0, endPhase(0));
    const prompt = (await stateOf(manager, duelId)).pendingPrompt!;
    return { manager, duelId, prompt };
  }

  it('lets only the prompted player answer; others are rejected; Surrender still works', async () => {
    const { manager, duelId, prompt } = await withPrompt();
    expect(prompt).toMatchObject({ kind: 'DiscardToHandLimit', playerIndex: 0 });
    const discard = (await stateOf(manager, duelId)).players[0].hand[0]!.instanceId;

    await expectDuelError(
      manager.submitAction(duelId, 1, {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 1, promptId: prompt.promptId, cardInstanceIds: [] },
      }),
      'ACTION_REJECTED',
    );
    await expectDuelError(manager.submitAction(duelId, 0, endPhase(0)), 'ACTION_REJECTED');

    const ok = await manager.submitAction(duelId, 0, {
      type: 'ResolvePendingPrompt',
      payload: { playerIndex: 0, promptId: prompt.promptId, cardInstanceIds: [discard] },
    });
    expect(ok.view.pendingPrompt).toBeNull();
  });

  it('allows Surrender while a prompt is pending', async () => {
    const { manager, duelId } = await withPrompt();
    const r = await manager.submitAction(duelId, 1, {
      type: 'Surrender',
      payload: { playerIndex: 1 },
    });
    expect(r.view.winnerIndex).toBe(0);
  });
});

describe('DuelManager concurrency', () => {
  /** Store whose `get` yields to the event loop so unserialized callers interleave. */
  class SlowStore extends InMemoryDuelStore {
    override async get(id: string): Promise<DuelSession | undefined> {
      const s = await super.get(id);
      await new Promise((r) => setTimeout(r, 5));
      return s;
    }
  }

  it('serializes concurrent actions on the same duel (no lost update)', async () => {
    const { manager, duelId } = await (async () => {
      const m = makeManager(new SlowStore());
      const { duelId } = await m.manager.createDuel(CONFIG);
      return { manager: m.manager, duelId };
    })();
    await toMain1(manager, duelId);
    const hand = (await stateOf(manager, duelId)).players[0].hand;
    const summon = (i: number): Action => ({
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: hand[i]!.instanceId, zoneIndex: i },
    });
    const results = await Promise.allSettled([
      manager.submitAction(duelId, 0, summon(0)),
      manager.submitAction(duelId, 0, summon(1)),
    ]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    const rejected = (results[1] as PromiseRejectedResult).reason as DuelServiceError;
    expect(rejected.engineCode).toBe('NORMAL_SUMMON_USED');
    const session = await manager.getDuel(duelId);
    expect(session.actionLog.filter((l) => l.action.type === 'NormalSummon')).toHaveLength(1);
    expect(session.state.players[0].board.monsterZones.filter(Boolean)).toHaveLength(1);
  });

  it('does not block other duels and recovers after a failed action', async () => {
    const { manager } = makeManager(new SlowStore());
    const a = (await manager.createDuel(CONFIG)).duelId;
    const b = (await manager.createDuel(CONFIG)).duelId;
    const bad = manager.submitAction(a, 1, endPhase(1));
    const good = manager.submitAction(b, 0, endPhase(0));
    await expect(good).resolves.toBeDefined();
    await expect(bad).rejects.toBeInstanceOf(DuelServiceError);
    // Queue for `a` must not be wedged by the rejection.
    await expect(manager.submitAction(a, 0, endPhase(0))).resolves.toBeDefined();
  });
});

describe('DuelManager information hiding', () => {
  it('never leaks the opponent hand/deck and returns the sender view', async () => {
    const { manager, duelId } = await setup();
    await toMain1(manager, duelId);
    const r = await manager.submitAction(duelId, 0, endPhase(0));
    expect(r.view.viewerIndex).toBe(0);
    expect(JSON.stringify(r.view)).not.toContain('SMP-002');
    expect(JSON.stringify(await manager.getView(duelId, 0))).not.toContain('SMP-002');
    expect(JSON.stringify(await manager.getView(duelId, 1))).not.toContain('SMP-001');
    expect(JSON.stringify(await manager.getView(duelId, 1))).toContain('SMP-002');
  });
});

describe('DuelManager replay + close', () => {
  it('startAction + actionLog replay reproduces the final state exactly', async () => {
    const { manager, duelId } = await setup();
    await toMain1(manager, duelId);
    const st = await stateOf(manager, duelId);
    await manager.submitAction(duelId, 0, {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: st.players[0].hand[0]!.instanceId, zoneIndex: 2 },
    });
    await manager.submitAction(duelId, 1, { type: 'Surrender', payload: { playerIndex: 1 } });

    const session = await manager.getDuel(duelId);
    let replayed = initialStateOf(session);
    for (const entry of session.actionLog) {
      replayed = applyAction(replayed, entry.action, { cardDefinitions: resolver }).state;
    }
    expect(replayed).toEqual(session.state);
    expect(session.startAction?.payload.seed).toBe(session.seed);
  });

  it('closeDuel removes the session', async () => {
    const { manager, duelId } = await setup();
    await manager.closeDuel(duelId);
    await expectDuelError(manager.getView(duelId, 0), 'DUEL_NOT_FOUND');
  });
});

describe('DuelManager 2.3 additions', () => {
  it('createDuel returns opening views and per-viewer opening events', async () => {
    const { manager } = makeManager();
    const res = await manager.createDuel(CONFIG);
    expect(res.views.map((v) => v.viewerIndex)).toEqual([0, 1]);
    for (const i of [0, 1] as const) {
      const types = res.eventsByViewer[i].map((e) => e.type);
      expect(types[0]).toBe('DuelStarted');
      expect(types.filter((t) => t === 'CardDrawn')).toHaveLength(10);
    }
  });

  it('opening CardDrawn shows own cards but hides the opponent hand', async () => {
    const { manager } = makeManager();
    const res = await manager.createDuel(CONFIG);
    const p0 = JSON.stringify(res.eventsByViewer[0]);
    expect(p0).toContain('SMP-001');
    expect(p0).not.toContain('SMP-002');
    const p1 = JSON.stringify(res.eventsByViewer[1]);
    expect(p1).toContain('SMP-002');
    expect(p1).not.toContain('SMP-001');
  });

  it('stores mode and owner and exposes them through getMeta only', async () => {
    const { manager } = makeManager();
    const { duelId } = await manager.createDuel({ ...CONFIG, mode: 'solo-debug', ownerId: 'g1' });
    expect(await manager.getMeta(duelId)).toEqual({ mode: 'solo-debug', ownerId: 'g1' });
  });

  it('getMeta is empty when no owner was given and throws DUEL_NOT_FOUND for unknown ids', async () => {
    const { manager, duelId } = await setup();
    expect(await manager.getMeta(duelId)).toEqual({});
    await expectDuelError(manager.getMeta('nope'), 'DUEL_NOT_FOUND');
  });
});

describe('DuelManager legalActions (2.5)', () => {
  const types = (list: readonly { type: string }[]) => list.map((a) => a.type);

  it('createDuel returns opening legalActions per seat', async () => {
    const { manager } = makeManager();
    const created = await manager.createDuel(CONFIG);
    expect(types(created.legalActionsByViewer[0])).toEqual(['EndPhase', 'Surrender']);
    expect(types(created.legalActionsByViewer[1])).toEqual(['Surrender']);
  });

  it('submitAction returns the SENDER seat legalActions for the state after the action', async () => {
    const { manager, duelId } = await setup();
    await toMain1(manager, duelId);
    const result = await manager.submitAction(duelId, 0, endPhase(0)); // Main1 -> Battle
    expect(await manager.getLegalActions(duelId, 0)).toEqual(result.legalActions);
    expect(types(await manager.getLegalActions(duelId, 1))).toEqual(['Surrender']); // not on turn
  });

  it('lists Summon/Set for the hand in Main1 and drops them after a Normal Summon', async () => {
    const { manager, duelId } = await setup();
    await toMain1(manager, duelId);
    const before = await manager.getLegalActions(duelId, 0);
    expect(types(before)).toContain('NormalSummon');
    expect(types(before)).toContain('SetMonster');
    const summon = before.find((a) => a.type === 'NormalSummon')!;
    const after = await manager.submitAction(duelId, 0, summon as unknown as Action);
    expect(types(after.legalActions)).not.toContain('NormalSummon');
    expect(types(after.legalActions)).not.toContain('SetMonster');
  });

  it('every listed action is accepted by submitAction (the list is the engine verdict)', async () => {
    const probe = await setup();
    await toMain1(probe.manager, probe.duelId);
    const listed = await probe.manager.getLegalActions(probe.duelId, 0);
    expect(listed.length).toBeGreaterThan(2);
    for (const a of listed) {
      if (a.type === 'Surrender') continue; // would end the duel
      const fresh = await setup();
      await toMain1(fresh.manager, fresh.duelId);
      await expect(
        fresh.manager.submitAction(fresh.duelId, 0, a as unknown as Action),
      ).resolves.toBeDefined();
    }
  });

  it('is empty once the duel ended and throws DUEL_NOT_FOUND for unknown ids', async () => {
    const { manager, duelId } = await setup();
    await manager.submitAction(duelId, 0, { type: 'Surrender', payload: { playerIndex: 0 } });
    expect(await manager.getLegalActions(duelId, 0)).toEqual([]);
    expect(await manager.getLegalActions(duelId, 1)).toEqual([]);
    await expectDuelError(manager.getLegalActions('nope', 0), 'DUEL_NOT_FOUND');
  });
});
