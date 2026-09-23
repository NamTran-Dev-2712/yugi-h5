import { EngineError } from './errors.js';
import { applyChangePosition } from './actions/handlers/change-position.js';
import { applyDeclareAttack } from './actions/handlers/declare-attack.js';
import { applyDraw } from './actions/handlers/draw.js';
import { applyEndPhase } from './actions/handlers/end-phase.js';
import { applyNormalSummon, applySetMonster } from './actions/handlers/summon.js';
import { applyResolvePendingPrompt } from './actions/handlers/resolve-pending-prompt.js';
import { applyStartDuel } from './actions/handlers/start-duel.js';
import { applySurrender } from './actions/handlers/surrender.js';
import type {
  Action,
  ActionContext,
  ChangePositionAction,
  DrawAction,
  EndPhaseAction,
  ResolvePendingPromptAction,
  StartDuelAction,
  SurrenderAction,
} from './actions/types.js';
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
  action:
    | StartDuelAction
    | DrawAction
    | EndPhaseAction
    | ChangePositionAction
    | SurrenderAction
    | ResolvePendingPromptAction,
  ctx?: ActionContext,
): ApplyActionResult;
export function applyAction(
  state: GameState | null,
  action: Action,
  ctx: ActionContext,
): ApplyActionResult;
export function applyAction(
  state: GameState | null,
  action: Action,
  ctx?: ActionContext,
): ApplyActionResult {
  if (action.type === 'StartDuel') {
    return applyStartDuel(action);
  }

  if (!state) {
    throw new EngineError(
      'NO_STATE',
      `Action "${action.type}" requires an existing GameState (call StartDuel first).`,
    );
  }

  switch (action.type) {
    case 'Draw':
      return applyDraw(state, action);
    case 'EndPhase':
      return applyEndPhase(state, action);
    case 'ChangePosition':
      return applyChangePosition(state, action);
    case 'ResolvePendingPrompt':
      return applyResolvePendingPrompt(state, action);
    case 'Surrender':
      return applySurrender(state, action);
    case 'NormalSummon':
      return applyNormalSummon(state, action, requireContext(action, ctx));
    case 'SetMonster':
      return applySetMonster(state, action, requireContext(action, ctx));
    case 'DeclareAttack':
      return applyDeclareAttack(state, action, requireContext(action, ctx));
    default: {
      const exhaustiveCheck: never = action;
      throw new EngineError(
        'UNHANDLED_ACTION',
        `Unhandled action type: ${JSON.stringify(exhaustiveCheck)}`,
      );
    }
  }
}

/** Overloads make `ctx` mandatory in types for card-reading actions; this guards untyped (JS/cast) callers. */
function requireContext(action: Action, ctx: ActionContext | undefined): ActionContext {
  if (!ctx) {
    throw new EngineError(
      'NO_CARD_RESOLVER',
      `Action "${action.type}" needs an ActionContext with cardDefinitions.`,
    );
  }
  return ctx;
}
