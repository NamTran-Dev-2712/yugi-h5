import { applyAction, type GameState } from '@yugi/game-engine';
import type { PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { hiddenIdsFor, redactAction } from './visibility';

/** Task 4.2d: which instance ids a viewer may not be pointed at, and the AI action redaction built on it. */

function base(): GameState {
  const deck = (p: string) => Array.from({ length: 10 }, () => p);
  return applyAction(null, {
    type: 'StartDuel',
    payload: { matchId: 'm', seed: 's', playerIds: ['a', 'b'], deckLists: [deck('A'), deck('B')] },
  }).state;
}

describe('hiddenIdsFor', () => {
  it("is the opponent's hand plus both decks and Extra Decks, never the viewer's own hand", () => {
    const s = base();
    for (const viewer of [0, 1] as const) {
      const hidden = hiddenIdsFor(s, viewer);
      const other = s.players[1 - viewer]!;
      const own = s.players[viewer]!;
      for (const c of other.hand) expect(hidden.has(c.instanceId)).toBe(true);
      for (const c of own.hand) expect(hidden.has(c.instanceId)).toBe(false);
      for (const p of s.players)
        for (const c of p.deck) expect(hidden.has(c.instanceId)).toBe(true);
      expect(hidden.size).toBe(
        other.hand.length + s.players[0].deck.length + s.players[1].deck.length,
      );
    }
  });

  it('does not contain field, graveyard or chain cards', () => {
    const s = base();
    const moved = s.players[1].hand[0]!;
    const next: GameState = {
      ...s,
      players: [
        s.players[0],
        { ...s.players[1], hand: s.players[1].hand.slice(1), graveyard: [moved] },
      ],
    };
    expect(hiddenIdsFor(next, 0).has(moved.instanceId)).toBe(false);
  });
});

describe('redactAction', () => {
  const answer = (ids: string[]): PlayerAction => ({
    type: 'ResolvePendingPrompt',
    payload: { playerIndex: 1, promptId: 'p', cardInstanceIds: ids },
  });

  it('drops hidden ids from a prompt answer, keeps the rest in order', () => {
    expect(redactAction(answer(['a', 'h', 'b']), new Set(['h']))).toEqual(answer(['a', 'b']));
  });

  it('returns the very same object when nothing is hidden', () => {
    const a = answer(['a']);
    expect(redactAction(a, new Set(['h']))).toBe(a);
    const summon: PlayerAction = {
      type: 'NormalSummon',
      payload: { playerIndex: 1, cardInstanceId: 'h', zoneIndex: 0 },
    };
    expect(redactAction(summon, new Set(['h']))).toBe(summon);
  });

  it('drops hidden cost ids of an activation too', () => {
    const act: PlayerAction = {
      type: 'ActivateEffect',
      payload: { playerIndex: 1, cardInstanceId: 'c', effectId: 'e', costInstanceIds: ['h', 'g'] },
    };
    expect(redactAction(act, new Set(['h']))).toEqual({
      ...act,
      payload: { ...act.payload, costInstanceIds: ['g'] },
    });
  });
});
