import { applyDraw } from './actions/handlers/draw.js';
import { applyEndPhase } from './actions/handlers/end-phase.js';
import { applyStartDuel } from './actions/handlers/start-duel.js';
import type { Action, ActionContext } from './actions/types.js';
import type { GameEvent } from './events/types.js';
import type { GameState } from './state/types.js';

export interface ApplyActionResult {
  readonly state: GameState;
  readonly events: GameEvent[];
}

/**
 * The engine's single public entry point. Pure and deterministic: same
 * (state, action, ctx) always produces the same (state, events) — no
 * Math.random()/Date.now()/IO. `state` is null only for `StartDuel`, which
 * creates the initial GameState.
 */
export function applyAction(
  state: GameState | null,
  action: Action,
  _ctx: ActionContext = {},
): ApplyActionResult {
  if (action.type === 'StartDuel') {
    return applyStartDuel(action);
  }

  if (!state) {
    throw new Error(
      `Action "${action.type}" requires an existing GameState (call StartDuel first).`,
    );
  }

  switch (action.type) {
    case 'Draw':
      return applyDraw(state, action);
    case 'EndPhase':
      return applyEndPhase(state, action);
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unhandled action type: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
