import type { MonsterCardDefinition } from '@yugi/shared';
import { EngineError, type EngineErrorCode } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type { CardInstance, CardPosition, GameState, PlayerState } from '../../state/types.js';
import type { ActionContext, NormalSummonAction, SetMonsterAction } from '../types.js';

/** Tributes required to Normal Summon/Set a monster of this Level [RULE]: 1-4 → 0, 5-6 → 1, 7+ → 2. */
function requiredTributes(level: number): number {
  if (level >= 7) return 2;
  if (level >= 5) return 1;
  return 0;
}

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
  const tributeInstanceIds = payload.tributeInstanceIds ?? [];
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
  const required = requiredTributes(definition.level);
  if (tributeInstanceIds.length !== required) {
    reject(
      'TRIBUTE_COUNT_MISMATCH',
      `level ${definition.level} monsters need exactly ${required} Tribute(s), got ${tributeInstanceIds.length}.`,
    );
  }
  const tributed = tributeInstanceIds.map((id, i) => {
    const zone = player.board.monsterZones.findIndex((c) => c?.instanceId === id);
    if (zone === -1) {
      return reject('INVALID_TRIBUTE', `${id} is not a monster on your field.`);
    }
    if (tributeInstanceIds.indexOf(id) !== i) {
      return reject('INVALID_TRIBUTE', `${id} is listed more than once.`);
    }
    return { card: player.board.monsterZones[zone] as CardInstance, zone };
  });
  const freedZones = new Set(tributed.map((t) => t.zone));
  if (player.board.monsterZones[zoneIndex] !== null && !freedZones.has(zoneIndex)) {
    reject('ZONE_OCCUPIED', `monster zone ${zoneIndex} is occupied.`);
  }

  // Built fresh (not `...card`) so marks from an earlier stay on the field never carry over.
  const placed: CardInstance = {
    instanceId: card.instanceId,
    definitionId: card.definitionId,
    ownerIndex: card.ownerIndex,
    position,
    summonedTurn: state.turnCount,
  };
  const monsterZones = player.board.monsterZones.map((slot, i) => {
    if (i === zoneIndex) return placed;
    return freedZones.has(i) ? null : slot;
  }) as unknown as PlayerState['board']['monsterZones'];
  const nextPlayer: PlayerState = {
    ...player,
    hand: player.hand.filter((c) => c.instanceId !== cardInstanceId),
    graveyard: [...player.graveyard, ...tributed.map((t) => ({ ...t.card, position: null }))],
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

  const tributeEvents: GameEvent[] = tributed.map((t) => ({
    type: 'MonsterTributed',
    ownerIndex: playerIndex,
    instanceId: t.card.instanceId,
    definitionId: t.card.definitionId,
    zoneIndex: t.zone,
  }));

  return {
    state: { ...state, players, version: state.version + 1 },
    events: [...tributeEvents, event],
  };
}

export function resolveMonster(
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
    return reject('NOT_A_MONSTER', `"${definition.name.en}" is not a Monster card.`);
  return definition;
}
