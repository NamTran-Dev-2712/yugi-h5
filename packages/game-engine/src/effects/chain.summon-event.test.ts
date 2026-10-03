import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events/types.js';
import type { ChainWindow } from '../state/types.js';
import { owedSummonEvents } from './chain.js';

/*
 * Task 4.4c — `owedSummonEvents`: which Summon event a closing window hands to the trigger collector. Tested directly
 * because, through `applyAction`, a negated monster's own triggers are also stopped by "the card left its zone".
 */

const summonEvent = {
  type: 'NormalSummoned',
  playerIndex: 0,
  instanceId: 'h0',
  definitionId: 'SUM_BURN',
  zoneIndex: 3,
} as const;
const window: ChainWindow = {
  priorityPlayer: 1,
  passCount: 0,
  reactionTo: { kind: 'Summon' },
  summoned: { playerIndex: 0, instanceId: 'h0' },
  summonEvent,
};
const negated = (instanceId: string): GameEvent => ({
  type: 'SummonNegated',
  playerIndex: 0,
  instanceId,
  definitionId: 'SUM_BURN',
  zoneIndex: 3,
});

describe('owedSummonEvents', () => {
  it('hands over the Summon event once the window is done', () => {
    expect(owedSummonEvents(window, [])).toEqual([summonEvent]);
    expect(owedSummonEvents(window, [{ type: 'ChainResolved', linkCount: 1 }])).toEqual([
      summonEvent,
    ]);
  });

  it('hands over nothing when that Summon was negated', () => {
    expect(owedSummonEvents(window, [negated('h0')])).toEqual([]);
  });

  it('a negation of ANOTHER monster does not cancel it', () => {
    expect(owedSummonEvents(window, [negated('other')])).toEqual([summonEvent]);
  });

  it('nothing for a window that owes no Summon (attack window, Set window, no window)', () => {
    expect(owedSummonEvents(null, [])).toEqual([]);
    expect(
      owedSummonEvents({ priorityPlayer: 1, passCount: 0, reactionTo: { kind: 'Summon' } }, []),
    ).toEqual([]);
  });
});
