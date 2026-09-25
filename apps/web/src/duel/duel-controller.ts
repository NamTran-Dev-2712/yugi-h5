import type { EventView, PlayerAction, StateView, ViewResponse } from '@yugi/shared';
import { DuelApiError, type DuelApi } from '../api/duel-api';
import { shouldContinueEndTurn } from '../debug/build-actions';
import { segmentsFor, type AnimationSegment } from './animation-queue';
import { formatApiError } from '../debug/debug-state';
import { describeAiAction } from '../debug/describe-ai-action';
import { describeEvent } from '../debug/describe-event';
import { messageFor } from './error-messages';
import { instanceLabelIn } from './labels';
import { entriesFor, errorEntry, type LogEntry } from './log-entries';
import { isListed } from './legal-index';
import type { ButtonId, CardLookup } from './presenter';
import { strings } from './strings';

/**
 * What `submit` tells the interaction layer. `sent: false` = fixture mode (nothing was sent, the state is unchanged).
 * A refusal carries a short Vietnamese sentence; the board is never touched on failure.
 */
export type SubmitResult =
  { readonly ok: true; readonly sent: boolean } | { readonly ok: false; readonly message: string };

/**
 * Glue between the server (through `DuelApi`) and the scene, with no Phaser. It holds only what the server last said
 * (view + legalActions) and what the person is doing (busy, surrender confirmation); it decides no game rules — a
 * button sends exactly an action the server listed in `legalActions`.
 */

export interface DuelUiState {
  readonly duelId: string | null;
  readonly view: StateView | null;
  /** From the server for the viewer's seat, replaced together with `view`. */
  readonly legalActions: readonly PlayerAction[];
  readonly log: readonly string[];
  /** The same lines as `log`, in the same order, with a category (for the scene's log filter). */
  readonly entries: readonly LogEntry[];
  /** A request is in flight; input is ignored meanwhile. */
  readonly busy: boolean;
  /** The events of the last response are being played; `view` is still the OLD board until they finish. */
  readonly animating: boolean;
  /** The request in flight can hand the turn to the AI ("AI đang suy nghĩ"). */
  readonly thinking: boolean;
  /** "Đầu hàng" was pressed once and waits for a second press. */
  readonly surrenderArmed: boolean;
  readonly error: string | null;
}

export const initialUiState: DuelUiState = {
  duelId: null,
  view: null,
  legalActions: [],
  log: [],
  entries: [],
  busy: false,
  animating: false,
  thinking: false,
  surrenderArmed: false,
  error: null,
};

const MAX_LOG_LINES = 200;
const MAX_END_TURN_STEPS = 12;

export interface DuelController {
  getState(): DuelUiState;
  subscribe(listener: (state: DuelUiState) => void): () => void;
  /** Creates a solo-vs-ai duel on the server and shows its first view. */
  start(): Promise<void>;
  /** Shows a fixed view without a server; nothing can be sent afterwards. */
  showFixture(view: StateView, legalActions: readonly PlayerAction[]): void;
  /** A button of the presenter's model was pressed. */
  press(id: ButtonId): Promise<void>;
  /**
   * Sends an action taken from `legalActions` (a card click, a finished drag). Anything not listed is refused here
   * and never reaches the server. Without a server (fixture) it only logs "sẽ gửi: <action>".
   */
  submit(action: PlayerAction): Promise<SubmitResult>;
  /** Cuts a running animation short (the new view shows at once). No-op when nothing plays. */
  skipAnimation(): void;
}

/** What the controller needs from the animation layer; the scene provides it (see `animation-player.ts`). */
export interface DuelAnimator {
  /** Resolves when the segments have been played or skipped. Must not reject (the controller also guards). */
  play(segments: readonly AnimationSegment[]): Promise<void>;
  skip(): void;
}

export interface DuelControllerDeps {
  /** Absent for fixtures: they show a fixed view and can send nothing. */
  readonly api?: DuelApi;
  readonly lookup: CardLookup;
  /** Absent = no animation: a response's view is applied at once (fixtures, tests, the e2e tools). */
  readonly animator?: DuelAnimator;
}

