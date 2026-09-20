import type { GameState, PlayerState } from './types.js';

/** Clears every per-turn flag. Called when the turn passes (leaving End Phase); add new per-turn flags here. */
export function resetTurnFlags(state: GameState): GameState {
  const reset = (p: PlayerState): PlayerState => ({ ...p, hasNormalSummonedThisTurn: false });
  return { ...state, players: [reset(state.players[0]), reset(state.players[1])] };
}
