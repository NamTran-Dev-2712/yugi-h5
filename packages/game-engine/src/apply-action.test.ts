import { describe, expect, it } from 'vitest';
import { applyAction } from './apply-action.js';
import type { StartDuelAction, DrawAction } from './actions/types.js';

function deckOf(prefix: string, size: number): string[] {
  return Array.from({ length: size }, (_, i) => `${prefix}-${i}`);
}

function startDuelAction(seed: string): StartDuelAction {
  return {
    type: 'StartDuel',
    payload: {
      matchId: 'match-1',
      seed,
      playerIds: ['alice', 'bob'],
      deckLists: [deckOf('A', 40), deckOf('B', 40)],
    },
  };
}

describe('applyAction / StartDuel', () => {
  it('deals a 5-card opening hand to each player and starts on Draw phase', () => {
    const { state, events } = applyAction(null, startDuelAction('seed-1'));

    expect(state.players[0].hand).toHaveLength(5);
    expect(state.players[1].hand).toHaveLength(5);
    expect(state.players[0].deck).toHaveLength(35);
    expect(state.phase).toBe('Draw');
    expect(state.players[0].lifePoints).toBe(8000);
    expect(events.filter((e) => e.type === 'CardDrawn')).toHaveLength(10);
    expect(events[0]).toMatchObject({ type: 'DuelStarted' });
  });

  it('is deterministic for the same seed', () => {
    const run1 = applyAction(null, startDuelAction('fixed-seed'));
    const run2 = applyAction(null, startDuelAction('fixed-seed'));

    expect(run1.state.players[0].hand.map((c) => c.definitionId)).toEqual(
      run2.state.players[0].hand.map((c) => c.definitionId),
    );
    expect(run1.state.players[1].deck.map((c) => c.definitionId)).toEqual(
      run2.state.players[1].deck.map((c) => c.definitionId),
    );
  });

  it('produces a different shuffle for a different seed', () => {
    const run1 = applyAction(null, startDuelAction('seed-a'));
    const run2 = applyAction(null, startDuelAction('seed-b'));

    expect(run1.state.players[0].hand.map((c) => c.definitionId)).not.toEqual(
      run2.state.players[0].hand.map((c) => c.definitionId),
    );
  });
});

describe('applyAction / Draw', () => {
  it('moves cards from deck to hand and emits CardDrawn events', () => {
    const { state: started } = applyAction(null, startDuelAction('seed-draw'));
    const drawAction: DrawAction = { type: 'Draw', payload: { playerIndex: 0, count: 2 } };

    const { state, events } = applyAction(started, drawAction);

    expect(state.players[0].hand).toHaveLength(7);
    expect(state.players[0].deck).toHaveLength(33);
    expect(state.version).toBe(started.version + 1);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: 'CardDrawn', playerIndex: 0 });
  });

  it('ends the duel with a DeckOut event when the deck cannot cover the draw', () => {
    const { state: started } = applyAction(null, startDuelAction('seed-deckout'));
    const drawAction: DrawAction = { type: 'Draw', payload: { playerIndex: 0, count: 999 } };

    const { state, events } = applyAction(started, drawAction);

    expect(state.winnerIndex).toBe(1);
    expect(events).toEqual([{ type: 'DeckOut', playerIndex: 0 }]);
  });

  it('throws when Draw is applied without an existing state', () => {
    const drawAction: DrawAction = { type: 'Draw', payload: { playerIndex: 0, count: 1 } };
    expect(() => applyAction(null, drawAction)).toThrow();
  });
});
