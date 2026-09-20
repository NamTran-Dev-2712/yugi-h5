import type { GameEvent } from '../../events/types.js';
import type { GameState, Phase, PlayerState } from '../../state/types.js';
import type { EndPhaseAction } from '../types.js';
import { applyDraw } from './draw.js';

const NEXT_PHASE: Record<Exclude<Phase, 'End'>, Phase> = {
  Draw: 'Standby',
  Standby: 'Main1',
  Main1: 'Battle',
  Battle: 'Main2',
  Main2: 'End',
};

export function applyEndPhase(
  state: GameState,
  action: EndPhaseAction,
): { state: GameState; events: GameEvent[] } {
  if (state.winnerIndex !== null) {
    throw new Error('EndPhase rejected: the duel has already ended.');
  }
  if (state.pendingPrompt !== null) {
    throw new Error('EndPhase rejected: a prompt is pending.');
  }
  if (action.payload.playerIndex !== state.turnPlayerIndex) {
    throw new Error('EndPhase rejected: only the turn player may end the phase.');
  }

  const { turnPlayerIndex, phase } = state;

  if (phase === 'End') {
    const nextTurnPlayer: 0 | 1 = turnPlayerIndex === 0 ? 1 : 0;
    const turnCount = state.turnCount + 1;
    const resetPlayer = (p: PlayerState): PlayerState => ({
      ...p,
      hasNormalSummonedThisTurn: false,
    });
    return {
      state: {
        ...state,
        turnCount,
        turnPlayerIndex: nextTurnPlayer,
        phase: 'Draw',
        players: [resetPlayer(state.players[0]), resetPlayer(state.players[1])],
        version: state.version + 1,
      },
      events: [
        { type: 'PhaseChanged', from: 'End', to: 'Draw', turnPlayerIndex: nextTurnPlayer },
        { type: 'TurnChanged', turnCount, turnPlayerIndex: nextTurnPlayer },
      ],
    };
  }

  const events: GameEvent[] = [];
  let next = state;

  // The turn's draw happens on leaving the Draw phase (G1: skipped on turn 1 unless firstTurnDraw).
  if (phase === 'Draw' && (state.turnCount > 1 || state.ruleset.firstTurnDraw)) {
    const drawn = applyDraw(state, {
      type: 'Draw',
      payload: { playerIndex: turnPlayerIndex, count: 1 },
    });
    if (drawn.state.winnerIndex !== null) {
      return drawn; // DeckOut: duel over, phase does not advance.
    }
    next = drawn.state;
    events.push(...drawn.events);
  }

  const to = NEXT_PHASE[phase];
  events.push({ type: 'PhaseChanged', from: phase, to, turnPlayerIndex });
  return {
    state: { ...next, phase: to, version: state.version + 1 },
    events,
  };
}
