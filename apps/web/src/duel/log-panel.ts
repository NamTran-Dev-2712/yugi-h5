import { pointInRect, type BoardLayout, type Point, type Rect } from './layout';
import { ALL_CATEGORIES, type LogCategory } from './log-entries';

/**
 * State of the log panel in the DuelScene (pure, no Phaser): shown/hidden and which categories pass the filter.
 * It is a per-viewer convenience kept on the client (localStorage when available) and never sent to the server.
 */
export interface LogPanelState {
  readonly visible: boolean;
  readonly enabled: ReadonlySet<LogCategory>;
}

export type LogPanelAction =
  | { readonly type: 'toggleVisible' }
  | { readonly type: 'toggleCategory'; readonly category: LogCategory }
  | { readonly type: 'showAll' };

export const defaultLogPanel = (): LogPanelState => ({
  visible: true,
  enabled: new Set(ALL_CATEGORIES),
});

export function reduceLogPanel(state: LogPanelState, action: LogPanelAction): LogPanelState {
  switch (action.type) {
    case 'toggleVisible':
      return { ...state, visible: !state.visible };
    case 'toggleCategory': {
      const enabled = new Set(state.enabled);
      if (enabled.has(action.category)) enabled.delete(action.category);
      else enabled.add(action.category);
      return { ...state, enabled };
    }
    case 'showAll':
      return { ...state, enabled: new Set(ALL_CATEGORIES) };
  }
}

const HEADER_H = 24;
const CHIP_H = 22;
const GAP = 4;
const TOGGLE_W = 44;

export interface LogPanelRects {
  /** Whole header band (title + chips): drawn opaque so text scrolled under it stays readable. */
  readonly header: Rect;
  /** The collapse button while shown and the tab that remains while hidden: same spot, top-right of the column. */
  readonly toggleButton: Rect;
  readonly toggleTab: Rect;
  readonly showAll: Rect;
  readonly chips: Readonly<Record<LogCategory, Rect>>;
}

/** Everything derives from `layout.log`; the column stays right of the board, above the action buttons. */
export function logPanelRects(layout: BoardLayout): LogPanelRects {
  const { x, y, w } = layout.log;
  const toggle: Rect = { x: x + w - TOGGLE_W, y, w: TOGGLE_W, h: HEADER_H };
  const chipY = y + HEADER_H + GAP;
  const count = ALL_CATEGORIES.length + 1;
  const chipW = Math.floor((w - GAP * (count - 1)) / count);
  const at = (i: number): Rect => ({ x: x + i * (chipW + GAP), y: chipY, w: chipW, h: CHIP_H });
  const chips = Object.fromEntries(ALL_CATEGORIES.map((c, i) => [c, at(i + 1)])) as Record<
    LogCategory,
    Rect
  >;
  return {
    header: { x, y, w, h: HEADER_H + GAP + CHIP_H + GAP },
    toggleButton: toggle,
    toggleTab: toggle,
    showAll: at(0),
    chips,
  };
}

/** The panel action under `p`, or null when the point is not on one of its controls (then it belongs to the board). */
export function logHitTest(
  layout: BoardLayout,
  state: LogPanelState,
  p: Point,
): LogPanelAction | null {
  const r = logPanelRects(layout);
  if (!state.visible) return pointInRect(r.toggleTab, p) ? { type: 'toggleVisible' } : null;
  if (pointInRect(r.toggleButton, p)) return { type: 'toggleVisible' };
  if (pointInRect(r.showAll, p)) return { type: 'showAll' };
  for (const category of ALL_CATEGORIES) {
    if (pointInRect(r.chips[category], p)) return { type: 'toggleCategory', category };
  }
  return null;
}

/** The slice of `Storage` we use; may be absent, blocked or throwing (private window, cleared data). */
export interface LogStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'yugi.logPanel';

const isCategory = (v: unknown): v is LogCategory =>
  typeof v === 'string' && (ALL_CATEGORIES as readonly string[]).includes(v);

export function loadLogPanel(storage: LogStorage | null): LogPanelState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return defaultLogPanel();
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return defaultLogPanel();
    const { visible, enabled } = data as { visible?: unknown; enabled?: unknown };
    if (typeof visible !== 'boolean' || !Array.isArray(enabled) || !enabled.every(isCategory)) {
      return defaultLogPanel();
    }
    return { visible, enabled: new Set(enabled) };
  } catch {
    return defaultLogPanel();
  }
}

export function saveLogPanel(storage: LogStorage | null, state: LogPanelState): void {
  try {
    storage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ visible: state.visible, enabled: [...state.enabled] }),
    );
  } catch {
    // persistence is only a convenience
  }
}
