import { EngineError } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type { GameState, Phase } from '../../state/types.js';
import { resetTurnFlags } from '../../state/turn-flags.js';
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
    throw new EngineError('DUEL_ENDED', 'EndPhase rejected: the duel has already ended.');
  }
  if (state.pendingPrompt !== null) {
    throw new EngineError('PENDING_PROMPT', 'EndPhase rejected: a prompt is pending.');
  }
  if (action.payload.playerIndex !== state.turnPlayerIndex) {
    throw new EngineError(
      'NOT_TURN_PLAYER',
      'EndPhase rejected: only the turn player may end the phase.',
    );
  }

  const { turnPlayerIndex, phase } = state;

  if (phase === 'End') {
    const nextTurnPlayer: 0 | 1 = turnPlayerIndex === 0 ? 1 : 0;
    const turnCount = state.turnCount + 1;
    return {
      state: {
        ...resetTurnFlags(state),
        turnCount,
        turnPlayerIndex: nextTurnPlayer,
        phase: 'Draw',
        version: state.version + 1,
      },
      events: [
        { type: 'PhaseChanged', from: 'End', to: 'Draw', turnPlayerIndex: nextTurnPlayer },
        { type: 'TurnChanged', turnCount, turnPlayerIndex: nextTurnPlayer },
      ],
    };
  }

  // Hand limit: leaving Main2 with too many cards asks the turn player which to discard [RULE]; the phase
  // advances once ResolvePendingPrompt answers (resolve-pending-prompt.ts).
  if (phase === 'Main2') {
    const hand = state.players[turnPlayerIndex].hand.length;
    if (hand > state.ruleset.handLimit) {
      return {
        state: {
          ...state,
          pendingPrompt: {
            promptId: `discard-${state.turnCount}`,
            playerIndex: turnPlayerIndex,
            kind: 'DiscardToHandLimit',
            payload: { count: hand - state.ruleset.handLimit },
          },
          version: state.version + 1,
        },
        events: [],
      };
    }
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
