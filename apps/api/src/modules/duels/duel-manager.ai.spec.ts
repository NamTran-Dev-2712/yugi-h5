import { applyAction, type Action, type GameState } from '@yugi/game-engine';
import { SAMPLE_CARDS, type CardDefinition, type PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { chooseAction, type AiPolicy } from './ai/choose-action';
import { DuelServiceError } from './duel-errors';
import { DuelManager, type CreateDuelConfig } from './duel-manager';
import { InMemoryDuelStore, type DuelStore, initialStateOf } from './duel-store';

const defs = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const resolver = (id: string): CardDefinition | undefined => defs.get(id);

/** Human deck = SMP-001 only, AI deck = SMP-002 only, so any leak of an AI card is easy to spot. */
function config(aiSeat: 0 | 1 = 1): CreateDuelConfig {
  const human: string[] = Array(20).fill('SMP-001');
  const ai: string[] = Array(20).fill('SMP-002');
  return {
    playerIds: aiSeat === 1 ? ['human', 'ai'] : ['ai', 'human'],
    deckLists: aiSeat === 1 ? [human, ai] : [ai, human],
    mode: 'solo-vs-ai',
    ownerId: 'human',
    aiSeat,
    seed: 'ai-seed',
  };
}

function makeManager(
  opts: { aiPolicy?: AiPolicy; maxAiActionsPerRequest?: number; store?: DuelStore } = {},
) {
  let n = 0;
  const store = opts.store ?? new InMemoryDuelStore();
  const manager = new DuelManager({
    store,
    cardDefinitions: resolver,
    newDuelId: () => `duel-${++n}`,
    ...(opts.aiPolicy ? { aiPolicy: opts.aiPolicy } : {}),
    ...(opts.maxAiActionsPerRequest !== undefined
      ? { maxAiActionsPerRequest: opts.maxAiActionsPerRequest }
      : {}),
  });
  return { manager, store };
}

const endPhase = (playerIndex: 0 | 1): Action => ({ type: 'EndPhase', payload: { playerIndex } });

/** The human (seat 0) walks Draw → … → End; the last EndPhase hands the turn to the AI, who plays its whole turn. */
async function humanEndsTurn(manager: DuelManager, duelId: string) {
  let last = await manager.submitAction(duelId, 0, endPhase(0));
  for (let i = 0; i < 5; i++) last = await manager.submitAction(duelId, 0, endPhase(0));
  return last;
}

async function stateOf(manager: DuelManager, duelId: string): Promise<GameState> {
  return (await manager.getDuel(duelId)).state;
}

describe('DuelManager solo-vs-ai driver', () => {
  it('plays the whole AI turn inside the human request and hands control back', async () => {
    const { manager } = makeManager();
    const { duelId } = await manager.createDuel(config());
    const before = await stateOf(manager, duelId);
    expect(before.turnPlayerIndex).toBe(0);

    const result = await humanEndsTurn(manager, duelId);
    const state = await stateOf(manager, duelId);
    expect(result.aiActions.length).toBeGreaterThan(0);
    expect(state.turnPlayerIndex).toBe(0); // back to the human
    expect(state.turnCount).toBe(3);
    expect(state.phase).toBe('Draw');
    expect(result.view.viewerIndex).toBe(0);
    expect(result.legalActions.some((a) => a.type === 'EndPhase')).toBe(true);
    expect(result.aiActions.every((a) => a.action.payload.playerIndex === 1)).toBe(true);
    expect(result.aiActions.some((a) => a.action.type === 'Surrender')).toBe(false);
  });

  it('runs the AI first when it holds the first seat (createDuel drives it)', async () => {
    const { manager } = makeManager();
    const created = await manager.createDuel(config(0));
    const state = await stateOf(manager, created.duelId);
    expect(created.aiActions?.length ?? 0).toBeGreaterThan(0);
    expect(state.turnPlayerIndex).toBe(1); // the AI ended its turn, the human (seat 1) is up
    expect(state.turnCount).toBe(2);
    // opening events (DuelStarted + draws) come first, then the AI's own events
    const human = created.eventsByViewer[1];
    expect(human[0]?.type).toBe('DuelStarted');
    const last = created.aiActions![created.aiActions!.length - 1]!;
    expect(last.eventsTo).toBe(human.length);
  });

  it('sends every AI action through the logged, validated path (log + replay match)', async () => {
    const { manager } = makeManager();
    const { duelId } = await manager.createDuel(config());
    await humanEndsTurn(manager, duelId);
    const session = await manager.getDuel(duelId);
    const aiEntries = session.actionLog.filter((e) => e.playerIndex === 1);
    expect(aiEntries.length).toBeGreaterThan(0);
    // versions are strictly increasing: nothing was applied outside the log
    const versions = session.actionLog.map((e) => e.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);

    let replayed = initialStateOf(session);
    for (const entry of session.actionLog) {
      replayed = applyAction(replayed, entry.action, { cardDefinitions: resolver }).state;
    }
    expect(replayed).toEqual(session.state);
  });

  it('is deterministic: same seed and same human actions give the same duel', async () => {
    const a = makeManager();
    const b = makeManager();
    const da = (await a.manager.createDuel(config())).duelId;
    const db = (await b.manager.createDuel(config())).duelId;
    await humanEndsTurn(a.manager, da);
    await humanEndsTurn(b.manager, db);
    expect((await a.manager.getDuel(da)).actionLog).toEqual(
      (await b.manager.getDuel(db)).actionLog,
    );
  });

  it('gives the human the AI events filtered for the human, with aiActions slicing them', async () => {
    const { manager } = makeManager();
    const { duelId } = await manager.createDuel(config());
    const result = await humanEndsTurn(manager, duelId);
    expect(result.events).toEqual(result.eventsByViewer[0]);
    let cursor = -1;
    for (const a of result.aiActions) {
      expect(a.eventsFrom).toBeGreaterThanOrEqual(0);
      expect(a.eventsTo).toBeGreaterThanOrEqual(a.eventsFrom);
      expect(a.eventsTo).toBeLessThanOrEqual(result.events.length);
      if (cursor >= 0) expect(a.eventsFrom).toBe(cursor);
      cursor = a.eventsTo;
    }
    expect(cursor).toBe(result.events.length);
    // The AI's cards stay hidden: draws by the AI carry no card identity for the human.
    for (const e of result.events) {
      if (e.type === 'CardDrawn' && e.playerIndex === 1) expect(e.card.hidden).toBe(true);
    }
    const view = JSON.stringify(result.view.players[1].hand);
    expect(view).not.toContain('SMP-002');
  });

  it('never lets a caller act for the AI seat (defence in depth behind duel-access)', async () => {
    const { manager } = makeManager();
    const { duelId } = await manager.createDuel(config());
    const err = await manager.submitAction(duelId, 1, endPhase(1)).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(DuelServiceError);
    expect((err as DuelServiceError).code).toBe('NOT_OWNER');
    expect((await manager.getDuel(duelId)).actionLog).toEqual([]);
  });

  it('stops at the per-request cap with AI_LOOP_LIMIT and leaves a valid, replayable duel', async () => {
    const { manager } = makeManager({ maxAiActionsPerRequest: 3 });
    const { duelId } = await manager.createDuel(config());
    await manager.submitAction(duelId, 0, endPhase(0));
    for (let i = 0; i < 4; i++) await manager.submitAction(duelId, 0, endPhase(0));
    const err = await manager.submitAction(duelId, 0, endPhase(0)).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(DuelServiceError);
    expect((err as DuelServiceError).code).toBe('AI_LOOP_LIMIT');
    const session = await manager.getDuel(duelId);
    expect(session.actionLog.filter((e) => e.playerIndex === 1)).toHaveLength(3);
    // still consistent: replay reproduces the stored state
    let replayed = initialStateOf(session);
    for (const entry of session.actionLog) {
      replayed = applyAction(replayed, entry.action, { cardDefinitions: resolver }).state;
    }
    expect(replayed).toEqual(session.state);
  });

  it('refuses a policy that surrenders (INTERNAL_ERROR) instead of ending the duel', async () => {
    const surrender: AiPolicy = () => ({ type: 'Surrender', payload: { playerIndex: 1 } });
    const { manager } = makeManager({ aiPolicy: surrender });
    const { duelId } = await manager.createDuel(config());
    await manager.submitAction(duelId, 0, endPhase(0));
    for (let i = 0; i < 4; i++) await manager.submitAction(duelId, 0, endPhase(0));
    const err = await manager.submitAction(duelId, 0, endPhase(0)).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect((err as DuelServiceError).code).toBe('INTERNAL_ERROR');
    expect((await stateOf(manager, duelId)).winnerIndex).toBeNull();
  });

  it('turns a policy answer the engine rejects into INTERNAL_ERROR, not a 409 for the human', async () => {
    const bogus: AiPolicy = () => ({
      type: 'ChangePosition',
      payload: { playerIndex: 1, cardInstanceId: 'nope', toPosition: 'Attack' },
    });
    const { manager } = makeManager({ aiPolicy: bogus });
    const { duelId } = await manager.createDuel(config());
    await manager.submitAction(duelId, 0, endPhase(0));
    for (let i = 0; i < 4; i++) await manager.submitAction(duelId, 0, endPhase(0));
    const err = await manager.submitAction(duelId, 0, endPhase(0)).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect((err as DuelServiceError).code).toBe('INTERNAL_ERROR');
  });

  it('hands the policy only the AI view and legal actions (no raw state)', async () => {
    const seen: Parameters<AiPolicy>[0][] = [];
    const spy: AiPolicy = (input) => {
      seen.push(input);
      return chooseAction(input);
    };
    const { manager } = makeManager({ aiPolicy: spy });
    const { duelId } = await manager.createDuel(config());
    await humanEndsTurn(manager, duelId);
    expect(seen.length).toBeGreaterThan(0);
    for (const input of seen) {
      expect(input.view.viewerIndex).toBe(1);
      expect(Object.keys(input).sort()).toEqual(
        ['cardDefinitions', 'legalActions', 'rng', 'view'].sort(),
      );
      expect(JSON.stringify(input.view.players[0].hand)).not.toContain('SMP-001');
      expect(input.legalActions.every((a: PlayerAction) => a.payload.playerIndex === 1)).toBe(true);
    }
  });

  it('solo-debug never triggers the AI', async () => {
    const { manager } = makeManager();
    const { duelId } = await manager.createDuel({
      ...config(),
      mode: 'solo-debug',
    });
    const r = await manager.submitAction(duelId, 0, endPhase(0));
    expect(r.aiActions).toEqual([]);
    expect((await stateOf(manager, duelId)).turnPlayerIndex).toBe(0);
  });
});
