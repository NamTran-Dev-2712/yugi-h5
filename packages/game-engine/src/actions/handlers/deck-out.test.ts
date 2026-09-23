import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import type { GameState } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import type { ActionContext, DrawAction, EndPhaseAction, StartDuelAction } from '../types.js';

const ctx: ActionContext = { cardDefinitions: () => undefined };
const OPENING_HAND = 5;

/** Both decks hold `deckSize` cards; after the opening hand, the deck has `deckSize - 5` left. */
function start(deckSize: number, ruleset?: StartDuelAction['payload']['ruleset']): GameState {
  const deck = (p: string) => Array.from({ length: deckSize }, (_, i) => `${p}-${i}`);
  return applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed: 'seed-deck-out',
      playerIds: ['alice', 'bob'],
      deckLists: [deck('A'), deck('B')],
      ...(ruleset ? { ruleset } : {}),
    },
  }).state;
}

const endPhase = (playerIndex: 0 | 1): EndPhaseAction => ({
  type: 'EndPhase',
  payload: { playerIndex },
});
const draw = (playerIndex: 0 | 1, count: number): DrawAction => ({
  type: 'Draw',
  payload: { playerIndex, count },
});

/** A duel on turn 2 (player 1's turn, Draw phase) so the turn draw is due without firstTurnDraw. */
function turnTwo(deckSize: number): GameState {
  const s = start(deckSize);
  return { ...s, turnCount: 2, turnPlayerIndex: 1, phase: 'Draw' };
}

const DECK_OUT_EVENTS = (loser: 0 | 1) => [
  { type: 'DeckOut', playerIndex: loser },
  { type: 'DuelEnded', winnerIndex: loser === 0 ? 1 : 0, reason: 'DECK_OUT' },
];

describe('Deck-out', () => {
  it('empty deck when the turn draw is due → turn player loses, opponent wins', () => {
    const { state, events } = applyAction(turnTwo(OPENING_HAND), endPhase(1));
    expect(state.winnerIndex).toBe(0);
    expect(state.phase).toBe('Draw');
    expect(events).toEqual(DECK_OUT_EVENTS(1));
  });

  it('works for player 0 as well', () => {
    const s = { ...turnTwo(OPENING_HAND), turnCount: 3, turnPlayerIndex: 0 as const };
    const { state, events } = applyAction(s, endPhase(0));
    expect(state.winnerIndex).toBe(1);
    expect(events).toEqual(DECK_OUT_EVENTS(0));
  });

  it('deck with exactly 1 card → draws normally, no deck-out', () => {
    const s = turnTwo(OPENING_HAND + 1);
    const { state, events } = applyAction(s, endPhase(1));
    expect(state.winnerIndex).toBeNull();
    expect(state.players[1].deck).toHaveLength(0);
    expect(state.phase).toBe('Standby');
    expect(events.map((e) => e.type)).toEqual(['CardDrawn', 'PhaseChanged']);
  });

  it('empty deck on turn 1 does not lose when firstTurnDraw is false', () => {
    const { state, events } = applyAction(start(OPENING_HAND), endPhase(0));
    expect(state.winnerIndex).toBeNull();
    expect(state.phase).toBe('Standby');
    expect(events.map((e) => e.type)).toEqual(['PhaseChanged']);
  });

  it('empty deck on turn 1 loses when firstTurnDraw is true', () => {
    const { state, events } = applyAction(
      start(OPENING_HAND, { firstTurnDraw: true }),
      endPhase(0),
    );
    expect(state.winnerIndex).toBe(1);
    expect(events).toEqual(DECK_OUT_EVENTS(0));
  });

  it('empty deck does not lose when no draw is required (other phases)', () => {
    let s: GameState = { ...turnTwo(OPENING_HAND), phase: 'Main1' };
    for (let i = 0; i < 4; i++) {
      s = applyAction(s, endPhase(s.turnPlayerIndex)).state;
      expect(s.winnerIndex).toBeNull();
    }
  });

  it('a Draw action larger than the deck also ends the duel with DECK_OUT', () => {
    const s = start(OPENING_HAND + 2);
    const { state, events } = applyAction(s, draw(0, 3));
    expect(state.winnerIndex).toBe(1);
    expect(state.version).toBe(s.version + 1);
    expect(events).toEqual(DECK_OUT_EVENTS(0));
  });

  it('a Draw that exactly empties the deck is legal', () => {
    const { state } = applyAction(start(OPENING_HAND + 2), draw(0, 2));
    expect(state.winnerIndex).toBeNull();
    expect(state.players[0].deck).toHaveLength(0);
  });

  it('does not mutate the input state', () => {
    const s = deepFreeze(turnTwo(OPENING_HAND));
    expect(() => applyAction(s, endPhase(1))).not.toThrow();
  });

  describe('after deck-out', () => {
    const ended = () => applyAction(turnTwo(OPENING_HAND), endPhase(1)).state;

    it('blocks EndPhase, Draw and Surrender with DUEL_ENDED', () => {
      expectEngineError(() => applyAction(ended(), endPhase(1)), 'DUEL_ENDED');
      expectEngineError(() => applyAction(ended(), draw(0, 1)), 'DUEL_ENDED');
      expectEngineError(
        () => applyAction(ended(), { type: 'Surrender', payload: { playerIndex: 0 } }, ctx),
        'DUEL_ENDED',
      );
    });
  });

  it('a direct Draw is rejected with DUEL_ENDED once the duel has a winner', () => {
    expectEngineError(
      () => applyAction({ ...start(40), winnerIndex: 0 }, draw(1, 1)),
      'DUEL_ENDED',
    );
  });
});
