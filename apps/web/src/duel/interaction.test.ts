import type { PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { loadFixture, type FixtureName } from './fixtures';
import { canConfirm, overlayFor, type InteractionState } from './interaction';
import { isListed } from './legal-index';
import { optionRects } from './layout';
import {
  asViewer1,
  cardRect,
  centre,
  click,
  down,
  drag,
  dragEvents,
  feed,
  feedAll,
  fixtureCtx,
  layout,
  makeCtx,
  move,
  oppZone,
  selfZone,
  sends,
  start,
  toasts,
  up,
  type Run,
} from './interaction.harness';

const kindOf = (r: Run): InteractionState['kind'] => r.state.kind;

/** Click option `i` of the open menu. */
function pickOption(run: Run, i: number, ctx: ReturnType<typeof fixtureCtx>): Run {
  if (run.state.kind !== 'choosing-option') throw new Error(`no menu (state ${run.state.kind})`);
  const rect = optionRects(run.state.anchor, run.state.options.length)[i]!;
  return click(run, centre(rect), ctx);
}

describe('drag a hand card onto a zone', () => {
  const ctx = fixtureCtx('summon-choice');
  const hand = centre(cardRect(ctx, 'p0-1'));

  it('opens a menu with exactly the legal choices (Summon and Set), sending nothing yet', () => {
    const r = drag(start(), hand, centre(selfZone(0)), ctx);
    expect(kindOf(r)).toBe('choosing-option');
    expect(sends(r)).toEqual([]);
    if (r.state.kind !== 'choosing-option') throw new Error();
    expect(r.state.options.map((o) => o.label)).toEqual(['Triệu hồi', 'Úp (Set)']);
  });

  it('picking an option sends that exact listed action and waits for the server', () => {
    const r = pickOption(drag(start(), hand, centre(selfZone(0)), ctx), 0, ctx);
    expect(sends(r)).toHaveLength(1);
    expect(sends(r)[0]).toMatchObject({
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex: 0 },
    });
    expect(isListed(ctx.legalActions, sends(r)[0]!)).toBe(true);
    expect(kindOf(r)).toBe('pending-server');
  });

  it('the second option sends SetMonster', () => {
    const r = pickOption(drag(start(), hand, centre(selfZone(3)), ctx), 1, ctx);
    expect(sends(r)[0]).toMatchObject({ type: 'SetMonster', payload: { zoneIndex: 3 } });
  });

  it('with a single legal choice it sends at once, no menu', () => {
    const only = ctx.legalActions.filter((a) => a.type !== 'SetMonster');
    const c = makeCtx(ctx.view, only);
    const r = drag(start(), centre(cardRect(c, 'p0-1')), centre(selfZone(1)), c);
    expect(sends(r)).toHaveLength(1);
    expect(sends(r)[0]!.type).toBe('NormalSummon');
    expect(kindOf(r)).toBe('pending-server');
  });

  it('a click outside the menu closes it and sends nothing', () => {
    let r = drag(start(), hand, centre(selfZone(0)), ctx);
    r = click(r, { x: 5, y: 700 }, ctx);
    expect(kindOf(r)).toBe('idle');
    expect(sends(r)).toEqual([]);
  });

  it('dropping on a zone that holds a monster sends nothing and toasts', () => {
    const r = drag(start(), hand, centre(selfZone(2)), ctx);
    expect(sends(r)).toEqual([]);
    expect(kindOf(r)).toBe('idle');
    expect(toasts(r)).toHaveLength(1);
  });

  it('dropping outside every zone (or on the opponent side) sends nothing and toasts', () => {
    for (const to of [
      { x: 640, y: 360 },
      centre(oppZone(1)),
      centre(layout.self.spellTrapZones[0]),
    ]) {
      const r = drag(start(), hand, to, ctx);
      expect(sends(r)).toEqual([]);
      expect(kindOf(r)).toBe('idle');
      expect(toasts(r)).toHaveLength(1);
    }
  });

  it('Escape (cancel) while dragging returns to idle without sending', () => {
    const r = feedAll(start(), [down(hand), move(centre(selfZone(0))), { type: 'cancel' }], ctx);
    expect(kindOf(r)).toBe('idle');
    expect(sends(r)).toEqual([]);
  });
});