export function createDuelController({
  api,
  lookup,
  animator,
}: DuelControllerDeps): DuelController {
  let state: DuelUiState = initialUiState;
  const listeners = new Set<(s: DuelUiState) => void>();

  const set = (patch: Partial<DuelUiState>): void => {
    state = { ...state, ...patch };
    for (const l of listeners) l(state);
  };
  /** Both logs grow together; `log` is the plain text of `entries`. */
  const addLog = (entries: readonly LogEntry[]): Pick<DuelUiState, 'log' | 'entries'> => {
    const all = [...state.entries, ...entries].slice(-MAX_LOG_LINES);
    return { log: all.map((e) => e.text), entries: all };
  };

  const describeAll = (events: readonly EventView[], view: StateView): string[] =>
    events.map((e) =>
      describeEvent(e, {
        cardName: (id) => lookup(id)?.name ?? id,
        instanceLabel: (id) => instanceLabelIn(view, id, lookup),
      }),
    );
  const describeAi = (action: PlayerAction, view: StateView): string =>
    describeAiAction(action, { instanceLabel: (id) => instanceLabelIn(view, id, lookup) });

  const applyResponse = async (
    response: ViewResponse,
    patch: Partial<DuelUiState> = {},
  ): Promise<void> => {
    const log = addLog(entriesFor(response, describeAll, describeAi));
    const before = state.view;
    const segments =
      animator && before
        ? segmentsFor(
            response,
            (e) =>
              describeEvent(e, {
                cardName: (id) => lookup(id)?.name ?? id,
                // The board shown is still the old one; a card that is gone from it is looked up in the new one.
                instanceLabel: (id) => {
                  const old = instanceLabelIn(before, id, lookup);
                  return old !== id ? old : instanceLabelIn(response.view, id, lookup);
                },
              }),
            (a) => describeAi(a, response.view),
          )
        : [];
    if (animator && segments.length > 0) {
      set({ ...log, error: null, animating: true });
      try {
        await animator.play(segments);
      } catch {
        // an effect that fails must never leave the board stale or the input locked
      }
    }
    set({
      view: response.view,
      legalActions: response.legalActions,
      ...log,
      error: null,
      animating: false,
      ...patch,
    });
  };

  /** null = accepted (the state now comes from the response); otherwise the Vietnamese refusal, state untouched. */
  async function sendOne(action: PlayerAction): Promise<string | null> {
    const { duelId, view } = state;
    if (api === undefined || duelId === null || view === null) return strings.toastNotAllowed;
    try {
      await applyResponse(await api.submitAction(duelId, view.viewerIndex, action));
      return null;
    } catch (err) {
      const text = formatApiError(err);
      set({ error: text, ...addLog([errorEntry(`✗ ${text.replace(/\n/g, ' | ')}`)]) });
      return messageFor(err instanceof DuelApiError ? err : { code: 'UNKNOWN' });
    }
  }

  async function run(action: PlayerAction, isTurnPass: boolean): Promise<SubmitResult> {
    if (state.busy) return { ok: false, message: strings.toastBusy };
    set({
      busy: true,
      thinking: isTurnPass,
      surrenderArmed: action.type === 'Surrender' ? state.surrenderArmed : false,
    });
    try {
      const failure = await sendOne(action);
      return failure === null ? { ok: true, sent: true } : { ok: false, message: failure };
    } finally {
      set({ busy: false, thinking: false, surrenderArmed: false });
    }
  }

  const legal = (type: PlayerAction['type']): PlayerAction | null =>
    state.legalActions.find(
      (a) => a.type === type && a.payload.playerIndex === state.view?.viewerIndex,
    ) ?? null;

  async function endTurn(): Promise<void> {
    if (state.busy || !state.view) return;
    const startTurn = state.view.turnCount;
    set({ busy: true, thinking: true, surrenderArmed: false });
    try {
      for (let i = 0; i < MAX_END_TURN_STEPS; i++) {
        const action = legal('EndPhase');
        if (!action) break;
        if ((await sendOne(action)) !== null) break;
        if (!state.view || !shouldContinueEndTurn(startTurn, state.view)) break;
      }
    } finally {
      set({ busy: false, thinking: false });
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async start() {
      if (state.busy) return;
      set({ ...initialUiState, busy: true });
      try {
        if (!api) throw new Error('Không có API');
        await api.ensureGuest();
        const res = await api.createSolo({ mode: 'solo-vs-ai' });
        await applyResponse(res, { duelId: res.duelId });
      } catch (err) {
        set({ error: formatApiError(err), ...addLog([errorEntry(`✗ ${formatApiError(err)}`)]) });
      } finally {
        set({ busy: false });
      }
    },
    showFixture(view, legalActions) {
      set({ ...initialUiState, view, legalActions });
    },
    async press(id) {
      if (state.busy || !state.view) return;
      if (id === 'surrender') {
        const action = legal('Surrender');
        if (!action) return;
        if (!state.surrenderArmed) {
          set({ surrenderArmed: true });
          return;
        }
        await run(action, false);
        return;
      }
      if (id === 'endTurn') {
        await endTurn();
        return;
      }
      const action = legal('EndPhase');
      if (action) await run(action, true);
    },
    skipAnimation() {
      if (state.animating) animator?.skip();
    },
    async submit(action) {
      if (!state.view) return { ok: false, message: strings.toastNotAllowed };
      // Only ever send what the server lists (defence against a stale click target).
      if (!isListed(state.legalActions, action)) {
        return { ok: false, message: strings.toastNotAllowed };
      }
      if (state.busy) return { ok: false, message: strings.toastBusy };
      if (api === undefined || state.duelId === null) {
        set(
          addLog([
            {
              text: `${strings.sendPreview} ${JSON.stringify(action).replace(/,/g, ', ')}`,
              category: 'field',
            },
          ]),
        );
        return { ok: true, sent: false };
      }
      return run(action, false);
    },
  };
}
