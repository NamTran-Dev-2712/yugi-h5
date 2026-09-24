import { describe, expect, it } from 'vitest';
import { computeLayout, handSlots, staticRects, type Rect } from './layout';
import { theme } from './theme';

const inFrame = (r: Rect): boolean =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= theme.frame.width && r.y + r.h <= theme.frame.height;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('computeLayout', () => {
  const layout = computeLayout();
  const rects = staticRects(layout);

  it('puts every fixed rect inside the logical frame', () => {
    for (const { name, rect } of rects) expect(inFrame(rect), name).toBe(true);
  });

  it('has no two fixed rects overlapping', () => {
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(
          overlaps(rects[i]!.rect, rects[j]!.rect),
          `${rects[i]!.name} vs ${rects[j]!.name}`,
        ).toBe(false);
      }
    }
  });

  it('mirrors the two sides around the middle of the frame', () => {
    const mirror = (r: Rect): Rect => ({ ...r, y: theme.frame.height - r.y - r.h });
    for (const key of ['fieldZone', 'extraDeck', 'deck', 'graveyard', 'handBand'] as const) {
      expect(layout.opp[key], key).toEqual(mirror(layout.self[key]));
    }
    for (let i = 0; i < 5; i++) {
      expect(layout.opp.monsterZones[i]).toEqual(mirror(layout.self.monsterZones[i]!));
      expect(layout.opp.spellTrapZones[i]).toEqual(mirror(layout.self.spellTrapZones[i]!));
    }
  });

  it('is symmetric left/right and puts the opponent above the viewer', () => {
    const row = layout.self.monsterZones;
    const left = row[0].x;
    const right = theme.frame.width - (row[4].x + row[4].w);
    expect(left).toBe(right);
    expect(layout.opp.monsterZones[0].y).toBeLessThan(layout.self.monsterZones[0].y);
    expect(layout.opp.handBand.y).toBeLessThan(layout.self.handBand.y);
  });

  it('lays out five zones per row left to right', () => {
    for (const side of [layout.self, layout.opp]) {
      for (let i = 1; i < 5; i++) {
        expect(side.monsterZones[i]!.x).toBeGreaterThan(
          side.monsterZones[i - 1]!.x + side.monsterZones[i - 1]!.w - 1,
        );
      }
    }
  });
});

describe('handSlots', () => {
  const band = computeLayout().self.handBand;

  it('returns one slot per card, none for an empty hand', () => {
    expect(handSlots(0, 'self')).toEqual([]);
    for (const n of [1, 5, 7]) expect(handSlots(n, 'self')).toHaveLength(n);
  });

  it('keeps 0..20 cards inside the hand band, in both sides', () => {
    for (const side of ['self', 'opp'] as const) {
      const b = computeLayout()[side].handBand;
      for (let n = 0; n <= 20; n++) {
        for (const r of handSlots(n, side)) {
          expect(r.x, `${side}${n}`).toBeGreaterThanOrEqual(b.x);
          expect(r.x + r.w, `${side}${n}`).toBeLessThanOrEqual(b.x + b.w);
          expect(inFrame(r)).toBe(true);
        }
      }
    }
  });

  it('does not overlap cards while the hand fits (up to 11), and is ordered left to right', () => {
    for (let n = 2; n <= 11; n++) {
      const slots = handSlots(n, 'self');
      for (let i = 1; i < n; i++) {
        expect(slots[i]!.x, `n=${n}`).toBeGreaterThanOrEqual(slots[i - 1]!.x + slots[i - 1]!.w);
      }
    }
  });

  it('centres the hand', () => {
    const slots = handSlots(3, 'self');
    const left = slots[0]!.x - band.x;
    const right = band.x + band.w - (slots[2]!.x + slots[2]!.w);
    expect(Math.abs(left - right)).toBeLessThan(0.001);
  });
});
