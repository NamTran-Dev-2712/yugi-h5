import type { CardInstance, PlayerState } from '../../state/types.js';
import type { OperationHandler } from './types.js';

/**
 * Task 4.4: negates the attack the reaction window was opened for (`ctx.window.reactionTo`). `effects/chain.ts` reads
 * `AttackNegated` and does not let the attack go on to damage once the chain is done. [RULE] the attacker counts as
 * having attacked this turn (no replay, like an attack that lost its target — G14); if it already left the field there
 * is nothing to stamp. Without a declared attack (or once it was negated earlier in the same chain) nothing happens.
 */
export const applyNegateAttack: OperationHandler<'NegateAttack'> = (state, _op, ctx) => {
  const attack = ctx.window?.reactionTo;
  if (attack?.kind !== 'Attack') return { state, events: [] };

  const attacker = state.players[attack.playerIndex];
  const zone = attacker.board.monsterZones.findIndex(
    (c) => c?.instanceId === attack.attackerInstanceId,
  );
  let players = state.players;
  if (zone !== -1) {
    const monsterZones = attacker.board.monsterZones.map((c, i) =>
      i === zone && c ? ({ ...c, attackedTurn: state.turnCount } satisfies CardInstance) : c,
    ) as unknown as PlayerState['board']['monsterZones'];
    const next: PlayerState = { ...attacker, board: { ...attacker.board, monsterZones } };
    players = attack.playerIndex === 0 ? [next, state.players[1]] : [state.players[0], next];
  }
  return {
    state: { ...state, players },
    events: [
      {
        type: 'AttackNegated',
        playerIndex: attack.playerIndex,
        attackerInstanceId: attack.attackerInstanceId,
        targetInstanceId: attack.targetInstanceId,
      },
    ],
  };
};
