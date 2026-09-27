import { resolveAttack } from '../../battle/resolve-attack.js';
import { resolveMonster } from '../../cards/resolve-monster.js';
import { openReactionWindow } from '../../effects/chain.js';
import { EngineError, type EngineErrorCode } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type { CardInstance, GameState } from '../../state/types.js';
import type { ActionContext, DeclareAttackAction } from '../types.js';
import { hasLegalActivation } from './activate-effect.js';

type Result = { state: GameState; events: GameEvent[] };

export function applyDeclareAttack(
  state: GameState,
  action: DeclareAttackAction,
  ctx: ActionContext,
): Result {
  const { playerIndex, attackerInstanceId, targetInstanceId } = action.payload;
  const reject = (code: EngineErrorCode, reason: string): never => {
    throw new EngineError(code, `DeclareAttack rejected: ${reason}`);
  };

  if (state.winnerIndex !== null) reject('DUEL_ENDED', 'the duel has already ended.');
  if (state.pendingPrompt !== null) reject('PENDING_PROMPT', 'a prompt is pending.');
  if (playerIndex !== state.turnPlayerIndex)
    reject('NOT_TURN_PLAYER', 'only the turn player may act.');
  if (state.phase !== 'Battle') {
    reject('WRONG_PHASE', `only allowed in the Battle Phase (current phase: ${state.phase}).`);
  }
  if (state.turnCount === 1 && !state.ruleset.firstTurnAttack) {
    reject('FIRST_TURN_ATTACK_BANNED', 'the first player cannot attack on turn 1.');
  }

  const opponentIndex = (playerIndex === 0 ? 1 : 0) as 0 | 1;
  const attackingPlayer = state.players[playerIndex];
  const opponent = state.players[opponentIndex];

  const attackerZone = attackingPlayer.board.monsterZones.findIndex(
    (c) => c?.instanceId === attackerInstanceId,
  );
  if (attackerZone === -1) {
    if (attackingPlayer.board.spellTrapZones.some((c) => c?.instanceId === attackerInstanceId)) {
      reject('NOT_A_MONSTER', `${attackerInstanceId} is not a monster.`);
    }
    reject('CARD_NOT_ON_FIELD', `${attackerInstanceId} is not a monster on your field.`);
  }
  const attacker = attackingPlayer.board.monsterZones[attackerZone] as CardInstance;

  if (attacker.position === 'DefenseDown') {
    reject('MONSTER_FACE_DOWN', 'a face-down monster cannot attack.');
  }
  if (attacker.position === 'DefenseUp') {
    reject('ATTACKER_IN_DEFENSE_POSITION', 'a monster in Defense Position cannot attack.');
  }
  if (attacker.attackedTurn === state.turnCount) {
    reject('ATTACKED_THIS_TURN', 'this monster already attacked this turn.');
  }
  if (attacker.summonedTurn === state.turnCount) {
    reject('JUST_SUMMONED_CANNOT_ATTACK', 'a monster Summoned or Set this turn cannot attack.');
  }

  // Validates that the attacker is a Monster card (rejects otherwise); damage calc happens in resolveAttack.
  resolveMonster(attacker, ctx, reject);

  if (targetInstanceId != null) {
    if (!opponent.board.monsterZones.some((c) => c?.instanceId === targetInstanceId)) {
      reject('INVALID_TARGET', `${targetInstanceId} is not a monster on the opponent's field.`);
    }
  } else if (opponent.board.monsterZones.some((c) => c !== null)) {
    reject('MUST_TARGET_MONSTER', 'the opponent has a monster; you must attack it directly.');
  }

  const declared = {
    playerIndex,
    attackerInstanceId,
    targetInstanceId: targetInstanceId ?? null,
  } as const;
  const events: GameEvent[] = [{ type: 'AttackDeclared', ...declared }];

  // Task 3.4c: the opponent may respond before damage, but only if they can activate something [ASSUMED].
  const window = openReactionWindow(
    state,
    opponentIndex,
    { kind: 'Attack', ...declared },
    (s, seat) => hasLegalActivation(s, seat, ctx),
  );
  if (window !== null) return { state: { ...window, version: state.version + 1 }, events };

  const resolved = resolveAttack(state, declared, ctx);
  return {
    state: { ...resolved.state, version: state.version + 1 },
    events: [...events, ...resolved.events],
  };
}
