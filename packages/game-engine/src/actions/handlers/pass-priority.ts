import { EngineError } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import { passPriority, settle } from '../../effects/chain.js';
import type { GameState } from '../../state/types.js';
import type { ActionContext, PassPriorityAction } from '../types.js';
import { hasLegalActivation } from './activate-effect.js';

/**
 * The priority holder gives up responding (task 3.3). Guards: DUEL_ENDED → NO_CHAIN_WINDOW → PENDING_PROMPT →
 * NOT_PRIORITY_HOLDER. The second consecutive pass resolves the whole chain; otherwise priority changes hands and the
 * new holder auto-passes if they cannot activate anything. No event for the pass itself. `version` +1.
 */
export function applyPassPriority(
  state: GameState,
  action: PassPriorityAction,
  ctx: ActionContext,
): { state: GameState; events: GameEvent[] } {
  const reject = (
    code: 'DUEL_ENDED' | 'NO_CHAIN_WINDOW' | 'PENDING_PROMPT' | 'NOT_PRIORITY_HOLDER',
    reason: string,
  ): never => {
    throw new EngineError(code, `PassPriority rejected: ${reason}`);
  };
  if (state.winnerIndex !== null) reject('DUEL_ENDED', 'the duel has already ended.');
  const window = state.chainWindow;
  if (window === null) return reject('NO_CHAIN_WINDOW', 'no chain window is open.');
  if (state.pendingPrompt !== null) reject('PENDING_PROMPT', 'a prompt is pending.');
  if (window.priorityPlayer !== action.payload.playerIndex)
    reject('NOT_PRIORITY_HOLDER', 'the other player holds priority.');

  const passed = passPriority(state, ctx);
  const settled = settle(passed.state, ctx, (s, seat) => hasLegalActivation(s, seat, ctx));
  return {
    state: { ...settled.state, version: state.version + 1 },
    events: [...passed.events, ...settled.events],
  };
}
