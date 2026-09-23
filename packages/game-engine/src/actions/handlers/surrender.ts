import { EngineError } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type { GameState } from '../../state/types.js';
import type { SurrenderAction } from '../types.js';

/**
 * Either player may concede at any time (any phase, any turn, even with a prompt pending); the
 * opponent wins. Guards: the duel is still running, and the ruleset allows surrender (G11).
 */
export function applySurrender(
  state: GameState,
  action: SurrenderAction,
): { state: GameState; events: GameEvent[] } {
  if (state.winnerIndex !== null) {
    throw new EngineError('DUEL_ENDED', 'Surrender rejected: the duel has already ended.');
  }
  if (!state.ruleset.allowSurrender) {
    throw new EngineError('SURRENDER_DISABLED', 'Surrender rejected: the ruleset disallows it.');
  }

  const winnerIndex = action.payload.playerIndex === 0 ? 1 : 0;
  return {
    state: { ...state, winnerIndex, version: state.version + 1 },
    events: [{ type: 'DuelEnded', winnerIndex, reason: 'SURRENDER' }],
  };
}
