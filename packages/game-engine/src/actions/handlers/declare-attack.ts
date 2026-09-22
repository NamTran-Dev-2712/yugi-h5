import { EngineError, type EngineErrorCode } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type { CardInstance, GameState, PlayerState } from '../../state/types.js';
import type { ActionContext, DeclareAttackAction } from '../types.js';
import { resolveMonster } from './summon.js';

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

  const attackerDef = resolveMonster(attacker, ctx, reject);

  let targetZone = -1;
  let target: CardInstance | null = null;
  if (targetInstanceId != null) {
    targetZone = opponent.board.monsterZones.findIndex((c) => c?.instanceId === targetInstanceId);
    if (targetZone === -1) {
      reject('INVALID_TARGET', `${targetInstanceId} is not a monster on the opponent's field.`);
    }
    target = opponent.board.monsterZones[targetZone] as CardInstance;
    if (target.position === 'DefenseDown') {
      reject('TARGET_FACE_DOWN', 'a face-down monster cannot be declared as an attack target.');
    }
  } else if (opponent.board.monsterZones.some((c) => c !== null)) {
    reject('MUST_TARGET_MONSTER', 'the opponent has a monster; you must attack it directly.');
  }

  // Per-side accumulators, since attacker and target usually live on opposite sides.
  let nextAttackingPlayer = attackingPlayer;
  let nextOpponent = opponent;
  const events: GameEvent[] = [
    {
      type: 'AttackDeclared',
      playerIndex,
      attackerInstanceId,
      targetInstanceId: target?.instanceId ?? null,
    },
  ];

  const destroy = (
    owner: PlayerState,
    ownerIndex: 0 | 1,
    card: CardInstance,
    zoneIndex: number,
    definitionId: string,
  ): PlayerState => {
    const monsterZones = owner.board.monsterZones.map((slot, i) =>
      i === zoneIndex ? null : slot,
    ) as unknown as PlayerState['board']['monsterZones'];
    events.push({
      type: 'MonsterDestroyed',
      ownerIndex,
      instanceId: card.instanceId,
      definitionId,
      zoneIndex,
    });
    return {
      ...owner,
      board: { ...owner.board, monsterZones },
      graveyard: [...owner.graveyard, { ...card, position: null }],
    };
  };

  const damage = (recipient: PlayerState, recipientIndex: 0 | 1, amount: number): PlayerState => {
    events.push({ type: 'DamageDealt', playerIndex: recipientIndex, amount });
    return { ...recipient, lifePoints: Math.max(0, recipient.lifePoints - amount) };
  };

  const surviveAttacker = (): void => {
    const attacked: CardInstance = { ...attacker, attackedTurn: state.turnCount };
    const monsterZones = attackingPlayer.board.monsterZones.map((slot, i) =>
      i === attackerZone ? attacked : slot,
    ) as unknown as PlayerState['board']['monsterZones'];
    nextAttackingPlayer = {
      ...nextAttackingPlayer,
      board: { ...nextAttackingPlayer.board, monsterZones },
    };
  };

  if (target === null) {
    // Direct attack.
    surviveAttacker();
    nextOpponent = damage(nextOpponent, opponentIndex, attackerDef.atk);
  } else if (target.position === 'Attack') {
    const targetDef = resolveMonster(target, ctx, reject);
    if (attackerDef.atk > targetDef.atk) {
      nextOpponent = destroy(nextOpponent, opponentIndex, target, targetZone, target.definitionId);
      nextOpponent = damage(nextOpponent, opponentIndex, attackerDef.atk - targetDef.atk);
      surviveAttacker();
    } else if (attackerDef.atk < targetDef.atk) {
      nextAttackingPlayer = destroy(
        nextAttackingPlayer,
        playerIndex,
        attacker,
        attackerZone,
        attacker.definitionId,
      );
      nextAttackingPlayer = damage(
        nextAttackingPlayer,
        playerIndex,
        targetDef.atk - attackerDef.atk,
      );
    } else {
      nextOpponent = destroy(nextOpponent, opponentIndex, target, targetZone, target.definitionId);
      nextAttackingPlayer = destroy(
        nextAttackingPlayer,
        playerIndex,
        attacker,
        attackerZone,
        attacker.definitionId,
      );
    }
  } else {
    // Target is in Defense Position.
    const targetDef = resolveMonster(target, ctx, reject);
    if (attackerDef.atk > targetDef.def) {
      nextOpponent = destroy(nextOpponent, opponentIndex, target, targetZone, target.definitionId);
      surviveAttacker();
    } else if (attackerDef.atk < targetDef.def) {
      surviveAttacker();
      nextAttackingPlayer = damage(
        nextAttackingPlayer,
        playerIndex,
        targetDef.def - attackerDef.atk,
      );
    } else {
      // [ASSUMED]: ATK == DEF against a Defense Position target isn't covered by
      // RULES-REVIEW-SHEET.md rows 33-34; treated as nobody destroyed, no damage.
      surviveAttacker();
    }
  }

  const players: [PlayerState, PlayerState] =
    playerIndex === 0 ? [nextAttackingPlayer, nextOpponent] : [nextOpponent, nextAttackingPlayer];

  return {
    state: { ...state, players, version: state.version + 1 },
    events,
  };
}
