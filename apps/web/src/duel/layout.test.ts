import { describe, expect, it } from 'vitest';
import {
  computeLayout,
  handSlots,
  pickerPanel,
  pickerSlots,
  staticRects,
  type Rect,
} from './layout';
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

describe('selection bar and graveyard picker never cover the turn / phase line (task 4.3b, debt of 4.2d)', () => {
  const layout = computeLayout();
  const { bar, hint, confirm, cancel } = layout.overlay;
  const inside = (inner: Rect, outer: Rect): boolean =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h;

  it('the phase panel is split into the turn/phase line (top) and the bar under it', () => {
    expect(inside(layout.phaseLine, layout.phase)).toBe(true);
    expect(inside(bar, layout.phase)).toBe(true);
    expect(overlaps(layout.phaseLine, bar)).toBe(false);
    // Room for the 22px title font.
    expect(layout.phaseLine.h).toBeGreaterThanOrEqual(26);
  });

  it('hint, confirm and cancel sit inside the bar, apart from each other and off the turn/phase line', () => {
    for (const [name, r] of Object.entries({ hint, confirm, cancel })) {
      expect(inside(r, bar), name).toBe(true);
      expect(overlaps(r, layout.phaseLine), name).toBe(false);
    }
    expect(overlaps(hint, confirm)).toBe(false);
    expect(overlaps(hint, cancel)).toBe(false);
    expect(overlaps(confirm, cancel)).toBe(false);
    // Still comfortable to tap.
    expect(confirm.h).toBeGreaterThanOrEqual(40);
    expect(cancel.h).toBeGreaterThanOrEqual(40);
  });

  it('the graveyard picker (1..12 cards) stays above the phase panel and inside the frame', () => {
    for (let n = 1; n <= 12; n++) {
      const panel = pickerPanel(n)!;
      expect(inFrame(panel), `n=${n}`).toBe(true);
      expect(overlaps(panel, layout.phase), `n=${n} panel vs phase`).toBe(false);
      for (const slot of pickerSlots(n)) {
        expect(inside(slot, panel), `n=${n}`).toBe(true);
        expect(overlaps(slot, layout.phaseLine), `n=${n}`).toBe(false);
        expect(overlaps(slot, bar), `n=${n}`).toBe(false);
      }
    }
    expect(pickerPanel(0)).toBeNull();
  });

  it('the animation caption sits in the bar under the turn / phase line, never over it (task 4.4b, debt of 4.3b)', () => {
    const { caption } = layout;
    expect(inside(caption, bar)).toBe(true);
    expect(inside(caption, layout.phase)).toBe(true);
    expect(overlaps(caption, layout.phaseLine)).toBe(false);
    // Room for one line of the label font, and wide enough for the longest log sentence.
    expect(caption.h).toBeGreaterThanOrEqual(36);
    expect(caption.w).toBeGreaterThanOrEqual(640);
    // Centred on the board.
    expect(caption.x + caption.w / 2).toBe(theme.frame.width / 2);
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
