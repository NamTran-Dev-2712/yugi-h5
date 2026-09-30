import type { Action } from '@yugi/game-engine';
import type { PlayerAction } from '@yugi/shared';

/**
 * Engine actions that are not on the wire yet (not in `PlayerActionSchema`): never listed in `legalActions`, refused by
 * `submitAction` (FORBIDDEN_ACTION). Empty since task 4.2d (FlipSummon went on the wire); kept for the next engine-only action.
 */
export const ENGINE_ONLY_ACTIONS: ReadonlySet<Action['type']> = new Set<Action['type']>([]);

/** Engine legal actions → what a player may be offered: never StartDuel/Draw (server-internal) nor engine-only ones. */
export function toPlayerActions(actions: readonly Action[]): PlayerAction[] {
  return actions.filter(
    (a) => a.type !== 'StartDuel' && a.type !== 'Draw' && !ENGINE_ONLY_ACTIONS.has(a.type),
  ) as unknown as PlayerAction[];
}
