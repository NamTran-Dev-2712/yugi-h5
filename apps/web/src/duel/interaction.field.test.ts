import type { PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { overlayFor, type InteractionState } from './interaction';
import { fieldZoneAt, optionRects } from './layout';
import {
  cardRect,
  centre,
  click,
  down,
  drag,
  feedAll,
  fixtureCtx,
  layout,
  makeCtx,
  move,
  sends,
  start,
  toasts,
  type Run,
} from './interaction.harness';
import { loadFixture } from './fixtures';
import { strings } from './strings';

/**
 * Task 4.3b — the Field Zone in the interaction machine: a Field Spell is dragged onto MY Field Zone ("Kích hoạt" /
 * "Úp", like a Spell/Trap Zone since 3.2b) and a Set one is activated by a tap (C13). No new machine state; everything
 * sent is an element of `legalActions`.
 */

const kindOf = (r: Run): InteractionState['kind'] => r.state.kind;
const menuLabels = (r: Run): readonly string[] =>
  r.state.kind === 'choosing-option' ? r.state.options.map((o) => o.label) : [];
const pickOption = (r: Run, i: number, ctx: ReturnType<typeof fixtureCtx>): Run => {
  if (r.state.kind !== 'choosing-option') throw new Error('no menu open');
  const rect = optionRects(r.state.anchor, r.state.options.length)[i]!;
  return click(r, centre(rect), ctx);
};
/** The overlay while hand card `cardId` is being dragged (press + two moves, not released yet). */
const dragging = (ctx: ReturnType<typeof fixtureCtx>, cardId: string) => {
  const from = centre(cardRect(ctx, cardId));
  const mid = { x: from.x + 40, y: from.y - 60 };
  const r = feedAll(start(), [down(from), move(mid), move({ x: mid.x, y: mid.y - 40 })], ctx);
  expect(r.state.kind).toBe('dragging-card');
  return overlayFor(r.state, ctx);
};

const myField = centre(layout.self.fieldZone);
const activateField: PlayerAction = {
  type: 'ActivateEffect',
  payload: { playerIndex: 0, cardInstanceId: 'p0-1', effectId: 'activate' },
};
const setField: PlayerAction = {
  type: 'SetSpellTrap',
  payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex: 0 },
};

describe('fieldZoneAt', () => {
  it('is true inside the Field Zone of that side only', () => {
    expect(fieldZoneAt(layout, 'self', myField)).toBe(true);
    expect(fieldZoneAt(layout, 'opp', myField)).toBe(false);
    expect(fieldZoneAt(layout, 'opp', centre(layout.opp.fieldZone))).toBe(true);
    expect(fieldZoneAt(layout, 'self', centre(layout.self.spellTrapZones[0]!))).toBe(false);
    expect(fieldZoneAt(layout, 'self', centre(layout.self.deck))).toBe(false);
  });
});

