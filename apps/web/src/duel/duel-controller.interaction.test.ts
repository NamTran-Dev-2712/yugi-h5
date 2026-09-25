import type { PlayerAction, ViewResponse } from '@yugi/shared';
import { SAMPLE_CARDS } from '@yugi/shared';
import { describe, expect, it, vi } from 'vitest';
import { DuelApiError, type DuelApi } from '../api/duel-api';
import { createDuelController } from './duel-controller';
import { loadFixture } from './fixtures';

const byId = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));
const lookup = (id: string) => byId.get(id);

const f = loadFixture('summon-choice');
const summon = f.legalActions.find((a) => a.type === 'NormalSummon')!;

function apiWith(impl: () => Promise<ViewResponse>) {
  const api = {
    ensureGuest: vi.fn(async () => 't'),
    createSolo: vi.fn(async () => ({
      duelId: 'd1',
      viewer: 0 as const,
      view: f.view,
      events: [],
      legalActions: f.legalActions as PlayerAction[],
      mode: 'solo-vs-ai' as const,
      aiSeat: 1 as const,
    })),
    getView: vi.fn(),
    submitAction: vi.fn(impl),
  };
  return api;
}

async function started(impl: () => Promise<ViewResponse>) {
  const api = apiWith(impl);
  const c = createDuelController({ api: api as unknown as DuelApi, lookup });
  await c.start();
  return { c, api };
}

describe('submit result', () => {
  it('returns ok when the server accepts, and the state comes from the response', async () => {
    const next = { ...f.view, version: 2 };
    const { c } = await started(async () => ({ view: next, events: [], legalActions: [] }));
    const res = await c.submit(summon);
    expect(res).toEqual({ ok: true, sent: true });
    expect(c.getState().view).toBe(next);
  });

  it('a server rejection returns a Vietnamese message and leaves view/legalActions untouched', async () => {
    const { c } = await started(async () => {
      throw new DuelApiError(409, { code: 'ACTION_REJECTED', engineCode: 'ZONE_OCCUPIED' }, 'X');
    });
    const view = c.getState().view;
    const legal = c.getState().legalActions;
    const res = await c.submit(summon);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error();
    expect(res.message).toMatch(/ô|quái/i);
    expect(res.message).not.toContain('ZONE_OCCUPIED');
    expect(c.getState().view).toBe(view);
    expect(c.getState().legalActions).toBe(legal);
    expect(c.getState().busy).toBe(false);
  });

  it('an unknown server code becomes a generic sentence that shows the code', async () => {
    const { c } = await started(async () => {
      throw new DuelApiError(409, { code: 'ACTION_REJECTED', engineCode: 'BRAND_NEW' }, 'X');
    });
    const res = await c.submit(summon);
    if (res.ok) throw new Error();
    expect(res.message).toContain('BRAND_NEW');
  });

  it('an action that is not listed is refused locally and never reaches the server', async () => {
    const { c, api } = await started(async () => ({ view: f.view, events: [], legalActions: [] }));
    const forged = { ...summon, payload: { ...summon.payload, zoneIndex: 2 } } as PlayerAction;
    const res = await c.submit(forged);
    expect(res.ok).toBe(false);
    expect(api.submitAction).not.toHaveBeenCalled();
  });

  it('matches a listed action whatever the key order', async () => {
    const { c, api } = await started(async () => ({ view: f.view, events: [], legalActions: [] }));
    const reordered = JSON.parse(
      JSON.stringify({
        payload: Object.fromEntries(Object.entries(summon.payload).reverse()),
        type: summon.type,
      }),
    ) as PlayerAction;
    expect((await c.submit(reordered)).ok).toBe(true);
    expect(api.submitAction).toHaveBeenCalledTimes(1);
  });

  it('refuses while a request is already in flight', async () => {
    let release!: (r: ViewResponse) => void;
    const { c, api } = await started(() => new Promise<ViewResponse>((r) => (release = r)));
    const first = c.submit(summon);
    const second = await c.submit(summon);
    expect(second.ok).toBe(false);
    expect(api.submitAction).toHaveBeenCalledTimes(1);
    release({ view: f.view, events: [], legalActions: [] });
    await first;
  });
});

describe('fixture mode (no server)', () => {
  it('"sends" only write a log line and change nothing', async () => {
    const c = createDuelController({ lookup });
    c.showFixture(f.view, f.legalActions);
    const before = c.getState();
    const res = await c.submit(summon);
    expect(res).toEqual({ ok: true, sent: false });
    const after = c.getState();
    expect(after.view).toBe(before.view);
    expect(after.legalActions).toBe(before.legalActions);
    expect(after.log.at(-1)).toMatch(/^sẽ gửi: /);
    expect(after.log.at(-1)).toContain('NormalSummon');
  });

  it('a controller that has an API but was switched to a fixture also sends nothing', async () => {
    const { c, api } = await started(async () => ({ view: f.view, events: [], legalActions: [] }));
    c.showFixture(f.view, f.legalActions);
    const res = await c.submit(summon);
    expect(res).toEqual({ ok: true, sent: false });
    expect(api.submitAction).not.toHaveBeenCalled();
  });

  it('still refuses an unlisted action', async () => {
    const c = createDuelController({ lookup });
    c.showFixture(f.view, f.legalActions);
    const forged = { ...summon, payload: { ...summon.payload, zoneIndex: 2 } } as PlayerAction;
    expect((await c.submit(forged)).ok).toBe(false);
    expect(c.getState().log).toEqual([]);
  });
});
