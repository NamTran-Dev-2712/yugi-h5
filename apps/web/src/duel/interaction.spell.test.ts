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
  down,
  drag,
  feed,
  feedAll,
  fixtureCtx,
  layout,
  makeCtx,
  move,
  selfZone,
  sends,
  start,
  toasts,
  type Run,
} from './interaction.harness';
import { strings } from './strings';

/** Task 3.2b: Set a Spell/Trap, activate a Spell (cost selection), answer a SelectEffectTarget prompt. */

const kindOf = (r: Run): InteractionState['kind'] => r.state.kind;
const selfSpellZone = (i: number) => layout.self.spellTrapZones[i]!;

function pickOption(run: Run, i: number, ctx: ReturnType<typeof fixtureCtx>): Run {
  if (run.state.kind !== 'choosing-option') throw new Error(`no menu (state ${run.state.kind})`);
  const rect = optionRects(run.state.anchor, run.state.options.length)[i]!;
  return click(run, centre(rect), ctx);
}

describe('drag a Spell/Trap from the hand onto my Spell/Trap Zone', () => {
  const ctx = fixtureCtx('spell');
  const spell = centre(cardRect(ctx, 'p0-2')); // SMP-101: activate or Set
  const trap = centre(cardRect(ctx, 'p0-4')); // SMP-201: Set only

  it('a Normal Spell offers exactly "Activate" and "Set", sending nothing yet', () => {
    const r = drag(start(), spell, centre(selfSpellZone(2)), ctx);
    expect(kindOf(r)).toBe('choosing-option');
    expect(sends(r)).toEqual([]);
    if (r.state.kind !== 'choosing-option') throw new Error();
    expect(r.state.options.map((o) => o.label)).toEqual([
      strings.activateOption,
      strings.setSpellOption,
    ]);
  });

  it('"Activate" sends the listed ActivateEffect', () => {
    const r = pickOption(drag(start(), spell, centre(selfSpellZone(2)), ctx), 0, ctx);
    expect(sends(r)).toEqual([
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-2', effectId: 'draw-one' },
      },
    ]);
    expect(kindOf(r)).toBe('pending-server');
  });

  it('"Set" sends SetSpellTrap for the zone it was dropped on', () => {
    const r = pickOption(drag(start(), spell, centre(selfSpellZone(3)), ctx), 1, ctx);
    expect(sends(r)).toEqual([
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-2', zoneIndex: 3 } },
    ]);
  });

  it('a Trap (Set only) is Set at once, no menu', () => {
    const r = drag(start(), trap, centre(selfSpellZone(4)), ctx);
    expect(sends(r)).toEqual([
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-4', zoneIndex: 4 } },
    ]);
    expect(kindOf(r)).toBe('pending-server');
  });

  it('dropping a Trap on an occupied Spell/Trap Zone sends nothing and toasts', () => {
    const r = drag(start(), trap, centre(selfSpellZone(0)), ctx);
    expect(sends(r)).toEqual([]);
    expect(toasts(r)).toEqual([strings.toastNoZone]);
    expect(kindOf(r)).toBe('idle');
  });

  it('dropping a Spell on a Monster Zone sends nothing (no Summon is listed for it)', () => {
    const r = drag(start(), spell, centre(selfZone(0)), ctx);
    expect(sends(r)).toEqual([]);
    expect(kindOf(r)).toBe('idle');
  });

  it("dropping on the opponent's Spell/Trap Zone sends nothing", () => {
    const r = drag(start(), trap, centre(layout.opp.spellTrapZones[2]!), ctx);
    expect(sends(r)).toEqual([]);
  });

  it('while dragging, exactly the listed Spell/Trap Zones are lit (and no Monster Zone)', () => {
    const r = feedAll(start(), [down(trap), move({ x: trap.x, y: trap.y - 200 })], ctx);
    const o = overlayFor(r.state, ctx);
    expect(o.zones).toEqual([1, 2, 3, 4].map((i) => selfSpellZone(i)));
  });

  it('a monster still lights Monster Zones only', () => {
    const m = centre(cardRect(ctx, 'p0-1'));
    const r = feedAll(start(), [down(m), move({ x: m.x, y: m.y - 200 })], ctx);
    expect(overlayFor(r.state, ctx).zones).toEqual([0, 1, 2, 3, 4].map((i) => selfZone(i)));
  });

  it('with only an activation listed (no free zone), dropping on any own Spell/Trap Zone activates', () => {
    const only = ctx.legalActions.filter((a) => a.type !== 'SetSpellTrap');
    const c = makeCtx(ctx.view, only);
    const r = drag(start(), centre(cardRect(c, 'p0-2')), centre(selfSpellZone(0)), c);
    expect(sends(r).map((a) => a.type)).toEqual(['ActivateEffect']);
  });
});