describe('a Field Spell dragged from the hand (task 4.3b)', () => {
  const ctx = fixtureCtx('field');
  const card = centre(cardRect(ctx, 'p0-1'));

  it('highlights my Field Zone and nothing else as a drop zone', () => {
    expect(dragging(ctx, 'p0-1').zones).toEqual([layout.self.fieldZone]);
  });

  it('a non-Field Spell still highlights my Spell/Trap Zones, never the Field Zone', () => {
    expect(dragging(ctx, 'p0-2').zones).toEqual([...layout.self.spellTrapZones]);
  });

  it('dropped on my Field Zone: a menu "Kích hoạt" / "Úp"', () => {
    const r = drag(start(), card, myField, ctx);
    expect(kindOf(r)).toBe('choosing-option');
    expect(menuLabels(r)).toEqual([strings.activateOption, strings.setSpellOption]);
    expect(sends(r)).toEqual([]);
  });

  it('"Kích hoạt" sends the listed activation; "Úp" sends the listed Set (zoneIndex 0)', () => {
    const opened = drag(start(), card, myField, ctx);
    expect(sends(pickOption(opened, 0, ctx))).toEqual([activateField]);
    expect(sends(pickOption(opened, 1, ctx))).toEqual([setField]);
    expect(kindOf(pickOption(opened, 1, ctx))).toBe('pending-server');
  });

  it('only the Set is listed → dropping sends it at once; nothing listed → the card is not draggable', () => {
    const onlySet = makeCtx(
      ctx.view,
      ctx.legalActions.filter(
        (a) => !(a.type === 'ActivateEffect' && a.payload.cardInstanceId === 'p0-1'),
      ),
    );
    expect(sends(drag(start(), card, myField, onlySet))).toEqual([setField]);
    const none = makeCtx(
      ctx.view,
      ctx.legalActions.filter(
        (a) =>
          !(
            (a.type === 'ActivateEffect' || a.type === 'SetSpellTrap') &&
            a.payload.cardInstanceId === 'p0-1'
          ),
      ),
    );
    const r = drag(start(), card, myField, none);
    expect(sends(r)).toEqual([]);
    expect(toasts(r)).toEqual([strings.toastCardLocked]);
  });

  it('dropped on a Spell/Trap Zone (zone 0 too), a Monster Zone or the opponent Field Zone: nothing is sent', () => {
    for (const to of [
      centre(layout.self.spellTrapZones[0]!),
      centre(layout.self.spellTrapZones[3]!),
      centre(layout.self.monsterZones[0]!),
      centre(layout.opp.fieldZone),
    ]) {
      const r = drag(start(), card, to, ctx);
      expect(sends(r), JSON.stringify(to)).toEqual([]);
      expect(kindOf(r)).toBe('idle');
      expect(toasts(r)).toEqual([strings.toastNoZone]);
    }
  });

  it('a non-Field Spell dropped on my Field Zone sends nothing; on a Spell/Trap Zone it works as before', () => {
    const spell = centre(cardRect(ctx, 'p0-2'));
    const onField = drag(start(), spell, myField, ctx);
    expect(sends(onField)).toEqual([]);
    expect(toasts(onField)).toEqual([strings.toastNoZone]);
    const onZone = drag(start(), spell, centre(layout.self.spellTrapZones[2]!), ctx);
    expect(menuLabels(onZone)).toEqual([strings.activateOption, strings.setSpellOption]);
    expect(sends(pickOption(onZone, 1, ctx))).toEqual([
      {
        type: 'SetSpellTrap',
        payload: { playerIndex: 0, cardInstanceId: 'p0-2', zoneIndex: 2 },
      },
    ]);
  });

  it('nothing while busy', () => {
    const r = drag(start(), card, myField, fixtureCtx('field', true));
    expect(sends(r)).toEqual([]);
    expect(kindOf(r)).toBe('idle');
  });
});

describe('a Set Field Spell (task 4.3b, C13)', () => {
  const ctx = fixtureCtx('field-set');
  const mine = centre(cardRect(ctx, 'p0-30'));

  it('a tap activates it at once with the listed action (no dialog)', () => {
    const r = click(start(), mine, ctx);
    expect(sends(r)).toEqual([
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-30', effectId: 'activate' },
      },
    ]);
    expect(kindOf(r)).toBe('pending-server');
  });

  it('a Set Normal Spell is tapped the same way (Set this turn, listed by the server)', () => {
    expect(sends(click(start(), centre(cardRect(ctx, 'p0-31')), ctx))).toEqual([
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-31', effectId: 'ember-burn' },
      },
    ]);
  });

  it('it never follows the pointer: dragging it away sends nothing', () => {
    const r = drag(start(), mine, centre(layout.self.spellTrapZones[2]!), ctx);
    expect(sends(r)).toEqual([]);
  });

  it("nothing when the server does not list it, while busy, or on the opponent's Field card", () => {
    const f = loadFixture('field-set');
    const unlisted = makeCtx(
      f.view,
      f.legalActions.filter(
        (a) => !(a.type === 'ActivateEffect' && a.payload.cardInstanceId === 'p0-30'),
      ),
    );
    expect(kindOf(click(start(), mine, unlisted))).toBe('idle');
    expect(sends(click(start(), mine, fixtureCtx('field-set', true)))).toEqual([]);
    const theirs = click(start(), centre(cardRect(ctx, 'p1-30')), ctx);
    expect(sends(theirs)).toEqual([]);
    expect(kindOf(theirs)).toBe('idle');
  });

  it('a second Field Spell dropped on my occupied Field Zone still offers "Kích hoạt" / "Úp" (it replaces mine)', () => {
    const r = drag(start(), centre(cardRect(ctx, 'p0-1')), mine, ctx);
    expect(menuLabels(r)).toEqual([strings.activateOption, strings.setSpellOption]);
    expect(sends(pickOption(r, 0, ctx))).toEqual([activateField]);
  });

  it('a face-up Field Spell is not tappable (nothing is listed for it)', () => {
    const active = fixtureCtx('field-active');
    const r = click(start(), centre(cardRect(active, 'p0-30')), active);
    expect(sends(r)).toEqual([]);
    expect(kindOf(r)).toBe('idle');
  });
});
