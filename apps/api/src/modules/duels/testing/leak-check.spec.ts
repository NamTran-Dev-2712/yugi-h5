import type { CardInstance, GameState } from '@yugi/game-engine';
import { applyAction } from '@yugi/game-engine';
import { describe, expect, it } from 'vitest';
import { collectDefinitionIds, findLeaks } from './leak-check';

const base = (): GameState =>
  applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed: 's',
      playerIds: ['a', 'b'],
      deckLists: [Array(10).fill('A'), Array(10).fill('B')],
    },
  }).state;

const card = (
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1,
  position: CardInstance['position'],
): CardInstance => ({ instanceId, definitionId, ownerIndex, position });

/** Player 1 has a face-down Spell and a face-up monster; player 0 a face-down monster; one card in each graveyard. */
function state(): GameState {
  const s = base();
  const [p0, p1] = s.players;
  return {
    ...s,
    players: [
      {
        ...p0,
        graveyard: [card('g0', 'GY-0', 0, null)],
        board: {
          ...p0.board,
          monsterZones: [card('m0', 'SET-MON', 0, 'DefenseDown'), null, null, null, null],
        },
      },
      {
        ...p1,
        board: {
          ...p1.board,
          monsterZones: [card('m1', 'UP-MON', 1, 'Attack'), null, null, null, null],
          spellTrapZones: [card('s1', 'SET-SPELL', 1, 'DefenseDown'), null, null, null, null],
        },
      },
    ],
  };
}

describe('collectDefinitionIds', () => {
  it('finds definitionIds at any depth, with the instanceId next to them', () => {
    const found = collectDefinitionIds({
      a: [{ x: { instanceId: 'i1', definitionId: 'D1' } }],
      b: { definitionId: 'D2' },
    });
    expect(found).toEqual([
      { path: '$.a[0].x', instanceId: 'i1', definitionId: 'D1' },
      { path: '$.b', instanceId: null, definitionId: 'D2' },
    ]);
  });
});

describe('findLeaks', () => {
  it('accepts public and own cards', () => {
    const s = state();
    const hand0 = s.players[0].hand[0]!;
    const payload = [
      { instanceId: 'g0', definitionId: 'GY-0' },
      { instanceId: 'm1', definitionId: 'UP-MON' },
      { instanceId: 'm0', definitionId: 'SET-MON' }, // own face-down card, seen by its owner
      { instanceId: hand0.instanceId, definitionId: hand0.definitionId },
    ];
    expect(findLeaks(s, 0, payload)).toEqual([]);
  });

  it('flags a face-down card of the opponent (Set Spell and Set monster)', () => {
    const s = state();
    expect(findLeaks(s, 0, { instanceId: 's1', definitionId: 'SET-SPELL' })).toMatchObject([
      { reason: 'card is face-down on the opponent field' },
    ]);
    expect(findLeaks(s, 1, { e: { instanceId: 'm0', definitionId: 'SET-MON' } })).toHaveLength(1);
  });

  it("flags a card in the opponent's hand, and a deck card even for its owner", () => {
    const s = state();
    const hand1 = s.players[1].hand[0]!;
    const deck0 = s.players[0].deck[0]!;
    expect(
      findLeaks(s, 0, { instanceId: hand1.instanceId, definitionId: hand1.definitionId }),
    ).toHaveLength(1);
    expect(
      findLeaks(s, 0, { instanceId: deck0.instanceId, definitionId: deck0.definitionId }),
    ).toMatchObject([{ reason: 'card is in a deck' }]);
  });

  it('flags an unknown instance, a wrong definitionId and an unpaired definitionId', () => {
    const s = state();
    expect(findLeaks(s, 0, { instanceId: 'nope', definitionId: 'X' })[0]?.reason).toBe(
      'unknown instance',
    );
    expect(findLeaks(s, 0, { instanceId: 'g0', definitionId: 'OTHER' })[0]?.reason).toMatch(
      /wrong definitionId/,
    );
    expect(findLeaks(s, 0, { candidates: [{ definitionId: 'SET-SPELL' }] })[0]?.reason).toBe(
      'definitionId without instanceId',
    );
  });
});
