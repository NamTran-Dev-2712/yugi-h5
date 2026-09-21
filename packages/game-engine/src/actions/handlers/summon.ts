import type { MonsterCardDefinition } from '@yugi/shared';
import { EngineError, type EngineErrorCode } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type { CardInstance, CardPosition, GameState, PlayerState } from '../../state/types.js';
import type { ActionContext, NormalSummonAction, SetMonsterAction } from '../types.js';

/** Highest Level a monster can have to be Normal Summoned/Set without Tribute. */
const MAX_LEVEL_WITHOUT_TRIBUTE = 4;

type Payload = NormalSummonAction['payload'];
type Result = { state: GameState; events: GameEvent[] };

export function applyNormalSummon(
  state: GameState,
  action: NormalSummonAction,
  ctx: ActionContext,
): Result {
  return placeMonsterFromHand(state, 'NormalSummon', action.payload, ctx, 'Attack');
}

export function applySetMonster(
  state: GameState,
  action: SetMonsterAction,
  ctx: ActionContext,
): Result {
  return placeMonsterFromHand(state, 'SetMonster', action.payload, ctx, 'DefenseDown');
}

function placeMonsterFromHand(
  state: GameState,
  actionName: string,
  payload: Payload,
  ctx: ActionContext,
  position: Extract<CardPosition, 'Attack' | 'DefenseDown'>,
): Result {
  const { playerIndex, cardInstanceId, zoneIndex } = payload;
  const reject = (code: EngineErrorCode, reason: string): never => {
    throw new EngineError(code, `${actionName} rejected: ${reason}`);
  };

  if (state.winnerIndex !== null) reject('DUEL_ENDED', 'the duel has already ended.');
  if (state.pendingPrompt !== null) reject('PENDING_PROMPT', 'a prompt is pending.');
  if (playerIndex !== state.turnPlayerIndex)
    reject('NOT_TURN_PLAYER', 'only the turn player may act.');
  if (state.phase !== 'Main1' && state.phase !== 'Main2') {
    reject('WRONG_PHASE', `only allowed in a Main Phase (current phase: ${state.phase}).`);
  }
  const player = state.players[playerIndex];
  if (player.hasNormalSummonedThisTurn) {
    reject('NORMAL_SUMMON_USED', 'a Normal Summon or Set was already used this turn.');
  }
  if (!Number.isInteger(zoneIndex) || zoneIndex < 0 || zoneIndex > 4) {
    reject('INVALID_ZONE', `zoneIndex must be an integer from 0 to 4 (got ${zoneIndex}).`);
  }

  const card = player.hand.find((c) => c.instanceId === cardInstanceId);
  if (!card) return reject('CARD_NOT_IN_HAND', `card ${cardInstanceId} is not in your hand.`);

  const definition = resolveMonster(card, ctx, reject);
  if (definition.level > MAX_LEVEL_WITHOUT_TRIBUTE) {
    reject(
      'LEVEL_NEEDS_TRIBUTE',
      `level ${definition.level} monsters need a Tribute (Tribute Summon is not supported yet).`,
    );
  }
  if (player.board.monsterZones[zoneIndex] !== null) {
    reject('ZONE_OCCUPIED', `monster zone ${zoneIndex} is occupied.`);
  }

  const placed: CardInstance = { ...card, position };
  const monsterZones = player.board.monsterZones.map((slot, i) =>
    i === zoneIndex ? placed : slot,
  ) as unknown as PlayerState['board']['monsterZones'];
  const nextPlayer: PlayerState = {
    ...player,
    hand: player.hand.filter((c) => c.instanceId !== cardInstanceId),
    board: { ...player.board, monsterZones },
    hasNormalSummonedThisTurn: true,
  };
  const players: [PlayerState, PlayerState] =
    playerIndex === 0 ? [nextPlayer, state.players[1]] : [state.players[0], nextPlayer];

  const event: GameEvent =
    position === 'Attack'
      ? {
          type: 'NormalSummoned',
          playerIndex,
          instanceId: card.instanceId,
          definitionId: card.definitionId,
          zoneIndex,
        }
      : { type: 'MonsterSet', playerIndex, instanceId: card.instanceId, zoneIndex };

  return { state: { ...state, players, version: state.version + 1 }, events: [event] };
}

function resolveMonster(
  card: CardInstance,
  ctx: ActionContext,
  reject: (code: EngineErrorCode, reason: string) => never,
): MonsterCardDefinition {
  if (!ctx.cardDefinitions)
    return reject('NO_CARD_RESOLVER', 'no card definition resolver was provided.');
  const definition = ctx.cardDefinitions(card.definitionId);
  if (!definition)
    return reject(
      'CARD_DEFINITION_NOT_FOUND',
      `card definition "${card.definitionId}" was not found.`,
    );
  if (definition.kind !== 'Monster')
    return reject('NOT_A_MONSTER', `"${definition.name}" is not a Monster card.`);
  return definition;
}
