import { EngineError, type EngineErrorCode } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type { CardInstance, GameState, PlayerState } from '../../state/types.js';
import type { ChangePositionAction } from '../types.js';

export function applyChangePosition(
  state: GameState,
  action: ChangePositionAction,
): { state: GameState; events: GameEvent[] } {
  const { playerIndex, cardInstanceId, toPosition } = action.payload;
  const reject = (code: EngineErrorCode, reason: string): never => {
    throw new EngineError(code, `ChangePosition rejected: ${reason}`);
  };

  if (state.winnerIndex !== null) reject('DUEL_ENDED', 'the duel has already ended.');
  if (state.pendingPrompt !== null) reject('PENDING_PROMPT', 'a prompt is pending.');
  if (playerIndex !== state.turnPlayerIndex)
    reject('NOT_TURN_PLAYER', 'only the turn player may act.');
  if (state.phase !== 'Main1' && state.phase !== 'Main2') {
    reject('WRONG_PHASE', `only allowed in a Main Phase (current phase: ${state.phase}).`);
  }
  // Runtime guard: the type already excludes DefenseDown, but callers may be untyped.
  if (toPosition !== 'Attack' && toPosition !== 'DefenseUp') {
    reject('INVALID_POSITION', `cannot change to "${String(toPosition)}".`);
  }

  const player = state.players[playerIndex];
  const zoneIndex = player.board.monsterZones.findIndex((c) => c?.instanceId === cardInstanceId);
  if (zoneIndex === -1) {
    if (player.board.spellTrapZones.some((c) => c?.instanceId === cardInstanceId)) {
      reject('NOT_A_MONSTER', `${cardInstanceId} is not a monster.`);
    }
    reject('CARD_NOT_ON_FIELD', `${cardInstanceId} is not a monster on your field.`);
  }
  const monster = player.board.monsterZones[zoneIndex] as CardInstance;

  if (monster.position === 'DefenseDown') {
    reject('MONSTER_FACE_DOWN', 'face-down monsters cannot change position (Flip Summon instead).');
  }
  if (monster.position === toPosition) {
    reject('SAME_POSITION', `the monster is already in ${toPosition} position.`);
  }
  if (monster.positionChangedTurn === state.turnCount) {
    reject('POSITION_ALREADY_CHANGED', 'this monster already changed position this turn.');
  }
  if (monster.summonedTurn === state.turnCount) {
    reject('SUMMONED_THIS_TURN', 'a monster Summoned or Set this turn cannot change position.');
  }
  if (monster.attackedTurn === state.turnCount) {
    reject('ATTACKED_THIS_TURN', 'a monster that attacked this turn cannot change position.');
  }

  const changed: CardInstance = {
    ...monster,
    position: toPosition,
    positionChangedTurn: state.turnCount,
  };
  const monsterZones = player.board.monsterZones.map((slot, i) =>
    i === zoneIndex ? changed : slot,
  ) as unknown as PlayerState['board']['monsterZones'];
  const nextPlayer: PlayerState = { ...player, board: { ...player.board, monsterZones } };
  const players: [PlayerState, PlayerState] =
    playerIndex === 0 ? [nextPlayer, state.players[1]] : [state.players[0], nextPlayer];

  return {
    state: { ...state, players, version: state.version + 1 },
    events: [
      {
        type: 'PositionChanged',
        playerIndex,
        instanceId: monster.instanceId,
        definitionId: monster.definitionId,
        zoneIndex,
        from: monster.position as 'Attack' | 'DefenseUp',
        to: toPosition,
      },
    ],
  };
}