describe('cards that cannot be dragged', () => {
  it('a spell/other card without a listed action does not follow the pointer or highlight anything', () => {
    const ctx = fixtureCtx('summon-choice');
    let r = feedAll(start(), [down(centre(cardRect(ctx, 'p0-2'))), move({ x: 500, y: 500 })], ctx);
    if (r.state.kind !== 'dragging-card') throw new Error(`state ${r.state.kind}`);
    expect(r.state.draggable).toBe(false);
    const o = overlayFor(r.state, ctx);
    expect(o.ghost).toBeNull();
    expect(o.zones).toEqual([]);
    r = feed(r, up(centre(selfZone(0))), ctx);
    expect(sends(r)).toEqual([]);
    expect(kindOf(r)).toBe('idle');
  });

  it('outside the Main Phase (Battle) no hand card can be dragged', () => {
    const ctx = fixtureCtx('attack');
    const r = drag(start(), centre(cardRect(ctx, 'p0-1')), centre(selfZone(0)), ctx);
    expect(sends(r)).toEqual([]);
    expect(
      overlayFor(feed(start(), down(centre(cardRect(ctx, 'p0-1'))), ctx).state, ctx).zones,
    ).toEqual([]);
  });

  it('with Normal Summon already used, the hand has no legal zone (drag-illegal)', () => {
    const ctx = fixtureCtx('drag-illegal');
    for (const id of ['p0-1', 'p0-2']) {
      let r = feedAll(start(), [down(centre(cardRect(ctx, id))), move({ x: 500, y: 450 })], ctx);
      expect(overlayFor(r.state, ctx).zones).toEqual([]);
      r = feed(r, up(centre(selfZone(0))), ctx);
      expect(sends(r)).toEqual([]);
    }
  });

  it("the opponent's cards can never be picked up", () => {
    const ctx = fixtureCtx('attack');
    const opp = ctx.model.cards.find((c) => c.side === 'opp' && c.zone === 'hand')!;
    const r = drag(start(), centre(opp.rect), centre(selfZone(0)), ctx);
    expect(sends(r)).toEqual([]);
  });
});

describe('highlights come from legalActions', () => {
  it('while dragging a card, exactly its legal zones are lit', () => {
    const ctx = fixtureCtx('summon-choice');
    const r = feedAll(
      start(),
      [down(centre(cardRect(ctx, 'p0-1'))), move({ x: 600, y: 500 })],
      ctx,
    );
    const o = overlayFor(r.state, ctx);
    expect(o.zones).toEqual([0, 1, 3, 4].map((i) => selfZone(i)));
    expect(o.ghost?.cardId).toBe('p0-1');
  });

  it('a tribute card lights every zone the server lists, including occupied ones freed by a tribute', () => {
    const ctx = fixtureCtx('tribute');
    const r = feedAll(
      start(),
      [down(centre(cardRect(ctx, 'p0-1'))), move({ x: 600, y: 500 })],
      ctx,
    );
    expect(overlayFor(r.state, ctx).zones).toEqual([0, 1, 2, 3, 4].map((i) => selfZone(i)));
  });

  it('while dragging an attack, exactly the listed targets are lit', () => {
    const ctx = fixtureCtx('attack');
    const r = feedAll(
      start(),
      [down(centre(cardRect(ctx, 'p0-10'))), move({ x: 600, y: 300 })],
      ctx,
    );
    const o = overlayFor(r.state, ctx);
    expect(o.arrow).not.toBeNull();
    expect(o.targets).toEqual(['p1-10', 'p1-11', 'p1-12'].map((id) => cardRect(ctx, id)));
    expect(o.lpTarget).toBeNull();
  });

  it('the opponent LP area is lit only when a direct attack is listed', () => {
    const ctx = fixtureCtx('attack-direct');
    const r = feedAll(
      start(),
      [down(centre(cardRect(ctx, 'p0-10'))), move({ x: 600, y: 300 })],
      ctx,
    );
    const o = overlayFor(r.state, ctx);
    expect(o.lpTarget).toEqual(layout.opp.lp);
    expect(o.targets).toEqual([]);
  });

  it('nothing is lit at rest', () => {
    const o = overlayFor(start().state, fixtureCtx('summon-choice'));
    expect(o.zones).toEqual([]);
    expect(o.targets).toEqual([]);
    expect(o.ghost).toBeNull();
    expect(o.arrow).toBeNull();
    expect(o.menu).toBeNull();
    expect(o.confirm).toBeNull();
  });
});

