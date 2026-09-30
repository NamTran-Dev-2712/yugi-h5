import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, apply, lp, main, sampleCtx, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.1 — SMP-106 Toll of the Blade (Tier B), Normal Spell. Cost: pay 1000 LP. Target 1 monster your opponent
 * controls; destroy it. The cost is paid on activation (task 3.3); paying needs MORE LP than the cost [ASSUMED] (3.2).
 */

describe('SMP-106 Toll of the Blade', () => {
  it('pays 1000 LP on activation, then destroys the opponent monster', () => {
    const before = main({ hand: ['SMP-106'], oppMonsters: [[0, 'M1']] });
    const { state, events } = apply(before, activate('h0', 'toll-strike'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'LifePointsPaid',
      'ChainLinkAdded',
      'MonsterDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([7000, 8000]);
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(events).toMatchSnapshot();
  });

  it('a face-down monster is a legal target (no filter)', () => {
    const before = main({ hand: ['SMP-106'], oppMonsters: [[2, 'M1', 'DefenseDown']] });
    const { state } = apply(before, activate('h0', 'toll-strike'));
    expect(state.players[1].board.monsterZones[2]).toBeNull();
  });

  it('exactly 1000 LP: cannot pay (INVALID_COST), not listed', () => {
    const state = main({ hand: ['SMP-106'], oppMonsters: [[0, 'M1']], myLp: 1000 });
    expectEngineError(() => apply(state, activate('h0', 'toll-strike')), 'INVALID_COST');
    expect(getLegalActions(state, 0, sampleCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );
  });

  it('no opponent monster: NO_VALID_TARGET (my own monster is not a target)', () => {
    expectEngineError(
      () =>
        apply(main({ hand: ['SMP-106'], myMonsters: [[0, 'M1']] }), activate('h0', 'toll-strike')),
      'NO_VALID_TARGET',
    );
  });
});
