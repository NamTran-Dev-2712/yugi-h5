import type { PlayerAction, ViewResponse } from '@yugi/shared';
import { SAMPLE_CARDS } from '@yugi/shared';
import { describe, expect, it, vi } from 'vitest';
import { DuelApiError, type DuelApi } from '../api/duel-api';
import { createDuelController, type DuelUiState } from './duel-controller';
import { loadFixture } from './fixtures';

const byId = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));
const lookup = (id: string) => byId.get(id);

const endPhase: PlayerAction = { type: 'EndPhase', payload: { playerIndex: 0 } };
const surrender: PlayerAction = { type: 'Surrender', payload: { playerIndex: 0 } };

function response(over: Partial<ViewResponse> = {}): ViewResponse {
  const f = loadFixture('midgame');
  return { view: f.view, events: [], legalActions: [endPhase, surrender], ...over };
}

function fakeApi(replies: (ViewResponse | Error)[]) {
  const queue = [...replies];
  const next = async (): Promise<ViewResponse> => {
    const r = queue.shift();
    if (!r) throw new Error('unexpected call');
    if (r instanceof Error) throw r;
    return r;
  };
  const api = {
    ensureGuest: vi.fn(async () => 'tok'),
    createSolo: vi.fn(async () => ({
      ...(await next()),
      duelId: 'd-1',
      mode: 'solo-vs-ai' as const,
      viewer: 0 as const,
      aiSeat: 1 as const,
    })),
    createSandbox: vi.fn(async () => ({
      ...(await next()),
      duelId: 'sb-1',
      mode: 'solo-vs-ai' as const,
      viewer: 0 as const,
      aiSeat: 1 as const,
    })),
    getView: vi.fn(),
    submitAction: vi.fn(async () => next()),
  };
  return { api: api as unknown as DuelApi & typeof api };
}

describe('start', () => {
  it('creates a solo-vs-ai duel and shows the first view and legalActions', async () => {
    const { api } = fakeApi([response()]);
    const c = createDuelController({ api, lookup });
    await c.start();
    expect(api.createSolo).toHaveBeenCalledWith({ mode: 'solo-vs-ai' });
    expect(c.getState().duelId).toBe('d-1');
    expect(c.getState().view?.viewerIndex).toBe(0);
    expect(c.getState().legalActions).toHaveLength(2);
    expect(c.getState().busy).toBe(false);
  });

  it('reports an error and keeps no duel when creation fails', async () => {
    const { api } = fakeApi([new DuelApiError(0, { message: 'down' }, 'NETWORK_ERROR')]);
    const c = createDuelController({ api, lookup });
    await c.start();
    expect(c.getState().duelId).toBeNull();
    expect(c.getState().error).toContain('NETWORK_ERROR');
    expect(c.getState().busy).toBe(false);
  });
});

describe('startScenario (Sandbox)', () => {
  const scenario = { name: 'demo' } as unknown as Parameters<
    ReturnType<typeof createDuelController>['startScenario']
  >[0];

  it('loads the scenario on the server and shows its view and legalActions like start() does', async () => {
    const { api } = fakeApi([response()]);
    const c = createDuelController({ api, lookup });
    await c.startScenario(scenario);
    expect(api.createSandbox).toHaveBeenCalledWith(scenario);
    expect(api.createSolo).not.toHaveBeenCalled();
    expect(c.getState().duelId).toBe('sb-1');
    expect(c.getState().legalActions).toHaveLength(2);
    expect(c.getState().busy).toBe(false);
    expect(c.getState().error).toBeNull();
  });

  it('a duel loaded from a scenario is played through the normal submit path', async () => {
    const { api } = fakeApi([response(), response()]);
    const c = createDuelController({ api, lookup });
    await c.startScenario(scenario);
    await c.submit(endPhase);
    expect(api.submitAction).toHaveBeenCalledWith('sb-1', 0, endPhase);
  });

  it('shows the server refusal (e.g. INVALID_SCENARIO) and keeps no duel', async () => {
    const { api } = fakeApi([
      new DuelApiError(
        400,
        { code: 'INVALID_SCENARIO', message: 'unknown card "X"' },
        'HTTP_ERROR',
      ),
    ]);
    const c = createDuelController({ api, lookup });
    await c.startScenario(scenario);
    expect(c.getState().duelId).toBeNull();
    expect(c.getState().error).toContain('INVALID_SCENARIO');
    expect(c.getState().entries.some((e) => e.category === 'error')).toBe(true);
    expect(c.getState().busy).toBe(false);
  });

  it('ignores a second load while one is in flight', async () => {
    const { api } = fakeApi([response()]);
    const c = createDuelController({ api, lookup });
    const first = c.startScenario(scenario);
    await c.startScenario(scenario);
    await first;
    expect(api.createSandbox).toHaveBeenCalledTimes(1);
  });

  it('a controller without an api reports it instead of throwing', async () => {
    const c = createDuelController({ lookup });
    await c.startScenario(scenario);
    expect(c.getState().duelId).toBeNull();
    expect(c.getState().error).not.toBeNull();
  });
});

