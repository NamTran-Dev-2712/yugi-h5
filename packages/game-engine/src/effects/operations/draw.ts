import { applyDraw } from '../../actions/handlers/draw.js';
import { sideIndex } from '../filter.js';
import type { OperationHandler } from './types.js';

/** Reuses the Draw action's logic, so deck-out (DeckOut + DuelEnded) behaves exactly like a normal draw. */
export const applyDrawOperation: OperationHandler<'Draw'> = (state, op, ctx) => {
  const playerIndex = sideIndex(ctx.controller, op.target);
  const { state: next, events } = applyDraw(state, {
    type: 'Draw',
    payload: { playerIndex, count: op.count },
  });
  return { state: next, events };
};
