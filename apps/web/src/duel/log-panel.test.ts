import { describe, expect, it } from 'vitest';
import { ALL_CATEGORIES, type LogCategory } from './log-entries';
import { computeLayout, pointInRect } from './layout';
import {
  defaultLogPanel,
  loadLogPanel,
  logHitTest,
  logPanelRects,
  reduceLogPanel,
  saveLogPanel,
  type LogPanelState,
  type LogStorage,
} from './log-panel';

const layout = computeLayout();
const shown = defaultLogPanel();
const hidden: LogPanelState = { ...shown, visible: false };

describe('reduceLogPanel', () => {
  it('defaults: visible, every category on', () => {
    expect(shown.visible).toBe(true);
    expect([...shown.enabled].sort()).toEqual([...ALL_CATEGORIES].sort());
  });
  it('toggleVisible flips visibility only', () => {
    const s = reduceLogPanel(shown, { type: 'toggleVisible' });
    expect(s.visible).toBe(false);
    expect(s.enabled).toEqual(shown.enabled);
    expect(reduceLogPanel(s, { type: 'toggleVisible' }).visible).toBe(true);
  });
  it('toggleCategory removes then re-adds, leaving the others', () => {
    const off = reduceLogPanel(shown, { type: 'toggleCategory', category: 'combat' });
    expect(off.enabled.has('combat')).toBe(false);
    expect(off.enabled.has('field')).toBe(true);
    expect(
      reduceLogPanel(off, { type: 'toggleCategory', category: 'combat' }).enabled.has('combat'),
    ).toBe(true);
  });
  it('showAll re-enables everything', () => {
    const off = reduceLogPanel(shown, { type: 'toggleCategory', category: 'error' });
    expect(reduceLogPanel(off, { type: 'showAll' }).enabled.size).toBe(ALL_CATEGORIES.length);
  });
  it('never mutates the previous state', () => {
    const before = [...shown.enabled];
    reduceLogPanel(shown, { type: 'toggleCategory', category: 'turn' });
    expect([...shown.enabled]).toEqual(before);
  });
});

describe('geometry', () => {
  const rects = logPanelRects(layout);
  it('chips + toggle sit inside the log column, clear of the board and of the action buttons', () => {
    const column = layout.log;
    for (const r of [
      rects.toggleTab,
      rects.toggleButton,
      rects.showAll,
      ...Object.values(rects.chips),
    ]) {
      expect(r.x).toBeGreaterThanOrEqual(column.x);
      expect(r.x + r.w).toBeLessThanOrEqual(column.x + column.w);
      expect(r.y).toBeGreaterThanOrEqual(column.y);
      expect(r.y + r.h).toBeLessThanOrEqual(column.y + column.h);
    }
    expect(column.y + column.h).toBeLessThanOrEqual(layout.buttons.nextPhase.y);
  });
  it('the chips do not overlap each other', () => {
    const list = [rects.showAll, ...Object.values(rects.chips)];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
  });
});

describe('logHitTest', () => {
  const rects = logPanelRects(layout);
  const centre = (r: { x: number; y: number; w: number; h: number }) => ({
    x: r.x + r.w / 2,
    y: r.y + r.h / 2,
  });

  it.each(ALL_CATEGORIES)('a click on the %s chip toggles that category', (category) => {
    expect(logHitTest(layout, shown, centre(rects.chips[category]))).toEqual({
      type: 'toggleCategory',
      category,
    });
  });
  it('the "all" chip shows everything', () => {
    expect(logHitTest(layout, shown, centre(rects.showAll))).toEqual({ type: 'showAll' });
  });
  it('the collapse button toggles visibility while shown', () => {
    expect(logHitTest(layout, shown, centre(rects.toggleButton))).toEqual({
      type: 'toggleVisible',
    });
  });
  it('a hidden panel keeps only its small tab; chips are dead', () => {
    expect(logHitTest(layout, hidden, centre(rects.toggleTab))).toEqual({ type: 'toggleVisible' });
    expect(logHitTest(layout, hidden, centre(rects.chips.combat))).toBeNull();
    expect(logHitTest(layout, hidden, centre(rects.showAll))).toBeNull();
  });
  it('a click on the log text area (not a control) or on the board is not the panel’s', () => {
    expect(
      logHitTest(layout, shown, { x: layout.log.x + 10, y: layout.log.y + layout.log.h - 10 }),
    ).toBeNull();
    expect(logHitTest(layout, shown, { x: 300, y: 300 })).toBeNull();
    expect(logHitTest(layout, hidden, { x: layout.log.x + 10, y: layout.log.y + 200 })).toBeNull();
  });
  it('the hidden tab lies inside the log column (right of the board)', () => {
    expect(pointInRect(layout.log, centre(rects.toggleTab))).toBe(true);
  });
});

function memoryStorage(
  initial: Record<string, string> = {},
): LogStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('persistence', () => {
  it('round-trips visibility and the filter', () => {
    const st = memoryStorage();
    const state: LogPanelState = {
      visible: false,
      enabled: new Set<LogCategory>(['combat', 'error']),
    };
    saveLogPanel(st, state);
    const back = loadLogPanel(st);
    expect(back.visible).toBe(false);
    expect([...back.enabled].sort()).toEqual(['combat', 'error']);
  });
  it('empty storage / null storage -> defaults', () => {
    expect(loadLogPanel(memoryStorage())).toEqual(defaultLogPanel());
    expect(loadLogPanel(null)).toEqual(defaultLogPanel());
  });
  it.each(['not json', '{"visible":"yes"}', '{"visible":true,"enabled":["nope"]}', '[]', 'null'])(
    'corrupt data %j -> defaults',
    (raw) => {
      expect(loadLogPanel(memoryStorage({ 'yugi.logPanel': raw }))).toEqual(defaultLogPanel());
    },
  );
  it('a storage that throws never breaks load or save', () => {
    const boom: LogStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadLogPanel(boom)).toEqual(defaultLogPanel());
    expect(() => saveLogPanel(boom, shown)).not.toThrow();
    expect(() => saveLogPanel(null, shown)).not.toThrow();
  });
});