describe('tribute selection', () => {
  const ctx = fixtureCtx('tribute');
  const hand = centre(cardRect(ctx, 'p0-1'));

  /** Drop on `zone`, choose "Triệu hồi", land in selecting-tribute. */
  function toSelecting(zone: number): Run {
    return pickOption(drag(start(), hand, centre(selfZone(zone)), ctx), 0, ctx);
  }
  const toggle = (run: Run, id: string): Run => click(run, centre(cardRect(ctx, id)), ctx);
  const pressConfirm = (run: Run): Run => click(run, centre(layout.overlay.confirm), ctx);
  const pressCancel = (run: Run): Run => click(run, centre(layout.overlay.cancel), ctx);

  it('asks to choose tributes after Summon is picked, sending nothing', () => {
    const r = toSelecting(0);
    expect(kindOf(r)).toBe('selecting-tribute');
    expect(sends(r)).toEqual([]);
    if (r.state.kind !== 'selecting-tribute') throw new Error();
    expect([...r.state.candidates].sort()).toEqual(['p0-10', 'p0-11']);
    expect(canConfirm(r.state)).toBe(false);
    expect(overlayFor(r.state, ctx).confirm).toEqual({
      enabled: false,
      showCancel: true,
      purpose: 'tribute',
    });
  });

  it('Confirm is off with too few, on with exactly the listed number, off again with too many', () => {
    let r = toSelecting(0);
    r = toggle(r, 'p0-10');
    expect(canConfirm(r.state)).toBe(true);
    r = toggle(r, 'p0-11');
    expect(canConfirm(r.state)).toBe(false); // 2 chosen, the server only lists 1
    expect(sends(pressConfirm(r))).toEqual([]);
    r = toggle(r, 'p0-11'); // untick
    expect(canConfirm(r.state)).toBe(true);
  });

  it('Confirm sends the listed action for that zone and tribute, then waits', () => {
    const r = pressConfirm(toggle(toSelecting(0), 'p0-11'));
    expect(sends(r)).toHaveLength(1);
    expect(sends(r)[0]).toMatchObject({
      type: 'NormalSummon',
      payload: { cardInstanceId: 'p0-1', zoneIndex: 0, tributeInstanceIds: ['p0-11'] },
    });
    expect(isListed(ctx.legalActions, sends(r)[0]!)).toBe(true);
    expect(kindOf(r)).toBe('pending-server');
  });

  it('Confirm with nothing chosen does nothing', () => {
    const r = pressConfirm(toSelecting(0));
    expect(sends(r)).toEqual([]);
    expect(kindOf(r)).toBe('selecting-tribute');
  });

  it('Cancel goes back to idle without sending anything', () => {
    const r = pressCancel(toggle(toSelecting(0), 'p0-10'));
    expect(kindOf(r)).toBe('idle');
    expect(sends(r)).toEqual([]);
    expect(kindOf(feed(toSelecting(0), { type: 'cancel' }, ctx))).toBe('idle');
  });

  it("dropping on an occupied zone that the server frees only offers that zone's tribute", () => {
    const r = toSelecting(1);
    if (r.state.kind !== 'selecting-tribute') throw new Error(r.state.kind);
    expect(r.state.candidates).toEqual(['p0-10']);
    const done = pressConfirm(toggle(r, 'p0-10'));
    expect(sends(done)[0]).toMatchObject({
      payload: { zoneIndex: 1, tributeInstanceIds: ['p0-10'] },
    });
    // the other monster is not a legal tribute for zone 1
    expect(canConfirm(toggle(toSelecting(1), 'p0-11').state)).toBe(false);
  });

  it('candidates are highlighted, and the chosen ones marked', () => {
    const r = toggle(toSelecting(0), 'p0-10');
    const o = overlayFor(r.state, ctx);
    expect([...o.candidates].sort()).toEqual(['p0-10', 'p0-11']);
    expect(o.selected).toEqual(['p0-10']);
  });

  it('clicking something that is not a candidate does nothing', () => {
    const r = click(toSelecting(0), centre(cardRect(ctx, 'p0-2')), ctx);
    expect(kindOf(r)).toBe('selecting-tribute');
  });
});

