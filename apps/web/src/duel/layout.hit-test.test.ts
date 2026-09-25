import { describe, expect, it } from 'vitest';
import { computeLayout, hitTest, optionRects, pointInRect, zoneIndexAt, type Rect } from './layout';
import { theme } from './theme';

const layout = computeLayout();
const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const none = { cards: [], buttons: [] };

describe('pointInRect', () => {
  const r: Rect = { x: 10, y: 20, w: 30, h: 40 };
  it('includes the top-left edge and excludes the bottom-right edge', () => {
    expect(pointInRect(r, { x: 10, y: 20 })).toBe(true);
    expect(pointInRect(r, { x: 39.9, y: 59.9 })).toBe(true);
    expect(pointInRect(r, { x: 40, y: 30 })).toBe(false);
    expect(pointInRect(r, { x: 20, y: 60 })).toBe(false);
    expect(pointInRect(r, { x: 9.9, y: 30 })).toBe(false);
  });
});

describe('zoneIndexAt', () => {
  it('finds each monster zone of each side by its centre', () => {
    for (const side of ['self', 'opp'] as const) {
      layout[side].monsterZones.forEach((rect, i) => {
        expect(zoneIndexAt(layout, side, centre(rect))).toBe(i);
      });
    }
  });
  it('does not confuse the two sides', () => {
    expect(zoneIndexAt(layout, 'opp', centre(layout.self.monsterZones[2]))).toBeNull();
    expect(zoneIndexAt(layout, 'self', centre(layout.opp.monsterZones[2]))).toBeNull();
  });
  it('is null in the gap between zones and outside the board', () => {
    const a = layout.self.monsterZones[0];
    const gap = { x: a.x + a.w + theme.card.zoneGap / 2, y: a.y + a.h / 2 };
    expect(zoneIndexAt(layout, 'self', gap)).toBeNull();
    expect(zoneIndexAt(layout, 'self', { x: 5, y: 5 })).toBeNull();
    expect(zoneIndexAt(layout, 'self', centre(layout.self.spellTrapZones[0]))).toBeNull();
  });
});

describe('hitTest', () => {
  const cards = [
    { id: 'under', rect: { x: 100, y: 600, w: 64, h: 90 } },
    { id: 'over', rect: { x: 140, y: 600, w: 64, h: 90 } }, // overlaps `under` from x=140..164
  ];
  it('returns the topmost (last drawn) card where cards overlap', () => {
    expect(hitTest(layout, { cards, buttons: [] }, { x: 150, y: 640 })).toEqual({
      kind: 'card',
      id: 'over',
    });
    expect(hitTest(layout, { cards, buttons: [] }, { x: 110, y: 640 })).toEqual({
      kind: 'card',
      id: 'under',
    });
  });
  it('returns the LP area of a side', () => {
    expect(hitTest(layout, none, centre(layout.opp.lp))).toEqual({ kind: 'lp', side: 'opp' });
    expect(hitTest(layout, none, centre(layout.self.lp))).toEqual({ kind: 'lp', side: 'self' });
  });
  it('returns enabled buttons only', () => {
    const r = layout.buttons.endTurn;
    const on = { cards: [], buttons: [{ id: 'endTurn', rect: r, enabled: true }] };
    const off = { cards: [], buttons: [{ id: 'endTurn', rect: r, enabled: false }] };
    expect(hitTest(layout, on, centre(r))).toEqual({ kind: 'button', id: 'endTurn' });
    expect(hitTest(layout, off, centre(r))).toEqual({ kind: 'none' });
  });
  it('returns none for empty space', () => {
    expect(hitTest(layout, none, { x: 640, y: 360 })).toEqual({ kind: 'none' });
  });
});

describe('optionRects', () => {
  it('stacks one rect per option without overlap', () => {
    const rects = optionRects({ x: 300, y: 300 }, 3);
    expect(rects).toHaveLength(3);
    for (let i = 1; i < rects.length; i++) {
      expect(rects[i]!.y).toBeGreaterThanOrEqual(rects[i - 1]!.y + rects[i - 1]!.h);
    }
  });
  it('stays inside the frame even when opened at the corner', () => {
    for (const anchor of [
      { x: 0, y: 0 },
      { x: theme.frame.width, y: theme.frame.height },
    ]) {
      for (const r of optionRects(anchor, 2)) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(theme.frame.width);
        expect(r.y + r.h).toBeLessThanOrEqual(theme.frame.height);
      }
    }
  });
  it('is empty for 0 options', () => {
    expect(optionRects({ x: 1, y: 1 }, 0)).toEqual([]);
  });
});
