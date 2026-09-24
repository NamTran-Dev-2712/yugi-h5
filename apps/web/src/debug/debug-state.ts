import type {
  EventView,
  PlayerAction,
  PlayerIndex,
  SoloMode,
  StateView,
  ViewResponse,
} from '@yugi/shared';
import { DuelApiError } from '../api/duel-api';

/** Everything the debug page shows, as plain data so the transitions can be tested without a DOM. */
export interface DebugState {
  readonly duelId: string | null;
  /** Mode of the current duel; `solo-vs-ai` locks the viewer to the human seat. */
  readonly mode: SoloMode;
  /** `solo-vs-ai`: the seat the server plays (never viewable); null otherwise. */
  readonly aiSeat: PlayerIndex | null;
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
  mode: 'solo-debug',
  aiSeat: null,
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
 * Log lines for one response. Events keep the response's order; each AI action gets its own header line right
 * before the events it caused (`eventsFrom..eventsTo`). Events outside every slice are still logged, never dropped.
 */
export function logLinesFor(
  response: ViewResponse,
  describe: (events: readonly EventView[], view: StateView) => readonly string[],
  describeAi?: (action: PlayerAction, view: StateView) => string,
): string[] {
  const { events, view } = response;
  const ai = response.aiActions ?? [];
  if (ai.length === 0 || !describeAi) return [...describe(events, view)];
  const lines: string[] = [];
  let cursor = 0;
  for (const step of ai) {
    if (step.eventsFrom > cursor) {
      lines.push(...describe(events.slice(cursor, step.eventsFrom), view));
    }
    lines.push(describeAi(step.action, view));
    lines.push(...describe(events.slice(step.eventsFrom, step.eventsTo), view));
    cursor = Math.max(cursor, step.eventsTo);
  }
  if (cursor < events.length) lines.push(...describe(events.slice(cursor), view));
  return lines;
}

/**
 * A successful response replaces the view; `describe` words the events against the NEW view (so cards that only
 * just became visible can be labelled).
 */
export function applyActionSuccess(
  prev: DebugState,
  response: ViewResponse,
  describe: (events: readonly EventView[], view: StateView) => readonly string[],
  describeAi?: (action: PlayerAction, view: StateView) => string,
): DebugState {
  return {
    ...prev,
    view: response.view,
    legalActions: response.legalActions,
    error: null,
    log: [...prev.log, ...logLinesFor(response, describe, describeAi)],
    raw: response,
  };
}
