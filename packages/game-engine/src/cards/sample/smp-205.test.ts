import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, apply, attack, battle, lp, main, types } from '../../testing/sample-card-kit.js';

/* Task 4.1 — SMP-205 Second Wind (Tier B), Normal Trap (Spell Speed 2): gain 1000 LP, then draw 1 card. */

describe('SMP-205 Second Wind', () => {
  it('my Set copy in my turn: +1000 LP, then draws 1', () => {
    const before = main({ mySpellTraps: [[0, 'SMP-205']], myLp: 4000 });
    const { state, events } = apply(before, activate('ms-0', 'second-wind'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'LifePointsRecovered',
      'CardDrawn',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([5000, 8000]);
    expect(state.players[0].hand).toHaveLength(1);
    expect(events).toMatchSnapshot();
  });

  it('answers the opponent attack: its controller heals and draws before the damage', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'SMP-205']] });
    const opened = apply(before, attack('m0-0')).state;
    const handBefore = opened.players[1].hand.length;
    const { state } = apply(opened, activate('os-0', 'second-wind', 1));
    expect(lp(state)).toEqual([8000, 7000]);
    expect(state.players[1].hand).toHaveLength(handBefore + 1);
  });

  it('from the hand: TRAP_NOT_SET', () => {
    expectEngineError(
      () => apply(main({ hand: ['SMP-205'] }), activate('h0', 'second-wind')),
      'TRAP_NOT_SET',
    );
  });
});
