import { describe, expect, it } from 'vitest';
import { apply, lp, main, setMonster, summon, types } from '../../testing/sample-card-kit.js';

/* Task 3.8 — SMP-019 Firebrand Hornet (Tier B): OnSummon MANDATORY — 300 damage to the opponent. */

describe('SMP-019 Firebrand Hornet', () => {
  it('Normal Summon: the trigger goes on the chain by itself and burns the opponent for 300', () => {
    const before = main({ hand: ['SMP-019'] });
    const { state, events } = apply(before, summon('h0'));
    expect(types(events)).toEqual([
      'NormalSummoned',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(events).toContainEqual({ type: 'DamageDealt', playerIndex: 1, amount: 300 });
    expect(lp(state)).toEqual([8000, 7700]);
    expect(state.pendingPrompt).toBeNull();
    expect(state.chainWindow).toBeNull();
    // A monster trigger does not move the card.
    expect(state.players[0].board.monsterZones[0]?.definitionId).toBe('SMP-019');
    expect(events).toMatchSnapshot();
  });

  it('a Set is not a Summon: no trigger, no damage', () => {
    const { state, events } = apply(main({ hand: ['SMP-019'] }), setMonster('h0'));
    expect(types(events)).toEqual(['MonsterSet']);
    expect(lp(state)).toEqual([8000, 8000]);
  });

  it('never asks the owner (mandatory)', () => {
    const { state } = apply(main({ hand: ['SMP-019'] }), summon('h0'));
    expect(state.pendingPrompt).toBeNull();
  });
});
