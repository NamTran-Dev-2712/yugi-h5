import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, apply, battle, lp, main, types } from '../../testing/sample-card-kit.js';

/* Task 3.8 — SMP-103 Warm Spring (Tier B), Normal Spell: gain 1000 LP. Main Phase, from the hand. */

describe('SMP-103 Warm Spring', () => {
  it('Main Phase 1: +1000 LP, the card goes to the graveyard', () => {
    const { state, events } = apply(main({ hand: ['SMP-103'] }), activate('h0', 'heal'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'LifePointsRecovered',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([9000, 8000]);
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-103']);
    expect(events).toMatchSnapshot();
  });

  it('Main Phase 2 works too', () => {
    expect(lp(apply(main({ hand: ['SMP-103'] }, 'Main2'), activate('h0', 'heal')).state)).toEqual([
      9000, 8000,
    ]);
  });

  it('Battle Phase: a Normal Spell cannot be activated', () => {
    expectEngineError(
      () => apply(battle({ hand: ['SMP-103'] }), activate('h0', 'heal')),
      'WRONG_PHASE',
    );
  });

  it('wrong effect id is rejected', () => {
    expectEngineError(
      () => apply(main({ hand: ['SMP-103'] }), activate('h0', 'nope')),
      'EFFECT_NOT_FOUND',
    );
  });
});
