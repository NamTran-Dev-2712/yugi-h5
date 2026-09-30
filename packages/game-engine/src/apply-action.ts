import { EngineError } from './errors.js';
import { applyChangePosition } from './actions/handlers/change-position.js';
import { applyActivateEffect } from './actions/handlers/activate-effect.js';
import { applyDeclareAttack } from './actions/handlers/declare-attack.js';
import { applySetSpellTrap } from './actions/handlers/set-spell-trap.js';
import { applyDraw } from './actions/handlers/draw.js';
import { applyEndPhase } from './actions/handlers/end-phase.js';
import { applyFlipSummon } from './actions/handlers/flip-summon.js';
import { applyNormalSummon, applySetMonster } from './actions/handlers/summon.js';
import { applyPassPriority } from './actions/handlers/pass-priority.js';
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
import { detachOrphanEquips } from './state/detach-equips.js';
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

  // While a chain window is open only chain actions (activate / pass / answer a prompt) and Surrender are allowed.
  if (
    state.chainWindow !== null &&
    state.winnerIndex === null &&
    !CHAIN_WINDOW_ACTIONS.has(action.type)
  ) {
    throw new EngineError(
      'CHAIN_WINDOW_OPEN',
      `${action.type} rejected: a chain is waiting for responses (activate or PassPriority first).`,
    );
  }

  // Task 4.2c: rules that follow from the board after every action (an Equip whose monster left the field goes to the
  // graveyard), kept ahead of a final DuelEnded.
  const result = dispatch(state, action, ctx);
  const detached = detachOrphanEquips(result.state);
  if (detached.events.length === 0) return result;
  const ended = result.events.filter((e) => e.type === 'DuelEnded');
  return {
    state: detached.state,
    events: [...result.events.filter((e) => e.type !== 'DuelEnded'), ...detached.events, ...ended],
  };
}

function dispatch(
  state: GameState,
  action: Exclude<Action, StartDuelAction>,
  ctx: ActionContext | undefined,
): ApplyActionResult {
  switch (action.type) {
    case 'Draw':
      return applyDraw(state, action);
    case 'EndPhase':
      return applyEndPhase(state, action);
    case 'ChangePosition':
      return applyChangePosition(state, action);
    case 'ResolvePendingPrompt':
      return applyResolvePendingPrompt(state, action, ctx);
    case 'Surrender':
      return applySurrender(state, action);
    case 'NormalSummon':
      return applyNormalSummon(state, action, requireContext(action, ctx));
    case 'SetMonster':
      return applySetMonster(state, action, requireContext(action, ctx));
    case 'FlipSummon':
      return applyFlipSummon(state, action, requireContext(action, ctx));
    case 'DeclareAttack':
      return applyDeclareAttack(state, action, requireContext(action, ctx));
    case 'SetSpellTrap':
      return applySetSpellTrap(state, action, requireContext(action, ctx));
    case 'ActivateEffect':
      return applyActivateEffect(state, action, requireContext(action, ctx));
    case 'PassPriority':
      return applyPassPriority(state, action, requireContext(action, ctx));
    default: {
      const exhaustiveCheck: never = action;
      throw new EngineError(
        'UNHANDLED_ACTION',
        `Unhandled action type: ${JSON.stringify(exhaustiveCheck)}`,
      );
    }
  }
}

const CHAIN_WINDOW_ACTIONS: ReadonlySet<Action['type']> = new Set([
  'ActivateEffect',
  'PassPriority',
  'ResolvePendingPrompt',
  'Surrender',
]);

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
