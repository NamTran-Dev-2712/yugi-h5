import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, apply, main, sampleCtx, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.1 — SMP-107 Desperate Muster (Tier B), Normal Spell. Only while you control no monster AND your opponent
 * controls at least 1 (two ZoneCount conditions, AND). Draw 2 cards.
 */

describe('SMP-107 Desperate Muster', () => {
  it('empty field vs. an opponent monster: draws 2', () => {
    const before = main({ hand: ['SMP-107'], oppMonsters: [[0, 'M1']] });
    const { state, events } = apply(before, activate('h0', 'muster-draw'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'CardDrawn',
      'CardDrawn',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(state.players[0].hand).toHaveLength(2);
    expect(events).toMatchSnapshot();
  });

  it('a face-down opponent monster counts too', () => {
    const before = main({ hand: ['SMP-107'], oppMonsters: [[1, 'M1', 'DefenseDown']] });
    expect(apply(before, activate('h0', 'muster-draw')).state.players[0].hand).toHaveLength(2);
  });

  it('I control a monster: CONDITION_NOT_MET, not listed', () => {
    const state = main({
      hand: ['SMP-107'],
      myMonsters: [[0, 'M1', 'DefenseDown']],
      oppMonsters: [[0, 'M1']],
    });
    expectEngineError(() => apply(state, activate('h0', 'muster-draw')), 'CONDITION_NOT_MET');
    expect(getLegalActions(state, 0, sampleCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );
  });

  it('the opponent controls no monster: CONDITION_NOT_MET', () => {
    expectEngineError(
      () => apply(main({ hand: ['SMP-107'] }), activate('h0', 'muster-draw')),
      'CONDITION_NOT_MET',
    );
  });
});
