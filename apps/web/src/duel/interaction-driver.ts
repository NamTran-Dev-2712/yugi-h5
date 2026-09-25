import type { DuelController, DuelUiState } from './duel-controller';
import {
  initialInteraction,
  overlayFor,
  reduce,
  type InteractionContext,
  type InteractionEffect,
  type InteractionEvent,
  type InteractionState,
  type OverlayModel,
} from './interaction';
import { computeLayout, hitTest, type BoardLayout } from './layout';
import { present, type ButtonId, type CardLookup, type RenderModel } from './presenter';

/**
 * Glue between the pure interaction machine and a DuelController: it feeds pointer events to the machine, turns a
 * `send` effect into `controller.submit` and reports the server's answer back (serverOk / serverRejected). No Phaser,
 * no rules. The board is whatever the controller last got from the server; a refusal leaves it untouched.
 */

export interface Toast {
  readonly text: string;
  /** Increases with every toast, so the scene can tell a new one from a repeat of the same text. */
  readonly seq: number;
}

export interface InteractionDriver {
  getState(): InteractionState;
  getContext(): InteractionContext | null;
  getOverlay(): OverlayModel | null;
  getToast(): Toast | null;
  /** Called whenever the interaction state, the toast or the controller's view changes. */
  subscribe(listener: () => void): () => void;
  /** Feeds an event; resolves once any request it caused has settled. */
  dispatch(event: InteractionEvent): Promise<void>;
}

export interface InteractionDriverDeps {
  readonly lookup: CardLookup;
  readonly layout?: BoardLayout;
}

export function createInteractionDriver(
  controller: DuelController,
  deps: InteractionDriverDeps,
): InteractionDriver {
  const layout = deps.layout ?? computeLayout();
  let state: InteractionState = initialInteraction;
  let toast: Toast | null = null;
  let seq = 0;
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const l of listeners) l();
  };

  // The render model is rebuilt only when what it is made from changes (pointer moves are frequent).
  let cached: { s: DuelUiState; model: RenderModel } | null = null;
  function modelFor(s: DuelUiState): RenderModel | null {
    if (!s.view) return null;
    if (
      cached &&
      cached.s.view === s.view &&
      cached.s.legalActions === s.legalActions &&
      cached.s.surrenderArmed === s.surrenderArmed
    ) {
      return cached.model;
    }
    const model = present(s.view, s.legalActions, {
      lookup: deps.lookup,
      surrenderArmed: s.surrenderArmed,
      layout,
    });
    cached = { s, model };
    return model;
  }

  function getContext(): InteractionContext | null {
    const s = controller.getState();
    const model = modelFor(s);
    if (!s.view || !model) return null;
    return { view: s.view, legalActions: s.legalActions, model, layout, busy: s.busy };
  }

  function apply(event: InteractionEvent): readonly InteractionEffect[] {
    const ctx = getContext();
    if (!ctx) return [];
    const t = reduce(state, event, ctx);
    state = t.state;
    for (const e of t.effects) if (e.type === 'toast') toast = { text: e.text, seq: ++seq };
    return t.effects;
  }

  async function run(event: InteractionEvent): Promise<void> {
    let effects = apply(event);
    notify();
    for (;;) {
      const send = effects.find((e) => e.type === 'send');
      if (!send || send.type !== 'send') return;
      const result = await controller.submit(send.action);
      effects = apply(
        result.ok ? { type: 'serverOk' } : { type: 'serverRejected', message: result.message },
      );
      notify();
    }
  }

  // A new view/legalActions from the controller (our own answer, or the AI's turn) ends any half-done gesture.
  let lastView = controller.getState().view;
  let lastLegal = controller.getState().legalActions;
  controller.subscribe((s) => {
    if (s.view !== lastView || s.legalActions !== lastLegal) {
      lastView = s.view;
      lastLegal = s.legalActions;
      apply({ type: 'viewChanged' });
    }
    notify();
  });

  return {
    getState: () => state,
    getContext,
    getOverlay() {
      const ctx = getContext();
      return ctx ? overlayFor(state, ctx) : null;
    },
    getToast: () => toast,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async dispatch(event) {
      const before = state;
      await run(event);
      // A release over an enabled button while nothing else was going on = pressing that button.
      if (event.type === 'pointerUp' && before.kind === 'idle' && state.kind === 'idle') {
        const ctx = getContext();
        if (!ctx || ctx.busy) return;
        const hit = hitTest(layout, ctx.model, event.point);
        if (hit.kind === 'button') {
          await controller.press(hit.id as ButtonId);
          notify();
        }
      }
    },
  };
}
