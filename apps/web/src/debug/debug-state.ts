import type { EventView, PlayerAction, StateView, ViewResponse } from '@yugi/shared';
import { DuelApiError } from '../api/duel-api';

/** Everything the debug page shows, as plain data so the transitions can be tested without a DOM. */
export interface DebugState {
  readonly duelId: string | null;
  /** Latest view for the current viewer. Only ever replaced by a server response, never edited locally. */
  readonly view: StateView | null;
  /** What the server says the view's seat may submit now; null until the first response. Replaced together with `view`. */
  readonly legalActions: readonly PlayerAction[] | null;
  /** Human-readable log lines: events ("P0 rút 1 lá") and rejected actions ("✗ 409 ..."). */
  readonly log: readonly string[];
  /** Last error to put on screen, or null. */
  readonly error: string | null;
  /** The last successful response body, verbatim, for the Raw JSON panel. */
  readonly raw: unknown;
}

export const initialDebugState: DebugState = {
  duelId: null,
  view: null,
  legalActions: null,
  log: [],
  error: null,
  raw: null,
};

/** "409 ACTION_REJECTED / NOT_TURN_PLAYER — message" plus validation issues for a 400. */
export function formatApiError(err: unknown): string {
  if (!(err instanceof DuelApiError)) {
    return err instanceof Error ? `Lỗi: ${err.message}` : 'Lỗi không xác định';
  }
  const head = [`${err.status}`, err.code, ...(err.engineCode ? [`/ ${err.engineCode}`] : [])].join(
    ' ',
  );
  const issues = (err.issues ?? []).map((i) => `${i.path || '(root)'}: ${i.message}`);
  return [`${head} — ${err.message}`, ...issues].join('\n');
}

/**
 * A failed request changes NO game state: `view` and `raw` keep their identity, only the error text and the log
 * grow (the log is what the person reads afterwards).
 */
export function applyActionError(prev: DebugState, err: unknown): DebugState {
  const text = formatApiError(err);
  return { ...prev, error: text, log: [...prev.log, `✗ ${text.replace(/\n/g, ' | ')}`] };
}

/**
 * A successful response replaces the view; `describe` words the events against the NEW view (so cards that only
 * just became visible can be labelled).
 */
export function applyActionSuccess(
  prev: DebugState,
  response: ViewResponse,
  describe: (events: readonly EventView[], view: StateView) => readonly string[],
): DebugState {
  return {
    ...prev,
    view: response.view,
    legalActions: response.legalActions,
    error: null,
    log: [...prev.log, ...describe(response.events, response.view)],
    raw: response,
  };
}
