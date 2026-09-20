import type { GameState, PlayerState } from '../../state/types.js';
import type { GameEvent } from '../../events/types.js';
import type { DrawAction } from '../types.js';

export function applyDraw(
  state: GameState,
  action: DrawAction,
): { state: GameState; events: GameEvent[] } {
  const { playerIndex, count } = action.payload;
  const player = state.players[playerIndex];
  const events: GameEvent[] = [];

  if (player.deck.length < count) {
    events.push({ type: 'DeckOut', playerIndex });
    const nextState: GameState = {
      ...state,
      winnerIndex: (playerIndex === 0 ? 1 : 0) as 0 | 1,
      version: state.version + 1,
    };
    return { state: nextState, events };
  }

  const drawn = player.deck.slice(0, count);
  const remainingDeck = player.deck.slice(count);

  for (const card of drawn) {
    events.push({
      type: 'CardDrawn',
      playerIndex,
      instanceId: card.instanceId,
      definitionId: card.definitionId,
    });
  }

  const nextPlayer: PlayerState = {
    ...player,
    deck: remainingDeck,
    hand: [...player.hand, ...drawn],
  };

  const nextPlayers: [PlayerState, PlayerState] =
    playerIndex === 0 ? [nextPlayer, state.players[1]] : [state.players[0], nextPlayer];

  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    version: state.version + 1,
  };

  return { state: nextState, events };
}
