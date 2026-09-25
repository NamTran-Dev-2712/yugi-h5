import type { PlayerState } from '../../state/types.js';
import { sideIndex } from '../filter.js';
import type { OperationHandler } from './types.js';

export const applyHeal: OperationHandler<'Heal'> = (state, op, ctx) => {
  const playerIndex = sideIndex(ctx.controller, op.target);
  const player = state.players[playerIndex];
  const next: PlayerState = { ...player, lifePoints: player.lifePoints + op.amount };
  const players: [PlayerState, PlayerState] =
    playerIndex === 0 ? [next, state.players[1]] : [state.players[0], next];
  return {
    state: { ...state, players },
    events: [{ type: 'LifePointsRecovered', playerIndex, amount: op.amount }],
  };
};
