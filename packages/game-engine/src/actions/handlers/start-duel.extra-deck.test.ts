import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import type { StartDuelAction } from '../types.js';

/* Task 4.5 — StartDuel loads each player's Extra Deck (optional; without it nothing changes). */

const deck = (id: string): string[] => Array.from({ length: 40 }, () => id);

const start = (extra: Partial<StartDuelAction['payload']> = {}): StartDuelAction => ({
  type: 'StartDuel',
  payload: {
    matchId: 'm',
    seed: 'seed-extra',
    playerIds: ['alice', 'bob'],
    deckLists: [deck('A'), deck('B')],
    ...extra,
  },
});

describe('StartDuel — Extra Deck (task 4.5)', () => {
  it('without extraDeckLists both Extra Decks are empty (as before)', () => {
    const { state } = applyAction(null, start());
    expect(state.players[0].extraDeck).toEqual([]);
    expect(state.players[1].extraDeck).toEqual([]);
  });

  it('builds the Extra Deck in list order with ids p<seat>-x<i>, owned by its player, off the field', () => {
    const { state } = applyAction(null, start({ extraDeckLists: [['F1', 'F2', 'F1'], ['F3']] }));
    expect(state.players[0].extraDeck).toEqual([
      { instanceId: 'p0-x0', definitionId: 'F1', position: null, ownerIndex: 0 },
      { instanceId: 'p0-x1', definitionId: 'F2', position: null, ownerIndex: 0 },
      { instanceId: 'p0-x2', definitionId: 'F1', position: null, ownerIndex: 0 },
    ]);
    expect(state.players[1].extraDeck).toEqual([
      { instanceId: 'p1-x0', definitionId: 'F3', position: null, ownerIndex: 1 },
    ]);
  });

  it('changes nothing else: same rng, hands, decks and events as a duel without Extra Decks', () => {
    const plain = applyAction(null, start());
    const withExtra = applyAction(null, start({ extraDeckLists: [['F1', 'F2'], ['F3']] }));
    expect(withExtra.events).toEqual(plain.events);
    expect(withExtra.state.rng).toEqual(plain.state.rng);
    for (const seat of [0, 1] as const) {
      expect(withExtra.state.players[seat].hand).toEqual(plain.state.players[seat].hand);
      expect(withExtra.state.players[seat].deck).toEqual(plain.state.players[seat].deck);
    }
    expect({
      ...withExtra.state,
      players: withExtra.state.players.map((p) => ({ ...p, extraDeck: [] })),
    }).toEqual(plain.state);
  });

  it('an Extra Deck over ruleset.extraDeckSize → INVALID_EXTRA_DECK', () => {
    const twenty = Array.from({ length: 20 }, () => 'F1');
    expect(() => applyAction(null, start({ extraDeckLists: [twenty, []] }))).not.toThrow();
    expectEngineError(
      () => applyAction(null, start({ extraDeckLists: [[], [...twenty, 'F1']] })),
      'INVALID_EXTRA_DECK',
    );
    expectEngineError(
      () =>
        applyAction(
          null,
          start({ extraDeckLists: [['F1', 'F2'], []], ruleset: { extraDeckSize: 1 } }),
        ),
      'INVALID_EXTRA_DECK',
    );
  });
});
