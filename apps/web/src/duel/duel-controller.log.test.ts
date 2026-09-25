import type { PlayerAction, ViewResponse } from '@yugi/shared';
import { SAMPLE_CARDS } from '@yugi/shared';
import { describe, expect, it, vi } from 'vitest';
import { DuelApiError, type DuelApi } from '../api/duel-api';
import { createDuelController, type DuelUiState } from './duel-controller';
import { loadFixture } from './fixtures';

const byId = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));
const lookup = (id: string) => byId.get(id);
const endPhase: PlayerAction = { type: 'EndPhase', payload: { playerIndex: 0 } };

function response(over: Partial<ViewResponse> = {}): ViewResponse {
  const f = loadFixture('midgame');
  return { view: f.view, events: [], legalActions: [endPhase], ...over };
}

function fakeApi(replies: (ViewResponse | Error)[]) {
  const queue = [...replies];
  const next = async (): Promise<ViewResponse> => {
    const r = queue.shift();
    if (!r) throw new Error('unexpected call');
    if (r instanceof Error) throw r;
    return r;
  };
  return {
    ensureGuest: vi.fn(async () => 'tok'),
    createSolo: vi.fn(async () => ({
      ...(await next()),
      duelId: 'd-1',
      mode: 'solo-vs-ai' as const,
      viewer: 0 as const,
      aiSeat: 1 as const,
    })),
    getView: vi.fn(),
    submitAction: vi.fn(async () => next()),
  } as unknown as DuelApi;
}

const texts = (s: DuelUiState): string[] => s.entries.map((e) => e.text);

describe('structured log runs alongside the string log', () => {
  it('starts empty', async () => {
    const c = createDuelController({ api: fakeApi([]), lookup });
    expect(c.getState().entries).toEqual([]);
  });

  it('entries mirror log after start, an action with AI moves, and a rejected action', async () => {
    const aiResponse = response({
      events: [
        { type: 'TurnChanged', turnCount: 2, turnPlayerIndex: 1 },
        { type: 'AttackDeclared', playerIndex: 1, attackerInstanceId: 'x', targetInstanceId: null },
      ],
      aiActions: [
        {
          action: { type: 'EndPhase', payload: { playerIndex: 1 } },
          eventsFrom: 0,
          eventsTo: 1,
        },
        {
          action: {
            type: 'DeclareAttack',
            payload: { playerIndex: 1, attackerInstanceId: 'x', targetInstanceId: null },
          },
          eventsFrom: 1,
          eventsTo: 2,
        },
      ],
    });
    const api = fakeApi([
      response(),
      aiResponse,
      new DuelApiError(409, { message: 'no', engineCode: 'WRONG_PHASE' }, 'ACTION_REJECTED'),
    ]);
    const c = createDuelController({ api, lookup });
    await c.start();
    expect(texts(c.getState())).toEqual([...c.getState().log]);

    await c.press('nextPhase');
    const afterAi = c.getState();
    expect(texts(afterAi)).toEqual([...afterAi.log]);
    expect(afterAi.entries.map((e) => e.category)).toEqual(['turn', 'turn', 'combat', 'combat']);

    await c.press('nextPhase');
    const afterErr = c.getState();
    expect(texts(afterErr)).toEqual([...afterErr.log]);
    expect(afterErr.entries.at(-1)?.category).toBe('error');
    expect(afterErr.entries.at(-1)?.text.startsWith('✗')).toBe(true);
  });

  it('a start failure is an error entry', async () => {
    const api = fakeApi([new DuelApiError(0, { message: 'down' }, 'NETWORK_ERROR')]);
    const c = createDuelController({ api, lookup });
    await c.start();
    expect(c.getState().entries.map((e) => e.category)).toEqual(['error']);
    expect(texts(c.getState())).toEqual([...c.getState().log]);
  });

  it('the fixture "will send" preview is logged in both, category field', async () => {
    const f = loadFixture('summon-choice');
    const c = createDuelController({ lookup });
    c.showFixture(f.view, f.legalActions);
    const action = f.legalActions.find((a) => a.type === 'NormalSummon')!;
    await c.submit(action);
    const s = c.getState();
    expect(s.log.at(-1)).toMatch(/^sẽ gửi: /);
    expect(texts(s)).toEqual([...s.log]);
    expect(s.entries.at(-1)?.category).toBe('field');
  });

  it('both logs are capped the same way (200)', async () => {
    const many = Array.from({ length: 250 }, () => ({
      type: 'DamageDealt' as const,
      playerIndex: 0 as const,
      amount: 1,
    }));
    const c = createDuelController({ api: fakeApi([response({ events: many })]), lookup });
    await c.start();
    expect(c.getState().log).toHaveLength(200);
    expect(c.getState().entries).toHaveLength(200);
  });

  it('showFixture resets entries together with log', () => {
    const f = loadFixture('midgame');
    const c = createDuelController({ lookup });
    c.showFixture(f.view, f.legalActions);
    expect(c.getState().entries).toEqual([]);
    expect(c.getState().log).toEqual([]);
  });
});
