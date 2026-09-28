import type { PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { loadFixture } from './fixtures';
import { canConfirm, overlayFor, type InteractionState } from './interaction';
import { isListed } from './legal-index';
import { optionRects } from './layout';
import {
  cardRect,
  centre,
  click,
  drag,
  feed,
  fixtureCtx,
  layout,
  makeCtx,
  selfZone,
  sends,
  start,
  toasts,
  type Run,
} from './interaction.harness';
import { strings } from './strings';
import { t } from '../i18n/i18n';

/**
 * Task 3.7 (C13): tapping a Set card of mine that the server lists an ActivateEffect for sends it at once (no "Activate?"
 * dialog); several effects open the option menu; a TriggerActivation prompt opens a Yes/No selection.
 */

const kindOf = (r: Run): InteractionState['kind'] => r.state.kind;

const activate = (
  cardInstanceId: string,
  effectId: string,
  costInstanceIds?: string[],
): PlayerAction => ({
  type: 'ActivateEffect',
  payload: {
    playerIndex: 0,
    cardInstanceId,
    effectId,
    ...(costInstanceIds ? { costInstanceIds } : {}),
  },
});

describe('tap a Set card of mine during a reaction window (C13)', () => {
  const ctx = fixtureCtx('chain-reaction');
  const trap = centre(cardRect(ctx, 'p0-30'));

  it('sends the listed ActivateEffect at once, no menu', () => {
    const r = click(start(), trap, ctx);
    expect(sends(r)).toEqual([activate('p0-30', 'destroy-one')]);
    expect(kindOf(r)).toBe('pending-server');
  });

  it('a Set card with no listed activation does nothing', () => {
    const r = click(start(), centre(cardRect(ctx, 'p0-31')), ctx);
    expect(sends(r)).toEqual([]);
    expect(toasts(r)).toEqual([]);
    expect(kindOf(r)).toBe('idle');
  });

  it("the opponent's Set card does nothing", () => {
    const r = click(start(), centre(cardRect(ctx, 'p1-30')), ctx);
    expect(sends(r)).toEqual([]);
    expect(kindOf(r)).toBe('idle');
  });

  it('dragging the Set card does not activate it (toast: card cannot move)', () => {
    const r = drag(start(), trap, centre(selfZone(0)), ctx);
    expect(sends(r)).toEqual([]);
    expect(toasts(r)).toEqual([strings.toastCardLocked]);
    expect(kindOf(r)).toBe('idle');
  });

  it('nothing happens while the controller is busy', () => {
    const r = click(start(), trap, fixtureCtx('chain-reaction', true));
    expect(sends(r)).toEqual([]);
    expect(kindOf(r)).toBe('idle');
  });

  it('works for every activatable Set card of the chain-respond fixture', () => {
    const c = fixtureCtx('chain-respond');
    expect(sends(click(start(), centre(cardRect(c, 'p0-30')), c))).toEqual([
      activate('p0-30', 'heal'),
    ]);
    expect(sends(click(start(), centre(cardRect(c, 'p0-31')), c))).toEqual([
      activate('p0-31', 'destroy-one'),
    ]);
  });
});

describe('a Set card with several listed activations', () => {
  const f = loadFixture('chain-reaction');
  const others = f.legalActions.filter((a) => a.type !== 'ActivateEffect');

  it('several effects: the option menu lists one entry per effect; picking one sends it', () => {
    const legal = [activate('p0-30', 'first'), activate('p0-30', 'second'), ...others];
    const ctx = makeCtx(f.view, legal);
    const r = click(start(), centre(cardRect(ctx, 'p0-30')), ctx);
    expect(kindOf(r)).toBe('choosing-option');
    if (r.state.kind !== 'choosing-option') throw new Error();
    expect(r.state.options.map((o) => o.label)).toEqual([
      t('duel.activateEffectN', { n: 1 }),
      t('duel.activateEffectN', { n: 2 }),
    ]);
    const second = optionRects(r.state.anchor, 2)[1]!;
    expect(sends(click(r, centre(second), ctx))).toEqual([activate('p0-30', 'second')]);
  });

  it('one effect with a cost choice: asks for the cost card (cancellable), then sends the matching action', () => {
    const legal = [
      activate('p0-30', 'destroy-one', ['p0-1']),
      activate('p0-30', 'destroy-one', ['p0-2']),
      ...others,
    ];
    const ctx = makeCtx(f.view, legal);
    let r = click(start(), centre(cardRect(ctx, 'p0-30')), ctx);
    expect(r.state).toMatchObject({ kind: 'selecting-tribute', purpose: 'cost' });
    r = click(r, centre(cardRect(ctx, 'p0-2')), ctx);
    r = click(r, centre(layout.overlay.confirm), ctx);
    expect(sends(r)).toEqual([activate('p0-30', 'destroy-one', ['p0-2'])]);
  });
});

describe('TriggerActivation prompt (Yes / No overlay)', () => {
  const f = loadFixture('trigger-optional');
  const ctx = fixtureCtx('trigger-optional');
  const promptId = f.view.pendingPrompt!.promptId;
  const answer = (ids: string[], decline?: boolean): PlayerAction => ({
    type: 'ResolvePendingPrompt',
    payload: { playerIndex: 0, promptId, cardInstanceIds: ids, ...(decline ? { decline } : {}) },
  });
  const opened = (c = ctx): Run => feed(start(), { type: 'viewChanged' }, c);

  it('opens a trigger selection over the listed targets, the decline kept apart', () => {
    const r = opened();
    expect(r.state).toMatchObject({
      kind: 'selecting-tribute',
      purpose: 'trigger',
      candidates: ['p1-10', 'p1-12'],
      selected: [],
    });
    if (r.state.kind !== 'selecting-tribute') throw new Error();
    expect(r.state.decline).toEqual(answer([], true));
    expect(
      r.state.actions.some((a) => a.type === 'ResolvePendingPrompt' && a.payload.decline),
    ).toBe(false);
    expect(canConfirm(r.state)).toBe(false);
    expect(overlayFor(r.state, ctx).confirm).toEqual({
      enabled: false,
      showCancel: true,
      purpose: 'trigger',
    });
  });

  it('choosing a target then "Kích hoạt" sends that answer', () => {
    let r = opened();
    r = click(r, centre(cardRect(ctx, 'p1-12')), ctx);
    expect(canConfirm(r.state)).toBe(true);
    r = click(r, centre(layout.overlay.confirm), ctx);
    expect(sends(r)).toEqual([answer(['p1-12'])]);
    expect(kindOf(r)).toBe('pending-server');
  });

  it('"Không" sends the listed decline', () => {
    const r = click(opened(), centre(layout.overlay.cancel), ctx);
    expect(sends(r)).toEqual([answer([], true)]);
    expect(isListed(f.legalActions, sends(r)[0]!)).toBe(true);
  });

  it('the cancel event (Esc) never declines', () => {
    const r = feed(opened(), { type: 'cancel' }, ctx);
    expect(sends(r)).toEqual([]);
    expect(r.state).toMatchObject({ kind: 'selecting-tribute', purpose: 'trigger' });
  });

  it('a mandatory trigger (no decline listed) shows no "Không" and the cancel spot does nothing', () => {
    const legal = f.legalActions.filter(
      (a) => !(a.type === 'ResolvePendingPrompt' && a.payload.decline),
    );
    const c = makeCtx(f.view, legal);
    const r0 = opened(c);
    expect(overlayFor(r0.state, c).confirm?.showCancel).toBe(false);
    const r = click(r0, centre(layout.overlay.cancel), c);
    expect(sends(r)).toEqual([]);
    expect(r.state).toMatchObject({ kind: 'selecting-tribute', purpose: 'trigger' });
  });

  it('a trigger without targets can be confirmed at once', () => {
    const legal = [answer([]), answer([], true)];
    const c = makeCtx(f.view, legal);
    const r0 = opened(c);
    expect(canConfirm(r0.state)).toBe(true);
    expect(sends(click(r0, centre(layout.overlay.confirm), c))).toEqual([answer([])]);
  });

  it('a click that misses an option menu re-opens a pending prompt instead of leaving it stuck', () => {
    const menu: InteractionState = {
      kind: 'choosing-option',
      anchor: { x: 300, y: 300 },
      options: [{ label: 'x', actions: [] }],
    };
    const r = click({ state: menu, effects: [] }, { x: 5, y: 5 }, ctx);
    expect(r.state).toMatchObject({ kind: 'selecting-tribute', purpose: 'trigger' });
  });
});
