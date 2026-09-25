import type { EventView, PlayerAction, ViewResponse } from '@yugi/shared';
import { SAMPLE_CARDS } from '@yugi/shared';
import { describe, expect, it, vi } from 'vitest';
import type { DuelApi } from '../api/duel-api';
import type { AnimationSegment } from './animation-queue';
import { createDuelController, type DuelAnimator } from './duel-controller';
import { loadFixture } from './fixtures';
import { createInteractionDriver } from './interaction-driver';

const byId = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));
const lookup = (id: string) => byId.get(id);

const f = loadFixture('summon-choice');
const summon = f.legalActions.find((a) => a.type === 'NormalSummon')!;
const endPhase: PlayerAction = { type: 'EndPhase', payload: { playerIndex: 0 } };

const oldView = f.view;
const newView = { ...f.view, version: f.view.version + 5 };
const newLegal: PlayerAction[] = [endPhase];

const humanEvent: EventView = {
  type: 'MonsterSet',
  playerIndex: 0,
  instanceId: 'p0-9',
  zoneIndex: 0,
};
const aiEvent: EventView = {
  type: 'MonsterSet',
  playerIndex: 1,
  instanceId: 'p1-9',
  zoneIndex: 0,
};

function apiWith(replies: ViewResponse[]) {
  const queue = [...replies];
  return {
    ensureGuest: vi.fn(async () => 't'),
    createSolo: vi.fn(async () => ({
      duelId: 'd1',
      viewer: 0 as const,
      view: oldView,
      events: [] as EventView[],
      legalActions: f.legalActions as PlayerAction[],
      mode: 'solo-vs-ai' as const,
      aiSeat: 1 as const,
    })),
    getView: vi.fn(),
    submitAction: vi.fn(async () => {
      const r = queue.shift();
      if (!r) throw new Error('unexpected call');
      return r;
    }),
  };
}

/** An animator that finishes only when the test says so. */
function manualAnimator() {
  const played: (readonly AnimationSegment[])[] = [];
  let release: () => void = () => {};
  const animator: DuelAnimator = {
    play: vi.fn((segments: readonly AnimationSegment[]) => {
      played.push(segments);
      return new Promise<void>((res) => (release = res));
    }),
    skip: vi.fn(() => release()),
  };
  return { animator, played, finish: () => release() };
}

const withAi = (over: Partial<ViewResponse> = {}): ViewResponse => ({
  view: newView,
  legalActions: newLegal,
  events: [humanEvent, aiEvent],
  aiActions: [
    { action: { type: 'EndPhase', payload: { playerIndex: 1 } }, eventsFrom: 1, eventsTo: 2 },
  ],
  ...over,
});

