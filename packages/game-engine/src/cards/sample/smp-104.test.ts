import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, apply, main, sampleCtx, types } from '../../testing/sample-card-kit.js';

/*
 * Task 3.8 — SMP-104 Battlefield Cache (Tier B), Normal Spell. Cost: discard 1 card. Effect: draw 2 cards.
 * The cost is paid on activation (task 3.3), before the draw.
 */

describe('SMP-104 Battlefield Cache', () => {
  it('activation announces the card, pays the cost (discard 1), then resolves: draw 2', () => {
    const before = main({ hand: ['SMP-104', 'M1'] });
    const { state, events } = apply(before, activate('h0', 'dig', 0, ['h1']));
    expect(types(events)).toEqual([
      'EffectActivated',
      'CardDiscarded',
      'ChainLinkAdded',
      'CardDrawn',
      'CardDrawn',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(state.players[0].hand).toHaveLength(2);
    expect(state.players[0].graveyard.map((c) => c.definitionId).sort()).toEqual(['M1', 'SMP-104']);
    expect(events).toMatchSnapshot();
  });

  it('no card to discard: rejected, and not listed', () => {
    const state = main({ hand: ['SMP-104'] });
    expectEngineError(() => apply(state, activate('h0', 'dig', 0, [])), 'INVALID_COST');
    expect(getLegalActions(state, 0, sampleCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );
  });

  it('cannot discard itself as the cost', () => {
    expectEngineError(
      () => apply(main({ hand: ['SMP-104', 'M1'] }), activate('h0', 'dig', 0, ['h0'])),
      'INVALID_COST',
    );
  });

  it('listed once per possible discard', () => {
    const legal = getLegalActions(main({ hand: ['SMP-104', 'M1', 'M1'] }), 0, sampleCtx);
    expect(legal.filter((a) => a.type === 'ActivateEffect')).toEqual([
      activate('h0', 'dig', 0, ['h1']),
      activate('h0', 'dig', 0, ['h2']),
    ]);
  });
});