describe('position change menu', () => {
  const ctx = fixtureCtx('summon-choice');
  const monster = centre(cardRect(ctx, 'p0-10'));

  it('clicking my monster opens the position menu with what the server listed', () => {
    const r = click(start(), monster, ctx);
    if (r.state.kind !== 'choosing-option') throw new Error(r.state.kind);
    expect(r.state.options).toHaveLength(1);
    expect(r.state.options[0]!.label).toMatch(/Phòng thủ/);
    expect(sends(r)).toEqual([]);
  });

  it('choosing it sends that ChangePosition', () => {
    const r = pickOption(click(start(), monster, ctx), 0, ctx);
    expect(sends(r)[0]).toMatchObject({
      type: 'ChangePosition',
      payload: { cardInstanceId: 'p0-10', toPosition: 'DefenseUp' },
    });
  });

  it('a monster with no listed action opens no menu', () => {
    const c = fixtureCtx('midgame');
    const r = click(start(), centre(cardRect(c, 'p0-10')), c);
    expect(kindOf(r)).toBe('idle');
    expect(sends(r)).toEqual([]);
  });

  it("the opponent's monster never opens a menu", () => {
    const r = click(start(), centre(cardRect(ctx, 'p1-11')), ctx);
    expect(kindOf(r)).toBe('idle');
  });
});

describe('attack arrow', () => {
  it('drop on a face-down opponent monster (by position) sends the listed attack on its instanceId', () => {
    const ctx = fixtureCtx('attack');
    const r = drag(start(), centre(cardRect(ctx, 'p0-10')), centre(oppZone(2)), ctx);
    expect(sends(r)).toHaveLength(1);
    expect(sends(r)[0]).toMatchObject({
      type: 'DeclareAttack',
      payload: { attackerInstanceId: 'p0-10', targetInstanceId: 'p1-11' },
    });
    expect(kindOf(r)).toBe('pending-server');
  });

  it('drop on an empty opponent zone, my own side, or the LP (opponent has monsters) sends nothing and toasts', () => {
    const ctx = fixtureCtx('attack');
    const from = centre(cardRect(ctx, 'p0-10'));
    for (const to of [centre(oppZone(1)), centre(selfZone(0)), centre(layout.opp.lp)]) {
      const r = drag(start(), from, to, ctx);
      expect(sends(r)).toEqual([]);
      expect(toasts(r)).toHaveLength(1);
      expect(kindOf(r)).toBe('idle');
    }
  });

  it('direct attack: drop on the opponent LP sends the listed direct action', () => {
    const ctx = fixtureCtx('attack-direct');
    const r = drag(start(), centre(cardRect(ctx, 'p0-11')), centre(layout.opp.lp), ctx);
    expect(sends(r)).toHaveLength(1);
    const payload = (sends(r)[0] as Extract<PlayerAction, { type: 'DeclareAttack' }>).payload;
    expect(payload.attackerInstanceId).toBe('p0-11');
    expect(payload.targetInstanceId ?? null).toBeNull();
    expect(isListed(ctx.legalActions, sends(r)[0]!)).toBe(true);
  });

  it('turn 1 / not Battle: no DeclareAttack listed, so no arrow and nothing is sent', () => {
    const ctx = fixtureCtx('midgame'); // Main1, legal = EndPhase + Surrender
    const from = centre(cardRect(ctx, 'p0-10'));
    let r = feedAll(start(), [down(from), move({ x: 600, y: 250 })], ctx);
    expect(overlayFor(r.state, ctx).arrow).toBeNull();
    r = feed(r, up(centre(oppZone(1))), ctx);
    expect(sends(r)).toEqual([]);
    expect(kindOf(r)).toBe('idle');
  });

  it('a monster that can only change position gets no arrow when dragged, and nothing is sent', () => {
    const ctx = fixtureCtx('summon-choice'); // p0-10 has a listed ChangePosition but no DeclareAttack
    let r = feedAll(start(), [down(centre(cardRect(ctx, 'p0-10'))), move({ x: 600, y: 300 })], ctx);
    expect(overlayFor(r.state, ctx).arrow).toBeNull();
    expect(overlayFor(r.state, ctx).targets).toEqual([]);
    r = feed(r, up(centre(oppZone(1))), ctx);
    expect(sends(r)).toEqual([]);
    expect(kindOf(r)).toBe('idle');
  });

  it('a click (no drag) on an attacker does not attack', () => {
    const ctx = fixtureCtx('attack');
    const r = click(start(), centre(cardRect(ctx, 'p0-10')), ctx);
    expect(sends(r)).toEqual([]);
  });

  it('small jitter under the threshold is still a click, not an attack', () => {
    const ctx = fixtureCtx('attack');
    const from = centre(cardRect(ctx, 'p0-10'));
    const r = feedAll(
      start(),
      [down(from), move({ x: from.x + 3, y: from.y + 2 }), up(centre(oppZone(2)))],
      ctx,
    );
    expect(sends(r)).toEqual([]);
  });
});

