import type { CardInstance, PlayerState } from '../../state/types.js';
import { findOnField } from '../targets.js';
import type { OperationHandler } from './types.js';

/**
 * Task 4.2c: equips the resolving card (an Equip Spell, face-up in its Spell/Trap Zone since activation) to the effect's
 * target — a monster that must still be face-up on the field [RULE]. Sets `equippedTo` on the Equip card; it then stays
 * on the field (`chain.ts` does not send it to the graveyard). If the Equip card left its zone (destroyed in response)
 * or the target is no longer a face-up monster, nothing happens (a target that left the field already fizzled the link).
 */
export const applyEquip: OperationHandler<'Equip'> = (state, _op, ctx) => {
  const targetId = ctx.targetInstanceIds[0];
  const target = targetId === undefined ? null : findOnField(state, targetId);
  const equip = findOnField(state, ctx.sourceInstanceId);
  if (
    !target ||
    target.zone !== 'MonsterZone' ||
    target.card.position === 'DefenseDown' ||
    !equip ||
    equip.zone !== 'SpellTrapZone' ||
    equip.card.position === 'DefenseDown'
  )
    return { state, events: [] };

  const equipped: CardInstance = { ...equip.card, equippedTo: target.card.instanceId };
  const owner = state.players[equip.ownerIndex];
  const next: PlayerState = {
    ...owner,
    board: {
      ...owner.board,
      spellTrapZones: owner.board.spellTrapZones.map((c, i) =>
        i === equip.zoneIndex ? equipped : c,
      ) as unknown as PlayerState['board']['spellTrapZones'],
    },
  };
  return {
    state: {
      ...state,
      players: equip.ownerIndex === 0 ? [next, state.players[1]] : [state.players[0], next],
    },
    events: [
      {
        type: 'CardEquipped',
        playerIndex: equip.ownerIndex,
        instanceId: equipped.instanceId,
        definitionId: equipped.definitionId,
        targetInstanceId: target.card.instanceId,
      },
    ],
  };
};
