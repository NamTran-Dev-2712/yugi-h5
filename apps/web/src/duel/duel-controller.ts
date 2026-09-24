import type { EventView, PlayerAction, StateView, ViewResponse } from '@yugi/shared';
import type { DuelApi } from '../api/duel-api';
import { shouldContinueEndTurn } from '../debug/build-actions';
import { formatApiError, logLinesFor } from '../debug/debug-state';
import { describeAiAction } from '../debug/describe-ai-action';
import { describeEvent } from '../debug/describe-event';
import { instanceLabelIn } from './labels';
import type { ButtonId, CardLookup } from './presenter';

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
  /** A request is in flight; input is ignored meanwhile. */
  readonly busy: boolean;
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
  busy: false,
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
  /** Sends an action the presenter attached to a clicked card (already taken from `legalActions`). */
  submit(action: PlayerAction): Promise<void>;
}

export interface DuelControllerDeps {
  /** Absent for fixtures: they show a fixed view and can send nothing. */
  readonly api?: DuelApi;
  readonly lookup: CardLookup;
}

export function createDuelController({ api, lookup }: DuelControllerDeps): DuelController {
  let state: DuelUiState = initialUiState;
  const listeners = new Set<(s: DuelUiState) => void>();

  const set = (patch: Partial<DuelUiState>): void => {
    state = { ...state, ...patch };
    for (const l of listeners) l(state);
  };
  const addLog = (lines: readonly string[]): readonly string[] =>
    [...state.log, ...lines].slice(-MAX_LOG_LINES);

  const describeAll = (events: readonly EventView[], view: StateView): string[] =>
    events.map((e) =>
      describeEvent(e, {
        cardName: (id) => lookup(id)?.name ?? id,
        instanceLabel: (id) => instanceLabelIn(view, id, lookup),
      }),
    );
  const describeAi = (action: PlayerAction, view: StateView): string =>
    describeAiAction(action, { instanceLabel: (id) => instanceLabelIn(view, id, lookup) });

  const applyResponse = (response: ViewResponse, patch: Partial<DuelUiState> = {}): void => {
    set({
      view: response.view,
      legalActions: response.legalActions,
      log: addLog(logLinesFor(response, describeAll, describeAi)),
      error: null,
      ...patch,
    });
  };

  async function sendOne(action: PlayerAction): Promise<boolean> {
    const { duelId, view } = state;
    if (api === undefined || duelId === null || view === null) return false;
    try {
      applyResponse(await api.submitAction(duelId, view.viewerIndex, action));
      return true;
    } catch (err) {
      const text = formatApiError(err);
      set({ error: text, log: addLog([`✗ ${text.replace(/\n/g, ' | ')}`]) });
      return false;
    }
  }

  async function run(action: PlayerAction, isTurnPass: boolean): Promise<void> {
    if (state.busy) return;
    set({
      busy: true,
      thinking: isTurnPass,
      surrenderArmed: action.type === 'Surrender' ? state.surrenderArmed : false,
    });
    try {
      await sendOne(action);
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
        if (!(await sendOne(action))) break;
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
        applyResponse(res, { duelId: res.duelId });
      } catch (err) {
        set({ error: formatApiError(err), log: addLog([`✗ ${formatApiError(err)}`]) });
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
    async submit(action) {
      if (!state.view) return;
      // Only ever send what the server lists (defence against a stale click target).
      const listed = state.legalActions.some((a) => JSON.stringify(a) === JSON.stringify(action));
      if (!listed) return;
      await run(action, false);
    },
  };
}
