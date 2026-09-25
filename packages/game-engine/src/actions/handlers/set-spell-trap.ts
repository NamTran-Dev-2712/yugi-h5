import { EngineError, type EngineErrorCode } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type { CardInstance, GameState, PlayerState } from '../../state/types.js';
import type { ActionContext, SetSpellTrapAction } from '../types.js';

/**
 * Sets a Spell/Trap face-down (`position: 'DefenseDown'`, the StateView convention for hidden Spell/Trap) and stamps
 * `setTurn`. Not limited per turn and does not use the Normal Summon [RULE]. Field Spells belong in the Field Zone (P4).
 */
export function applySetSpellTrap(
  state: GameState,
  action: SetSpellTrapAction,
  ctx: ActionContext,
): { state: GameState; events: GameEvent[] } {
  const { playerIndex, cardInstanceId, zoneIndex } = action.payload;
  const reject = (code: EngineErrorCode, reason: string): never => {
    throw new EngineError(code, `SetSpellTrap rejected: ${reason}`);
  };

  if (state.winnerIndex !== null) reject('DUEL_ENDED', 'the duel has already ended.');
  if (state.pendingPrompt !== null) reject('PENDING_PROMPT', 'a prompt is pending.');
  if (playerIndex !== state.turnPlayerIndex)
    reject('NOT_TURN_PLAYER', 'only the turn player may act.');
  if (state.phase !== 'Main1' && state.phase !== 'Main2') {
    reject('WRONG_PHASE', `only allowed in a Main Phase (current phase: ${state.phase}).`);
  }
  if (!Number.isInteger(zoneIndex) || zoneIndex < 0 || zoneIndex > 4) {
    reject('INVALID_ZONE', `zoneIndex must be an integer from 0 to 4 (got ${zoneIndex}).`);
  }

  const player = state.players[playerIndex];
  const card = player.hand.find((c) => c.instanceId === cardInstanceId);
  if (!card) return reject('CARD_NOT_IN_HAND', `card ${cardInstanceId} is not in your hand.`);

  if (!ctx?.cardDefinitions)
    return reject('NO_CARD_RESOLVER', 'no card definition resolver was provided.');
  const definition = ctx.cardDefinitions(card.definitionId);
  if (!definition) {
    return reject(
      'CARD_DEFINITION_NOT_FOUND',
      `card definition "${card.definitionId}" was not found.`,
    );
  }
  if (definition.kind === 'Monster')
    return reject('NOT_A_SPELL_TRAP', `"${definition.name.en}" is not a Spell/Trap card.`);
  if (definition.kind === 'Spell' && definition.subType === 'Field')
    return reject('NOT_ACTIVATABLE', 'Field Spells are not supported yet.');
  if (player.board.spellTrapZones[zoneIndex] !== null)
    reject('ZONE_OCCUPIED', `Spell/Trap zone ${zoneIndex} is occupied.`);

  const placed: CardInstance = {
    instanceId: card.instanceId,
    definitionId: card.definitionId,
    ownerIndex: card.ownerIndex,
    position: 'DefenseDown',
    setTurn: state.turnCount,
  };
  const spellTrapZones = player.board.spellTrapZones.map((slot, i) =>
    i === zoneIndex ? placed : slot,
  ) as unknown as PlayerState['board']['spellTrapZones'];
  const nextPlayer: PlayerState = {
    ...player,
    hand: player.hand.filter((c) => c.instanceId !== cardInstanceId),
    board: { ...player.board, spellTrapZones },
  };
  const players: [PlayerState, PlayerState] =
    playerIndex === 0 ? [nextPlayer, state.players[1]] : [state.players[0], nextPlayer];

  return {
    state: { ...state, players, version: state.version + 1 },
    events: [{ type: 'SpellTrapSet', playerIndex, instanceId: card.instanceId, zoneIndex }],
  };
}
