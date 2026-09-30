import type { EffectDefinition } from '@yugi/shared';
import type { GameEvent } from '../../events/types.js';
import type { CardInstance, GameState, PlayerState } from '../../state/types.js';
import { findInHandOrGraveyard } from '../targets.js';
import type { OperationHandler } from './types.js';

/** Empty Monster Zones of `player`, lowest first. */
export function freeMonsterZones(player: PlayerState): number[] {
  return player.board.monsterZones.flatMap((c, i) => (c === null ? [i] : []));
}

/**
 * [RULE] an effect that Special Summons cannot be activated without room for what it summons: true when `effect` has a
 * `SpecialSummon` and `controller` has fewer empty Monster Zones than its target count (5 zones, no Extra Monster Zone).
 */
export function lacksSummonZones(
  state: GameState,
  controller: 0 | 1,
  effect: EffectDefinition,
): boolean {
  if (!effect.operations.some((o) => o.kind === 'SpecialSummon')) return false;
  const needed = effect.target?.kind === 'Card' ? effect.target.count : 1;
  return freeMonsterZones(state.players[controller]).length < needed;
}

/**
 * Task 4.2a: Special Summons the effect's chosen targets that are still in the controller's hand or graveyard, in target
 * order, each into the controller's lowest empty Monster Zone [ASSUMED] (the real rule lets the player choose). The
 * schema only allows your own monsters, so owner = controller. A target that moved is skipped; once the zones are full
 * the rest stay where they are [ASSUMED]. Does not touch `hasNormalSummonedThisTurn` [RULE]. `summonedTurn` is stamped
 * like a Normal Summon, so the monster cannot change position (nor attack, the repo's rule) this turn.
 */
export const applySpecialSummon: OperationHandler<'SpecialSummon'> = (state, op, ctx) => {
  const position = op.position ?? 'Attack';
  let current: GameState = state;
  const events: GameEvent[] = [];

  for (const id of ctx.targetInstanceIds) {
    const player = current.players[ctx.controller];
    const zoneIndex = freeMonsterZones(player)[0];
    if (zoneIndex === undefined) break;
    const found = findInHandOrGraveyard(current, ctx.controller, id);
    if (!found) continue;

    // Built fresh (not `...card`) so marks from an earlier stay on the field never carry over.
    const placed: CardInstance = {
      instanceId: found.card.instanceId,
      definitionId: found.card.definitionId,
      ownerIndex: found.card.ownerIndex,
      position,
      summonedTurn: current.turnCount,
    };
    const next: PlayerState = {
      ...player,
      hand: found.zone === 'Hand' ? player.hand.filter((c) => c.instanceId !== id) : player.hand,
      graveyard:
        found.zone === 'Graveyard'
          ? player.graveyard.filter((c) => c.instanceId !== id)
          : player.graveyard,
      board: {
        ...player.board,
        monsterZones: player.board.monsterZones.map((slot, i) =>
          i === zoneIndex ? placed : slot,
        ) as unknown as PlayerState['board']['monsterZones'],
      },
    };
    current = {
      ...current,
      players: ctx.controller === 0 ? [next, current.players[1]] : [current.players[0], next],
    };
    events.push({
      type: 'MonsterSpecialSummoned',
      playerIndex: ctx.controller,
      instanceId: placed.instanceId,
      definitionId: placed.definitionId,
      zoneIndex,
      from: found.zone,
      position,
    });
  }
  return { state: current, events };
};
