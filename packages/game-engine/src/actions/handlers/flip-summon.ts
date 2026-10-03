import { openReactionWindow, settle } from '../../effects/chain.js';
import { fireTriggers } from '../../effects/triggers.js';
import { EngineError, type EngineErrorCode } from '../../errors.js';
import type { FlipSummonedEvent, GameEvent } from '../../events/types.js';
import type { CardInstance, GameState, PlayerState } from '../../state/types.js';
import type { ActionContext, FlipSummonAction } from '../types.js';
import { hasLegalActivation } from './activate-effect.js';

type Result = { state: GameState; events: GameEvent[] };

/**
 * Task 4.2b [RULE]: Flip Summon — the turn player turns one of their face-down monsters face-up in Attack Position, in a
 * Main Phase. Not a monster Set this turn (`summonedTurn`), not one whose position already changed this turn. Does not
 * use the Normal Summon. Stamps `positionChangedTurn` (no further position change this turn); `summonedTurn` is left as
 * it was, so a monster Set on an earlier turn may attack. Exactly like a Normal Summon (task 4.4c): the opponent first
 * gets the Summon reaction window (task 3.4c) if they can respond; the monster's OnFlip and OnSummon triggers go on the
 * chain once that window is done (never, if the Flip Summon was negated).
 */
export function applyFlipSummon(
  state: GameState,
  action: FlipSummonAction,
  ctx: ActionContext,
): Result {
  const { playerIndex, cardInstanceId } = action.payload;
  const reject = (code: EngineErrorCode, reason: string): never => {
    throw new EngineError(code, `FlipSummon rejected: ${reason}`);
  };

  if (state.winnerIndex !== null) reject('DUEL_ENDED', 'the duel has already ended.');
  if (state.pendingPrompt !== null) reject('PENDING_PROMPT', 'a prompt is pending.');
  if (playerIndex !== state.turnPlayerIndex)
    reject('NOT_TURN_PLAYER', 'only the turn player may act.');
  if (state.phase !== 'Main1' && state.phase !== 'Main2')
    reject('WRONG_PHASE', `only allowed in a Main Phase (current phase: ${state.phase}).`);

  const player = state.players[playerIndex];
  const zoneIndex = player.board.monsterZones.findIndex((c) => c?.instanceId === cardInstanceId);
  if (zoneIndex === -1) {
    if (player.board.spellTrapZones.some((c) => c?.instanceId === cardInstanceId))
      reject('NOT_A_MONSTER', `${cardInstanceId} is not a monster.`);
    reject('CARD_NOT_ON_FIELD', `${cardInstanceId} is not a monster on your field.`);
  }
  const monster = player.board.monsterZones[zoneIndex] as CardInstance;
  if (monster.position !== 'DefenseDown')
    reject('MONSTER_FACE_UP', 'only a face-down monster can be Flip Summoned.');
  if (monster.summonedTurn === state.turnCount)
    reject('SUMMONED_THIS_TURN', 'a monster Set this turn cannot be Flip Summoned.');
  if (monster.positionChangedTurn === state.turnCount)
    reject('POSITION_ALREADY_CHANGED', 'this monster already changed position this turn.');

  const flipped: CardInstance = {
    ...monster,
    position: 'Attack',
    positionChangedTurn: state.turnCount,
  };
  const monsterZones = player.board.monsterZones.map((slot, i) =>
    i === zoneIndex ? flipped : slot,
  ) as unknown as PlayerState['board']['monsterZones'];
  const nextPlayer: PlayerState = { ...player, board: { ...player.board, monsterZones } };
  const placedState: GameState = {
    ...state,
    players: playerIndex === 0 ? [nextPlayer, state.players[1]] : [state.players[0], nextPlayer],
  };
  const event: FlipSummonedEvent = {
    type: 'FlipSummoned',
    playerIndex,
    instanceId: monster.instanceId,
    definitionId: monster.definitionId,
    zoneIndex,
  };

  const opponentIndex = (playerIndex === 0 ? 1 : 0) as 0 | 1;
  const canActivate = (s: GameState, seat: 0 | 1) => hasLegalActivation(s, seat, ctx);
  // Task 4.4: a Flip Summon is a Summon — its window names the monster a NegateSummon would answer.
  const summoned = { playerIndex, instanceId: monster.instanceId };

  // Same order as a Normal Summon (summon.ts, task 4.4c): the Summon reaction window first — it keeps the event, and the
  // OnFlip / OnSummon triggers are collected once it is done; with nobody able to respond they go on the chain at once.
  const withWindow = openReactionWindow(
    placedState,
    opponentIndex,
    { kind: 'Summon' },
    canActivate,
    summoned,
    event,
  );
  if (withWindow !== null)
    return { state: { ...withWindow, version: state.version + 1 }, events: [event] };

  const fired = fireTriggers(placedState, [event], ctx);
  const settled = settle(fired.state, ctx, canActivate);
  return {
    state: { ...settled.state, version: state.version + 1 },
    events: [event, ...fired.events, ...settled.events],
  };
}
