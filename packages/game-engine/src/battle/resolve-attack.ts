import type { ActionContext } from '../actions/types.js';
import { resolveMonster } from '../cards/resolve-monster.js';
import { effectiveStats } from '../effects/continuous.js';
import { EngineError, type EngineErrorCode } from '../errors.js';
import type { GameEvent } from '../events/types.js';
import type { CardInstance, GameState, PlayerState } from '../state/types.js';
import { checkLifePointsWinCondition } from '../state/win-condition.js';

type Result = { state: GameState; events: GameEvent[] };

export interface DeclaredAttack {
  readonly playerIndex: 0 | 1;
  readonly attackerInstanceId: string;
  /** null = direct attack. */
  readonly targetInstanceId: string | null;
}

/**
 * The damage part of an attack (task 1.6–1.8 logic, moved out of `declare-attack.ts` in task 3.4c so it can also run
 * after a reaction window closes): flip a face-down target, destroy, deal damage, check LP. Does NOT bump `version`
 * and emits no `AttackDeclared` (the declaration did). When called right after a validated declaration it behaves
 * exactly as before; after a window the board may have changed, so it re-checks first [ASSUMED, no replay]:
 * - the attacker left its controller's monster zones or is no longer in Attack Position → the attack just stops;
 * - the declared target left the opponent's monster zones → the attack stops, the attacker still counts as attacked;
 * - a direct attack while the opponent now controls a monster → the attack stops (same).
 */
export function resolveAttack(
  state: GameState,
  attack: DeclaredAttack,
  ctx: ActionContext,
): Result {
  const { playerIndex, attackerInstanceId, targetInstanceId } = attack;
  const reject = (code: EngineErrorCode, reason: string): never => {
    throw new EngineError(code, `Attack resolution failed: ${reason}`);
  };

  const opponentIndex = (playerIndex === 0 ? 1 : 0) as 0 | 1;
  const attackingPlayer = state.players[playerIndex];
  const opponent = state.players[opponentIndex];

  const attackerZone = attackingPlayer.board.monsterZones.findIndex(
    (c) => c?.instanceId === attackerInstanceId,
  );
  const found = attackingPlayer.board.monsterZones[attackerZone];
  if (!found || found.position !== 'Attack') return { state, events: [] };
  const attacker: CardInstance = found;
  // Only checks the attacker is a Monster; the ATK/DEF used below are the effective ones (task 3.6).
  resolveMonster(attacker, ctx, reject);

  const events: GameEvent[] = [];
  // Per-side accumulators, since attacker and target usually live on opposite sides.
  let nextAttackingPlayer = attackingPlayer;
  let nextOpponent = opponent;

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
  const withPlayers = (): GameState => ({
    ...state,
    players:
      playerIndex === 0 ? [nextAttackingPlayer, nextOpponent] : [nextOpponent, nextAttackingPlayer],
  });

  let targetZone = -1;
  let target: CardInstance | null = null;
  if (targetInstanceId !== null) {
    targetZone = opponent.board.monsterZones.findIndex((c) => c?.instanceId === targetInstanceId);
    const t = opponent.board.monsterZones[targetZone];
    if (!t) {
      surviveAttacker();
      return { state: withPlayers(), events };
    }
    target = t;
  } else if (opponent.board.monsterZones.some((c) => c !== null)) {
    surviveAttacker();
    return { state: withPlayers(), events };
  }

  if (target !== null && target.position === 'DefenseDown') {
    // Attacking a face-down monster flips it face-up; it stays in Defense Position for
    // damage calc (classic-rules assumption — never auto-switches to Attack Position).
    const flipped: CardInstance = { ...target, position: 'DefenseUp' };
    const monsterZones = nextOpponent.board.monsterZones.map((slot, i) =>
      i === targetZone ? flipped : slot,
    ) as unknown as PlayerState['board']['monsterZones'];
    nextOpponent = { ...nextOpponent, board: { ...nextOpponent.board, monsterZones } };
    events.push({
      type: 'MonsterFlipped',
      ownerIndex: opponentIndex,
      instanceId: flipped.instanceId,
      definitionId: flipped.definitionId,
      zoneIndex: targetZone,
    });
    target = flipped;
  }

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

  // Task 3.6: effective ATK/DEF (Continuous effects included), read on the board AFTER the flip above, so a monster
  // just flipped face-up both receives modifiers and applies its own [RULE]. Read once, before anything is destroyed.
  const boardAfterFlip = withPlayers();
  const attackerStats = effectiveStats(boardAfterFlip, attacker, ctx);
  const targetStats = target === null ? null : effectiveStats(boardAfterFlip, target, ctx);

  const damage = (recipient: PlayerState, recipientIndex: 0 | 1, amount: number): PlayerState => {
    events.push({ type: 'DamageDealt', playerIndex: recipientIndex, amount });
    return { ...recipient, lifePoints: Math.max(0, recipient.lifePoints - amount) };
  };

  if (target === null || targetStats === null) {
    // Direct attack.
    surviveAttacker();
    nextOpponent = damage(nextOpponent, opponentIndex, attackerStats.atk);
  } else if (target.position === 'Attack') {
    if (attackerStats.atk > targetStats.atk) {
      nextOpponent = destroy(nextOpponent, opponentIndex, target, targetZone, target.definitionId);
      nextOpponent = damage(nextOpponent, opponentIndex, attackerStats.atk - targetStats.atk);
      surviveAttacker();
    } else if (attackerStats.atk < targetStats.atk) {
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
        targetStats.atk - attackerStats.atk,
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
    if (attackerStats.atk > targetStats.def) {
      nextOpponent = destroy(nextOpponent, opponentIndex, target, targetZone, target.definitionId);
      surviveAttacker();
    } else if (attackerStats.atk < targetStats.def) {
      surviveAttacker();
      nextAttackingPlayer = damage(
        nextAttackingPlayer,
        playerIndex,
        targetStats.def - attackerStats.atk,
      );
    } else {
      // [ASSUMED]: ATK == DEF against a Defense Position target isn't covered by
      // RULES-REVIEW-SHEET.md rows 33-34; treated as nobody destroyed, no damage.
      surviveAttacker();
    }
  }

  const players: [PlayerState, PlayerState] =
    playerIndex === 0 ? [nextAttackingPlayer, nextOpponent] : [nextOpponent, nextAttackingPlayer];

  const win = checkLifePointsWinCondition(players);
  if (win) events.push(win.event);

  return {
    state: { ...state, players, winnerIndex: win ? win.winnerIndex : state.winnerIndex },
    events,
  };
}