describe('pressing buttons', () => {
  async function started(replies: (ViewResponse | Error)[]) {
    const fake = fakeApi([response(), ...replies]);
    const c = createDuelController({ api: fake.api, lookup });
    await c.start();
    return { c, api: fake.api };
  }

  it('sends the EndPhase action from legalActions and shows "thinking" while waiting, then logs the AI move', async () => {
    let release!: (r: ViewResponse) => void;
    const pending = new Promise<ViewResponse>((res) => (release = res));
    const { c, api } = await started([]);
    api.submitAction.mockImplementationOnce(() => pending);
    const seen: boolean[] = [];
    c.subscribe((s: DuelUiState) => seen.push(s.thinking));
    const p = c.press('nextPhase');
    expect(c.getState().thinking).toBe(true);
    expect(c.getState().busy).toBe(true);
    release(
      response({
        aiActions: [
          { action: { type: 'EndPhase', payload: { playerIndex: 1 } }, eventsFrom: 0, eventsTo: 0 },
        ],
      }),
    );
    await p;
    expect(api.submitAction).toHaveBeenCalledWith('d-1', 0, endPhase);
    expect(c.getState().thinking).toBe(false);
    expect(c.getState().log.some((l) => l.includes('AI'))).toBe(true);
    expect(seen).toContain(true);
  });

  it('ignores a second press while a request is in flight', async () => {
    let release!: (r: ViewResponse) => void;
    const pending = new Promise<ViewResponse>((res) => (release = res));
    const { c, api } = await started([]);
    api.submitAction.mockImplementationOnce(() => pending);
    const p = c.press('nextPhase');
    await c.press('nextPhase');
    expect(api.submitAction).toHaveBeenCalledTimes(1);
    release(response());
    await p;
  });

  it('does not send anything when the action is not in legalActions', async () => {
    const { c, api } = await started([]);
    c.showFixture(loadFixture('midgame').view, []);
    await c.press('nextPhase');
    expect(api.submitAction).not.toHaveBeenCalled();
  });

  it('needs two presses to surrender, and another action disarms it', async () => {
    const { c, api } = await started([response()]);
    await c.press('surrender');
    expect(c.getState().surrenderArmed).toBe(true);
    expect(api.submitAction).not.toHaveBeenCalled();
    await c.press('nextPhase');
    expect(c.getState().surrenderArmed).toBe(false);
    api.submitAction.mockClear();
    api.submitAction.mockResolvedValueOnce(response({ legalActions: [] }));
    await c.press('surrender');
    await c.press('surrender');
    expect(api.submitAction).toHaveBeenCalledWith('d-1', 0, surrender);
  });

  it('keeps the view and records the error when the server rejects', async () => {
    const { c } = await started([
      new DuelApiError(409, { message: 'no', engineCode: 'WRONG_PHASE' }, 'ACTION_REJECTED'),
    ]);
    const before = c.getState().view;
    await c.press('nextPhase');
    expect(c.getState().view).toBe(before);
    expect(c.getState().error).toContain('WRONG_PHASE');
    expect(c.getState().busy).toBe(false);
  });

  it('end turn repeats EndPhase until the turn number changes', async () => {
    const f = loadFixture('midgame');
    const sameTurn = response({ view: { ...f.view, phase: 'Main2' } });
    const nextTurn = response({ view: { ...f.view, turnCount: f.view.turnCount + 2 } });
    const { c, api } = await started([sameTurn, sameTurn, nextTurn]);
    await c.press('endTurn');
    expect(api.submitAction).toHaveBeenCalledTimes(3);
    expect(c.getState().view?.turnCount).toBe(f.view.turnCount + 2);
  });

  it('end turn stops when a prompt takes EndPhase away', async () => {
    const f = loadFixture('handfull');
    const prompted = response({ view: f.view, legalActions: f.legalActions });
    const { c, api } = await started([prompted]);
    await c.press('endTurn');
    expect(api.submitAction).toHaveBeenCalledTimes(1);
  });

  it('submits a card click action only if the server listed it', async () => {
    const f = loadFixture('handfull');
    const { c, api } = await started([response({ view: f.view, legalActions: f.legalActions })]);
    await c.press('nextPhase'); // moves to the prompt state
    api.submitAction.mockClear();
    const answer = f.legalActions[0]!;
    api.submitAction.mockResolvedValueOnce(response());
    await c.submit(answer);
    expect(api.submitAction).toHaveBeenCalledWith('d-1', 0, answer);
    api.submitAction.mockClear();
    await c.submit({ type: 'Surrender', payload: { playerIndex: 1 } });
    expect(api.submitAction).not.toHaveBeenCalled();
  });
});
