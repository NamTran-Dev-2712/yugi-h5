import type { GameEvent } from '../../events/types.js';
import { checkLifePointsWinCondition } from '../../state/win-condition.js';
import type { PlayerState } from '../../state/types.js';
import { sideIndex } from '../filter.js';
import type { OperationHandler } from './types.js';

/** Effect damage: LP never goes below 0; reaching 0 ends the duel (same rule as battle damage). */
export const applyDamage: OperationHandler<'Damage'> = (state, op, ctx) => {
  const playerIndex = sideIndex(ctx.controller, op.target);
  const victim = state.players[playerIndex];
  const nextVictim: PlayerState = {
    ...victim,
    lifePoints: Math.max(0, victim.lifePoints - op.amount),
  };
  const players: [PlayerState, PlayerState] =
    playerIndex === 0 ? [nextVictim, state.players[1]] : [state.players[0], nextVictim];

  const events: GameEvent[] = [{ type: 'DamageDealt', playerIndex, amount: op.amount }];
  const ended = checkLifePointsWinCondition(players);
  if (ended) events.push(ended.event);
  return {
    state: { ...state, players, winnerIndex: ended ? ended.winnerIndex : state.winnerIndex },
    events,
  };
};
