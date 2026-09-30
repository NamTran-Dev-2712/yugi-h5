import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, apply, main, sampleCtx, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.1 — SMP-207 Last Reserve (Tier B), Normal Trap (Spell Speed 2). Only while you have 2 or fewer cards in your
 * hand (ZoneCount Hand max 2): draw 2 cards.
 */

describe('SMP-207 Last Reserve', () => {
  it('2 cards in hand: draws 2', () => {
    const before = main({ hand: ['M1', 'M1'], mySpellTraps: [[0, 'SMP-207']] });
    const { state, events } = apply(before, activate('ms-0', 'last-reserve'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'CardDrawn',
      'CardDrawn',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(state.players[0].hand).toHaveLength(4);
    expect(events).toMatchSnapshot();
  });

  it('3 cards in hand: CONDITION_NOT_MET, not listed', () => {
    const state = main({ hand: ['M1', 'M1', 'M1'], mySpellTraps: [[0, 'SMP-207']] });
    expectEngineError(() => apply(state, activate('ms-0', 'last-reserve')), 'CONDITION_NOT_MET');
    expect(getLegalActions(state, 0, sampleCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );
  });

  it('empty hand: allowed (only a maximum)', () => {
    const { state } = apply(
      main({ mySpellTraps: [[0, 'SMP-207']] }),
      activate('ms-0', 'last-reserve'),
    );
    expect(state.players[0].hand).toHaveLength(2);
  });

  it('from the hand: TRAP_NOT_SET', () => {
    expectEngineError(
      () => apply(main({ hand: ['SMP-207'] }), activate('h0', 'last-reserve')),
      'TRAP_NOT_SET',
    );
  });
});