async function started(replies: ViewResponse[], animator?: DuelAnimator) {
  const api = apiWith(replies);
  const c = createDuelController({
    api: api as unknown as DuelApi,
    lookup,
    ...(animator ? { animator } : {}),
  });
  await c.start();
  return { c, api };
}
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('animation in the controller', () => {
  it('keeps the OLD view while animating, then snaps to the response view and legalActions', async () => {
    const m = manualAnimator();
    const { c } = await started([withAi()], m.animator);
    const p = c.submit(summon);
    await tick();
    expect(c.getState().view).toBe(oldView);
    expect(c.getState().animating).toBe(true);
    expect(c.getState().busy).toBe(true);
    m.finish();
    expect(await p).toEqual({ ok: true, sent: true });
    expect(c.getState().view).toBe(newView);
    expect(c.getState().legalActions).toBe(newLegal);
    expect(c.getState().animating).toBe(false);
    expect(c.getState().busy).toBe(false);
  });

  it('hands the animator the human segment first, then one segment per AI action', async () => {
    const m = manualAnimator();
    const { c } = await started([withAi()], m.animator);
    const p = c.submit(summon);
    await tick();
    const segs = m.played[0]!;
    expect(segs.map((s) => s.ai)).toEqual([false, true]);
    expect(segs[0]!.steps.map((s) => s.kind)).toEqual(['set']);
    expect(segs[1]!.steps.map((s) => s.kind)).toEqual(['aiLabel', 'set']);
    m.finish();
    await p;
  });

  it('a response without aiActions animates just the human events', async () => {
    const m = manualAnimator();
    const { c } = await started(
      [{ view: newView, legalActions: newLegal, events: [humanEvent] }],
      m.animator,
    );
    const p = c.submit(summon);
    await tick();
    expect(m.played[0]!.map((s) => s.ai)).toEqual([false]);
    m.finish();
    await p;
  });

  it('writes the log line at once, before the animation ends', async () => {
    const m = manualAnimator();
    const { c } = await started([withAi()], m.animator);
    const before = c.getState().log.length;
    const p = c.submit(summon);
    await tick();
    expect(c.getState().log.length).toBeGreaterThan(before);
    m.finish();
    await p;
  });

  it('skipAnimation() finishes it and the new view appears', async () => {
    const m = manualAnimator();
    const { c } = await started([withAi()], m.animator);
    const p = c.submit(summon);
    await tick();
    c.skipAnimation();
    await p;
    expect(m.animator.skip).toHaveBeenCalled();
    expect(c.getState().view).toBe(newView);
  });

  it('skipAnimation() with nothing playing is harmless', async () => {
    const m = manualAnimator();
    const { c } = await started([], m.animator);
    expect(() => c.skipAnimation()).not.toThrow();
    expect(m.animator.skip).not.toHaveBeenCalled();
  });

  it('a failing animator still ends with the new view and an unlocked controller', async () => {
    const animator: DuelAnimator = {
      play: vi.fn(async () => {
        throw new Error('fx broke');
      }),
      skip: vi.fn(),
    };
    const { c } = await started([withAi()], animator);
    const res = await c.submit(summon);
    expect(res).toEqual({ ok: true, sent: true });
    expect(c.getState().view).toBe(newView);
    expect(c.getState().animating).toBe(false);
    expect(c.getState().busy).toBe(false);
  });

  it('does not animate when the response has no events (view applies at once)', async () => {
    const m = manualAnimator();
    const { c } = await started(
      [{ view: newView, legalActions: newLegal, events: [] }],
      m.animator,
    );
    await c.submit(summon);
    expect(m.animator.play).not.toHaveBeenCalled();
    expect(c.getState().view).toBe(newView);
  });

  it('does not animate the very first view (there is no old board to draw on)', async () => {
    const m = manualAnimator();
    const api = apiWith([]);
    api.createSolo.mockResolvedValueOnce({
      duelId: 'd1',
      viewer: 0,
      view: oldView,
      events: [humanEvent],
      legalActions: f.legalActions as PlayerAction[],
      mode: 'solo-vs-ai',
      aiSeat: 1,
    });
    const c = createDuelController({
      api: api as unknown as DuelApi,
      lookup,
      animator: m.animator,
    });
    await c.start();
    expect(m.animator.play).not.toHaveBeenCalled();
    expect(c.getState().view).toBe(oldView);
  });

  it('a rejected action never animates and never touches the board', async () => {
    const m = manualAnimator();
    const { c, api } = await started([], m.animator);
    api.submitAction.mockRejectedValueOnce(new Error('boom'));
    const res = await c.submit(summon);
    expect(res.ok).toBe(false);
    expect(m.animator.play).not.toHaveBeenCalled();
    expect(c.getState().view).toBe(oldView);
    expect(c.getState().animating).toBe(false);
  });

  it('without an animator the behaviour is unchanged: the view is set at once', async () => {
    const { c } = await started([withAi()]);
    await c.submit(summon);
    expect(c.getState().view).toBe(newView);
    expect(c.getState().animating).toBe(false);
  });

  it('end turn (several EndPhase requests) animates each response before the next request', async () => {
    const m = manualAnimator();
    const mid = { ...oldView, version: oldView.version + 1 };
    const { c, api } = await started(
      [
        { view: mid, legalActions: [endPhase], events: [humanEvent] },
        { view: newView, legalActions: newLegal, events: [aiEvent] },
      ],
      m.animator,
    );
    const p = c.press('endTurn');
    await tick();
    expect(api.submitAction).toHaveBeenCalledTimes(1);
    expect(c.getState().view).toBe(oldView);
    m.finish();
    await tick();
    expect(api.submitAction).toHaveBeenCalledTimes(2);
    m.finish();
    await p;
    expect(m.animator.play).toHaveBeenCalledTimes(2);
    expect(c.getState().view).toBe(newView);
    expect(c.getState().busy).toBe(false);
  });
});

describe('input lock while animating', () => {
  function pointAtHandCard(driver: ReturnType<typeof createInteractionDriver>) {
    const ctx = driver.getContext()!;
    const card = ctx.model.cards.find((x) => x.id === summon.payload.cardInstanceId)!;
    return { x: card.rect.x + card.rect.w / 2, y: card.rect.y + card.rect.h / 2 };
  }

  it('ignores pointer input during the animation and accepts it again right after', async () => {
    const m = manualAnimator();
    const { c } = await started(
      [{ view: oldView, legalActions: f.legalActions as PlayerAction[], events: [humanEvent] }],
      m.animator,
    );
    const driver = createInteractionDriver(c, { lookup });
    const at = pointAtHandCard(driver);

    const p = c.submit(summon);
    await tick();
    expect(c.getState().animating).toBe(true);
    await driver.dispatch({ type: 'pointerDown', point: at });
    expect(driver.getState().kind).toBe('idle');

    m.finish();
    await p;
    expect(c.getState().animating).toBe(false);
    await driver.dispatch({ type: 'pointerDown', point: at });
    expect(driver.getState().kind).not.toBe('idle');
  });
});
