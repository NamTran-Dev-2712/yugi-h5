import type { DuelEndedEvent } from '../events/types.js';
import type { PlayerState } from './types.js';

/**
 * Checks life points for the LP-zero win condition after damage is applied. Life points are
 * already clamped to `>= 0` by callers, so `<= 0` and `=== 0` are equivalent here. Returns
 * `null` when the duel continues. Shared so later loss conditions (effect damage, etc.) can
 * reuse it instead of duplicating the check inline in another handler.
 */
export function checkLifePointsWinCondition(
  players: readonly [PlayerState, PlayerState],
): { winnerIndex: 0 | 1 | 'draw'; event: DuelEndedEvent } | null {
  const p0Dead = players[0].lifePoints <= 0;
  const p1Dead = players[1].lifePoints <= 0;

  if (!p0Dead && !p1Dead) return null;

  if (p0Dead && p1Dead) {
    return {
      winnerIndex: 'draw',
      event: { type: 'DuelEnded', winnerIndex: null, reason: 'LP_ZERO' },
    };
  }

  const winner = p0Dead ? 1 : 0;
  return {
    winnerIndex: winner,
    event: { type: 'DuelEnded', winnerIndex: winner, reason: 'LP_ZERO' },
  };
}
