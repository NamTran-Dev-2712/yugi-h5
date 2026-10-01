import type { GameEvent } from '../../events/types.js';
import type { CardInstance, PlayerState } from '../../state/types.js';
import { findOnField } from '../targets.js';
import type { OperationHandler } from './types.js';

type Five<T> = readonly [T, T, T, T, T];

const withSlotCleared = <T>(zones: Five<T | null>, index: number): Five<T | null> =>
  zones.map((c, i) => (i === index ? null : c)) as unknown as Five<T | null>;

/**
 * Destroys the effect's chosen targets that are still on the field: they go to their OWNER's graveyard.
 * Monsters emit `MonsterDestroyed`, Spells/Traps `SpellTrapDestroyed`, the card in a Field Zone `FieldSpellDestroyed`
 * (task 4.3). A target that already left the field is skipped.
 */
export const applyDestroy: OperationHandler<'Destroy'> = (state, _op, ctx) => {
  let players: [PlayerState, PlayerState] = [state.players[0], state.players[1]];
  const events: GameEvent[] = [];

  for (const id of ctx.targetInstanceIds) {
    const at = findOnField({ ...state, players }, id);
    if (!at) continue;
    const owner = players[at.ownerIndex];
    const buried: CardInstance = {
      instanceId: at.card.instanceId,
      definitionId: at.card.definitionId,
      ownerIndex: at.card.ownerIndex,
      position: null,
    };
    const board =
      at.zone === 'MonsterZone'
        ? { ...owner.board, monsterZones: withSlotCleared(owner.board.monsterZones, at.zoneIndex) }
        : at.zone === 'FieldZone'
          ? { ...owner.board, fieldZone: null }
          : {
              ...owner.board,
              spellTrapZones: withSlotCleared(owner.board.spellTrapZones, at.zoneIndex),
            };
    const nextOwner: PlayerState = { ...owner, board, graveyard: [...owner.graveyard, buried] };
    players = at.ownerIndex === 0 ? [nextOwner, players[1]] : [players[0], nextOwner];
    const gone = {
      ownerIndex: at.ownerIndex,
      instanceId: buried.instanceId,
      definitionId: buried.definitionId,
    };
    events.push(
      at.zone === 'FieldZone'
        ? { type: 'FieldSpellDestroyed', ...gone }
        : {
            type: at.zone === 'MonsterZone' ? 'MonsterDestroyed' : 'SpellTrapDestroyed',
            ...gone,
            zoneIndex: at.zoneIndex,
          },
    );
  }
  return { state: { ...state, players }, events };
};
