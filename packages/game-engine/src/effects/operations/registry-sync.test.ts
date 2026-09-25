import { describe, expect, it } from 'vitest';
import { OPERATION_REGISTRY, SAMPLE_CARDS } from '@yugi/shared';
import { applyAction } from '../../apply-action.js';
import { fixtureState } from '../../testing/effect-fixtures.js';
import { OPERATION_HANDLERS } from './index.js';

describe('operation handlers ↔ shared registry', () => {
  it('the engine has a handler for exactly the kinds the registry marks implemented', () => {
    const implemented = Object.entries(OPERATION_REGISTRY)
      .filter(([, entry]) => entry.implemented)
      .map(([kind]) => kind)
      .sort();
    expect(Object.keys(OPERATION_HANDLERS).sort()).toEqual(implemented);
    for (const handler of Object.values(OPERATION_HANDLERS)) {
      expect(typeof handler).toBe('function');
    }
  });
});

describe('sample card SMP-101 (Sudden Reinforcement) runs through the real card data', () => {
  it('draws exactly 1 card and goes to the graveyard', () => {
    const ctx = { cardDefinitions: (id: string) => SAMPLE_CARDS.find((c) => c.id === id) };
    const state = fixtureState({ hand: ['SMP-101'] });
    const { state: next } = applyAction(
      state,
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'h0', effectId: 'draw-one' },
      },
      ctx,
    );
    expect(next.players[0].hand).toHaveLength(1);
    expect(next.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-101']);
  });
});
