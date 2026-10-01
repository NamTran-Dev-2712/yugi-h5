import type { GameEvent } from '../events/types.js';
import type { GameState, PlayerState } from './types.js';

/**
 * Task 4.3 [DECISION]: each player has one Field Zone and a new Field Spell (Set or activated) replaces only its
 * controller's own. The card already there — face-up or Set — is sent to its owner's graveyard:
 * `CardSentToGraveyard {from: 'FieldZone'}`. [ASSUMED] G20: "sent", not "destroyed" (no OnDestroyed). Pure; returns the
 * SAME state object when the zone is empty.
 */
export function clearFieldZone(
  state: GameState,
  playerIndex: 0 | 1,
): { state: GameState; events: GameEvent[] } {
  const old = state.players[playerIndex].board.fieldZone;
  if (old === null) return { state, events: [] };
  const players = state.players.map((p, i): PlayerState => {
    const board = i === playerIndex ? { ...p.board, fieldZone: null } : p.board;
    const graveyard =
      i === old.ownerIndex
        ? [
            ...p.graveyard,
            // Fresh instance: no field mark (`setTurn`) follows the card to the graveyard.
            {
              instanceId: old.instanceId,
              definitionId: old.definitionId,
              ownerIndex: old.ownerIndex,
              position: null,
            },
          ]
        : p.graveyard;
    return { ...p, board, graveyard };
  }) as unknown as GameState['players'];
  return {
    state: { ...state, players },
    events: [
      {
        type: 'CardSentToGraveyard',
        ownerIndex: old.ownerIndex,
        instanceId: old.instanceId,
        definitionId: old.definitionId,
        from: 'FieldZone',
      },
    ],
  };
}