describe('activation with a cost to choose (Discard 1)', () => {
  const f = loadFixture('spell');
  const withCost = (cost: string): PlayerAction => ({
    type: 'ActivateEffect',
    payload: {
      playerIndex: 0,
      cardInstanceId: 'p0-2',
      effectId: 'draw-one',
      costInstanceIds: [cost],
    },
  });
  const legal = [
    ...f.legalActions.filter((a) => a.type !== 'ActivateEffect'),
    withCost('p0-1'),
    withCost('p0-4'),
  ];
  const ctx = makeCtx(f.view, legal);
  const spell = centre(cardRect(ctx, 'p0-2'));

  it('"Activate" opens the cost selection among the listed cost cards (cancellable)', () => {
    const r = pickOption(drag(start(), spell, centre(selfSpellZone(1)), ctx), 0, ctx);
    if (r.state.kind !== 'selecting-tribute') throw new Error(r.state.kind);
    expect(r.state.purpose).toBe('cost');
    expect([...r.state.candidates].sort()).toEqual(['p0-1', 'p0-4']);
    expect(sends(r)).toEqual([]);
    expect(overlayFor(r.state, ctx).confirm).toMatchObject({ showCancel: true, purpose: 'cost' });
  });

  it('Confirm sends the listed activation whose cost equals the choice', () => {
    let r = pickOption(drag(start(), spell, centre(selfSpellZone(1)), ctx), 0, ctx);
    r = click(r, centre(cardRect(ctx, 'p0-4')), ctx);
    expect(canConfirm(r.state)).toBe(true);
    r = click(r, centre(layout.overlay.confirm), ctx);
    expect(sends(r)).toEqual([withCost('p0-4')]);
    expect(isListed(legal, sends(r)[0]!)).toBe(true);
  });
});

describe('SelectEffectTarget prompt', () => {
  const ctx = fixtureCtx('effect-target');

  it('opens the target selection on its own; it cannot be cancelled', () => {
    let r = feed(start(), { type: 'viewChanged' }, ctx);
    if (r.state.kind !== 'selecting-tribute') throw new Error(r.state.kind);
    expect(r.state.purpose).toBe('target');
    expect([...r.state.candidates].sort()).toEqual(['p1-11', 'p1-12']);
    expect(overlayFor(r.state, ctx).confirm).toMatchObject({
      showCancel: false,
      purpose: 'target',
    });
    r = feed(r, { type: 'cancel' }, ctx);
    expect(kindOf(r)).toBe('selecting-tribute');
  });

  it('choosing a face-down opposing monster and confirming sends that listed answer', () => {
    let r = feed(start(), { type: 'viewChanged' }, ctx);
    r = click(r, centre(cardRect(ctx, 'p1-12')), ctx);
    expect(canConfirm(r.state)).toBe(true);
    r = click(r, centre(layout.overlay.confirm), ctx);
    expect(sends(r)).toEqual([
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'effect-3-7', cardInstanceIds: ['p1-12'] },
      },
    ]);
  });

  it('a card that is not a candidate cannot be chosen; two choices for count 1 cannot be confirmed', () => {
    let r = feed(start(), { type: 'viewChanged' }, ctx);
    r = click(r, centre(cardRect(ctx, 'p0-1')), ctx);
    if (r.state.kind !== 'selecting-tribute') throw new Error(r.state.kind);
    expect(r.state.selected).toEqual([]);
    r = click(r, centre(cardRect(ctx, 'p1-11')), ctx);
    r = click(r, centre(cardRect(ctx, 'p1-12')), ctx);
    expect(canConfirm(r.state)).toBe(false);
  });

  it("the opponent's prompt (payload hidden) opens nothing for me", () => {
    const f = loadFixture('effect-target');
    const theirs = {
      ...f.view,
      pendingPrompt: { ...f.view.pendingPrompt!, playerIndex: 1 as const, payload: null },
    };
    const c = makeCtx(theirs, [{ type: 'Surrender', payload: { playerIndex: 0 } }]);
    expect(kindOf(feed(start(), { type: 'viewChanged' }, c))).toBe('idle');
  });
});
