import type { PlayerState } from '../../state/types.js';
import type { OperationHandler } from './types.js';

/**
 * Task 4.4: negates the Normal / Flip Summon the reaction window was opened for (`ctx.window.summoned`). [ASSUMED] G23:
 * the monster is SENT to its owner's graveyard — `SummonNegated`, no `MonsterDestroyed`, so no OnDestroyed trigger; the
 * Normal Summon of the turn and the Tributes stay spent. If the monster already left its zone nothing happens.
 */
export const applyNegateSummon: OperationHandler<'NegateSummon'> = (state, _op, ctx) => {
  const summoned = ctx.window?.summoned;
  if (!summoned) return { state, events: [] };

  const controller = state.players[summoned.playerIndex];
  const zoneIndex = controller.board.monsterZones.findIndex(
    (c) => c?.instanceId === summoned.instanceId,
  );
  const monster = controller.board.monsterZones[zoneIndex];
  if (!monster) return { state, events: [] };

  const monsterZones = controller.board.monsterZones.map((c, i) =>
    i === zoneIndex ? null : c,
  ) as unknown as PlayerState['board']['monsterZones'];
  const next: PlayerState = {
    ...controller,
    board: { ...controller.board, monsterZones },
    // Built fresh: no stamps of its short stay on the field carry over.
    graveyard: [
      ...controller.graveyard,
      {
        instanceId: monster.instanceId,
        definitionId: monster.definitionId,
        ownerIndex: monster.ownerIndex,
        position: null,
      },
    ],
  };
  return {
    state: {
      ...state,
      players: summoned.playerIndex === 0 ? [next, state.players[1]] : [state.players[0], next],
    },
    events: [
      {
        type: 'SummonNegated',
        playerIndex: summoned.playerIndex,
        instanceId: monster.instanceId,
        definitionId: monster.definitionId,
        zoneIndex,
      },
    ],
  };
};
