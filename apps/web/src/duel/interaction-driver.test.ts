import type { PlayerAction } from '@yugi/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  initialUiState,
  type DuelController,
  type DuelUiState,
  type SubmitResult,
} from './duel-controller';
import { loadFixture, type FixtureName } from './fixtures';
import { createInteractionDriver } from './interaction-driver';
import { cardRect, centre, layout, lookup, selfZone } from './interaction.harness';
import { present } from './presenter';

interface Fake {
  controller: DuelController;
  submit: ReturnType<typeof vi.fn>;
  press: ReturnType<typeof vi.fn>;
  set(patch: Partial<DuelUiState>): void;
  state(): DuelUiState;
}

function fake(name: FixtureName, submitImpl: (a: PlayerAction) => Promise<SubmitResult>): Fake {
  const f = loadFixture(name);
  let state: DuelUiState = { ...initialUiState, view: f.view, legalActions: f.legalActions };
  const listeners = new Set<(s: DuelUiState) => void>();
  const submit = vi.fn(submitImpl);
  const press = vi.fn(async () => undefined);
  const controller: DuelController = {
    getState: () => state,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    start: async () => undefined,
    showFixture: () => undefined,
    press,
    submit,
  };
  return {
    controller,
    submit,
    press,
    set: (patch) => {
      state = { ...state, ...patch };
      for (const l of listeners) l(state);
    },
    state: () => state,
  };
}

const ptr = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', p: { x: number; y: number }) =>
  ({ type, point: p }) as const;

async function dragCard(d: ReturnType<typeof createInteractionDriver>, id: string, zone: number) {
  const ctx = d.getContext()!;
  await d.dispatch(ptr('pointerDown', centre(cardRect(ctx, id))));
  await d.dispatch(ptr('pointerMove', centre(selfZone(zone))));
  await d.dispatch(ptr('pointerUp', centre(selfZone(zone))));
}

describe('interaction driver', () => {
  const only = (name: FixtureName, pred: (a: PlayerAction) => boolean): Fake['controller'] => {
    const f = fake(name, async () => ({ ok: true, sent: true }));
    f.set({ legalActions: f.state().legalActions.filter(pred) });
    return f.controller;
  };
  void only;

  it('sends the listed action through the controller and goes back to idle when the server accepts', async () => {
    const f = fake('summon-choice', async () => ({ ok: true, sent: true }));
    f.set({ legalActions: f.state().legalActions.filter((a) => a.type !== 'SetMonster') });
    const d = createInteractionDriver(f.controller, { lookup });
    await dragCard(d, 'p0-1', 0);
    expect(f.submit).toHaveBeenCalledTimes(1);
    expect(f.submit.mock.calls[0]![0]).toMatchObject({ type: 'NormalSummon' });
    expect(d.getState().kind).toBe('idle');
    expect(d.getToast()).toBeNull();
  });

  it('locks input while the request is in flight (no second request, no drag)', async () => {
    let release!: (r: SubmitResult) => void;
    const f = fake('summon-choice', () => new Promise<SubmitResult>((r) => (release = r)));
    f.set({ legalActions: f.state().legalActions.filter((a) => a.type !== 'SetMonster') });
    const d = createInteractionDriver(f.controller, { lookup });
    const first = dragCard(d, 'p0-1', 0);
    await vi.waitFor(() => expect(f.submit).toHaveBeenCalledTimes(1));
    expect(d.getState().kind).toBe('pending-server');
    await dragCard(d, 'p0-3', 1); // ignored
    expect(f.submit).toHaveBeenCalledTimes(1);
    expect(d.getState().kind).toBe('pending-server');
    release({ ok: true, sent: true });
    await first;
    expect(d.getState().kind).toBe('idle');
  });

  it('when the server refuses: back to idle, the board (view/legalActions) is untouched, the message is shown', async () => {
    const f = fake('summon-choice', async () => ({ ok: false, message: 'Ô này đã có quái.' }));
    f.set({ legalActions: f.state().legalActions.filter((a) => a.type !== 'SetMonster') });
    const viewBefore = f.state().view;
    const legalBefore = f.state().legalActions;
    const d = createInteractionDriver(f.controller, { lookup });
    await dragCard(d, 'p0-1', 0);
    expect(d.getState().kind).toBe('idle');
    expect(d.getToast()?.text).toBe('Ô này đã có quái.');
    expect(f.state().view).toBe(viewBefore);
    expect(f.state().legalActions).toBe(legalBefore);
    // and the same card can be tried again
    await dragCard(d, 'p0-1', 1);
    expect(f.submit).toHaveBeenCalledTimes(2);
  });

  it('a fixture "send" (sent: false) also ends in idle', async () => {
    const f = fake('summon-choice', async () => ({ ok: true, sent: false }));
    f.set({ legalActions: f.state().legalActions.filter((a) => a.type !== 'SetMonster') });
    const d = createInteractionDriver(f.controller, { lookup });
    await dragCard(d, 'p0-1', 0);
    expect(d.getState().kind).toBe('idle');
  });

  it('ignores pointer input while the controller is busy', async () => {
    const f = fake('summon-choice', async () => ({ ok: true, sent: true }));
    f.set({ busy: true });
    const d = createInteractionDriver(f.controller, { lookup });
    await dragCard(d, 'p0-1', 0);
    expect(f.submit).not.toHaveBeenCalled();
    expect(d.getState().kind).toBe('idle');
  });

  it('a toast for an illegal drop, none for a legal one', async () => {
    const f = fake('summon-choice', async () => ({ ok: true, sent: true }));
    const d = createInteractionDriver(f.controller, { lookup });
    await dragCard(d, 'p0-1', 2); // occupied
    expect(d.getToast()?.text).toBeTruthy();
    expect(f.submit).not.toHaveBeenCalled();
  });

  it('a button is pressed through the controller only when idle and not busy', async () => {
    const f = fake('midgame', async () => ({ ok: true, sent: true }));
    const d = createInteractionDriver(f.controller, { lookup });
    const model = present(f.state().view!, f.state().legalActions, { lookup, layout });
    const end = model.buttons.find((b) => b.id === 'endTurn')!;
    await d.dispatch(ptr('pointerDown', centre(end.rect)));
    await d.dispatch(ptr('pointerUp', centre(end.rect)));
    expect(f.press).toHaveBeenCalledWith('endTurn');
    f.press.mockClear();
    f.set({ busy: true });
    await d.dispatch(ptr('pointerDown', centre(end.rect)));
    await d.dispatch(ptr('pointerUp', centre(end.rect)));
    expect(f.press).not.toHaveBeenCalled();
  });

  it('a new view from the controller resets a half-finished gesture', async () => {
    const f = fake('summon-choice', async () => ({ ok: true, sent: true }));
    const d = createInteractionDriver(f.controller, { lookup });
    await d.dispatch(ptr('pointerDown', centre(cardRect(d.getContext()!, 'p0-1'))));
    expect(d.getState().kind).toBe('dragging-card');
    f.set({ view: { ...f.state().view!, version: 99 } });
    expect(d.getState().kind).toBe('idle');
  });
});