describe('waiting for the server', () => {
  const ctx = fixtureCtx('summon-choice');
  const sent = (): Run => {
    const c = makeCtx(
      ctx.view,
      ctx.legalActions.filter((a) => a.type !== 'SetMonster'),
    );
    return drag(start(), centre(cardRect(c, 'p0-1')), centre(selfZone(0)), c);
  };

  it('ignores every pointer event while pending', () => {
    const r0 = sent();
    expect(kindOf(r0)).toBe('pending-server');
    const r = feedAll(
      r0,
      [...dragEvents(centre(cardRect(ctx, 'p0-3')), centre(selfZone(1))), { type: 'cancel' }],
      ctx,
    );
    expect(r.state).toEqual(r0.state);
    expect(sends(r)).toHaveLength(1); // still only the first request
  });

  it('ignores input while the controller is busy (AI thinking)', () => {
    const busy = { ...ctx, busy: true };
    const r = drag(start(), centre(cardRect(ctx, 'p0-1')), centre(selfZone(0)), busy);
    expect(kindOf(r)).toBe('idle');
    expect(sends(r)).toEqual([]);
    expect(toasts(r)).toEqual([]);
  });

  it('serverOk returns to idle', () => {
    expect(kindOf(feed(sent(), { type: 'serverOk' }, ctx))).toBe('idle');
  });

  it('serverRejected returns to idle and shows the server message', () => {
    const r = feed(sent(), { type: 'serverRejected', message: 'Ô đã có quái' }, ctx);
    expect(kindOf(r)).toBe('idle');
    expect(toasts(r)).toEqual(['Ô đã có quái']);
    expect(sends(r)).toHaveLength(1); // no automatic retry
  });

  it('viewChanged while pending does not unlock early; while dragging it resets', () => {
    expect(kindOf(feed(sent(), { type: 'viewChanged' }, ctx))).toBe('pending-server');
    const dragging = feed(start(), down(centre(cardRect(ctx, 'p0-1'))), ctx);
    expect(kindOf(dragging)).toBe('dragging-card');
    expect(kindOf(feed(dragging, { type: 'viewChanged' }, ctx))).toBe('idle');
  });
});

