import type { Action } from '@yugi/game-engine';
import type { PlayerAction } from '@yugi/shared';

/**
 * Engine actions that are not on the wire yet (not in `PlayerActionSchema`): never listed in `legalActions`, refused by
 * `submitAction` (FORBIDDEN_ACTION). Task 4.2b: FlipSummon is engine-only until its wire task.
 */
export const ENGINE_ONLY_ACTIONS: ReadonlySet<Action['type']> = new Set<Action['type']>([
  'FlipSummon',
]);

/** Engine legal actions → what a player may be offered: never StartDuel/Draw (server-internal) nor engine-only ones. */
export function toPlayerActions(actions: readonly Action[]): PlayerAction[] {
  return actions.filter(
    (a) => a.type !== 'StartDuel' && a.type !== 'Draw' && !ENGINE_ONLY_ACTIONS.has(a.type),
  ) as unknown as PlayerAction[];
}
