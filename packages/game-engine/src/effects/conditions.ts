import type { Condition, EffectZone } from '@yugi/shared';
import type { GameState } from '../state/types.js';
import { sideIndex } from './filter.js';

function zoneCount(state: GameState, playerIndex: 0 | 1, zone: EffectZone): number {
  const player = state.players[playerIndex];
  switch (zone) {
    case 'Hand':
      return player.hand.length;
    case 'Deck':
      return player.deck.length;
    case 'Graveyard':
      return player.graveyard.length;
    case 'MonsterZone':
      return player.board.monsterZones.filter((c) => c !== null).length;
    case 'SpellTrapZone':
      return player.board.spellTrapZones.filter((c) => c !== null).length;
    default: {
      const unreachable: never = zone;
      return unreachable;
    }
  }
}

function holds(state: GameState, controller: 0 | 1, condition: Condition): boolean {
  switch (condition.kind) {
    case 'PhaseIs':
      return state.phase === condition.phase;
    case 'IsMyTurn':
      return state.turnPlayerIndex === controller;
    case 'ZoneCount': {
      const n = zoneCount(state, sideIndex(controller, condition.side), condition.zone);
      return (
        (condition.min === undefined || n >= condition.min) &&
        (condition.max === undefined || n <= condition.max)
      );
    }
    default: {
      const unreachable: never = condition;
      return unreachable;
    }
  }
}

/** All conditions must hold (AND). An absent/empty list always holds. */
export function conditionsHold(
  state: GameState,
  controller: 0 | 1,
  conditions: readonly Condition[] | undefined,
): boolean {
  return (conditions ?? []).every((c) => holds(state, controller, c));
}