describe('discard prompt', () => {
  it('a one-card discard is a click on a highlighted hand card', () => {
    const ctx = fixtureCtx('handfull');
    const r = click(start(), centre(cardRect(ctx, 'p0-3')), ctx);
    expect(sends(r)).toHaveLength(1);
    expect(sends(r)[0]).toMatchObject({
      type: 'ResolvePendingPrompt',
      payload: { promptId: 'discard-5', cardInstanceIds: ['p0-3'] },
    });
  });

  // Two cards to discard: the server lists every pair.
  const f = loadFixture('handfull');
  const ids = ['p0-1', 'p0-2', 'p0-3'];
  const pairs = ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b]));
  const view2 = {
    ...f.view,
    pendingPrompt: { ...f.view.pendingPrompt!, payload: { count: 2 } },
  };
  const legal2: PlayerAction[] = [
    ...pairs.map((p): PlayerAction => ({
      type: 'ResolvePendingPrompt',
      payload: { playerIndex: 0, promptId: 'discard-5', cardInstanceIds: p },
    })),
    { type: 'Surrender', payload: { playerIndex: 0 } },
  ];
  const ctx2 = makeCtx(view2, legal2);

  it('a multi-card discard opens the selection on its own and cannot be cancelled', () => {
    let r = feed(start(), { type: 'viewChanged' }, ctx2);
    if (r.state.kind !== 'selecting-tribute') throw new Error(r.state.kind);
    expect(r.state.purpose).toBe('discard');
    r = feed(r, { type: 'cancel' }, ctx2);
    expect(kindOf(r)).toBe('selecting-tribute');
    expect(overlayFor(r.state, ctx2).confirm?.showCancel).toBe(false);
  });

  it('Confirm needs exactly a listed pair', () => {
    let r = feed(start(), { type: 'viewChanged' }, ctx2);
    const toggle = (run: Run, id: string) => click(run, centre(cardRect(ctx2, id)), ctx2);
    r = toggle(r, 'p0-1');
    expect(canConfirm(r.state)).toBe(false);
    r = toggle(r, 'p0-3');
    expect(canConfirm(r.state)).toBe(true);
    r = toggle(r, 'p0-2');
    expect(canConfirm(r.state)).toBe(false);
    r = toggle(r, 'p0-1');
    r = click(r, centre(layout.overlay.confirm), ctx2);
    expect(sends(r)[0]).toMatchObject({
      type: 'ResolvePendingPrompt',
      payload: { cardInstanceIds: expect.arrayContaining(['p0-2', 'p0-3']) },
    });
  });
});

describe('seat 1 viewer', () => {
  it('works the same for the other seat and sends actions for that seat', () => {
    const f = loadFixture('summon-choice');
    const v1 = asViewer1(f.view, f.legalActions);
    const ctx = makeCtx(v1.view, v1.legalActions);
    const r = pickOption(
      drag(start(), centre(cardRect(ctx, 'p0-1')), centre(selfZone(0)), ctx),
      0,
      ctx,
    );
    expect(sends(r)).toHaveLength(1);
    expect(sends(r)[0]!.payload.playerIndex).toBe(1);
    expect(isListed(ctx.legalActions, sends(r)[0]!)).toBe(true);
  });

  it("does not use the other seat's actions", () => {
    const f = loadFixture('summon-choice');
    // Viewer 1 but the list only holds seat-0 actions: nothing is draggable.
    const v1 = asViewer1(f.view, f.legalActions);
    const ctx = makeCtx(v1.view, f.legalActions);
    const r = drag(start(), centre(cardRect(ctx, 'p0-1')), centre(selfZone(0)), ctx);
    expect(sends(r)).toEqual([]);
  });
});

describe('invariant: every request is a listed action (seeded random gestures)', () => {
  const names: FixtureName[] = [
    'midgame',
    'handfull',
    'summon-choice',
    'tribute',
    'attack',
    'attack-direct',
    'drag-illegal',
  ];
  function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  it('holds over many random pointer sequences on every fixture', () => {
    let totalSends = 0;
    for (const name of names) {
      const ctx = fixtureCtx(name);
      const targets = [
        ...ctx.model.cards.map((c) => centre(c.rect)),
        ...layout.self.monsterZones.map(centre),
        ...layout.opp.monsterZones.map(centre),
        centre(layout.opp.lp),
        centre(layout.overlay.confirm),
        centre(layout.overlay.cancel),
        { x: 640, y: 360 },
      ];
      for (let seed = 1; seed <= 40; seed++) {
        const rand = rng(seed * 7919);
        let r = start();
        for (let step = 0; step < 60; step++) {
          const p = targets[Math.floor(rand() * targets.length)]!;
          const roll = rand();
          const ev =
            roll < 0.3
              ? down(p)
              : roll < 0.6
                ? move(p)
                : roll < 0.9
                  ? up(p)
                  : ({ type: 'cancel' } as const);
          r = feed(r, ev, ctx);
          if (r.state.kind === 'pending-server') r = feed(r, { type: 'serverOk' }, ctx);
        }
        for (const a of sends(r)) {
          expect(isListed(ctx.legalActions, a), `${name} seed ${seed}`).toBe(true);
          totalSends++;
        }
      }
    }
    expect(totalSends).toBeGreaterThan(20); // the walk really reaches sending states
  });
});
