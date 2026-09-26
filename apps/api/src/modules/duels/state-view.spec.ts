import { applyAction, type CardInstance, type GameState } from '@yugi/game-engine';
import { describe, expect, it } from 'vitest';
import { toStateView } from './state-view';

const card = (
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1,
  position: CardInstance['position'],
): CardInstance => ({ instanceId, definitionId, ownerIndex, position });

function baseState(): GameState {
  const deck = (p: string) => Array.from({ length: 12 }, (_, i) => `${p}-DECK-${i}`);
  return applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm1',
      seed: 'view-seed',
      playerIds: ['alice', 'bob'],
      deckLists: [deck('A'), deck('B')],
    },
  }).state;
}

/** Same duel with board/graveyard populated so every hidden/visible case is exercised. */
function richState(): GameState {
  const s = baseState();
  const [p0, p1] = s.players;
  return {
    ...s,
    players: [
      {
        ...p0,
        graveyard: [card('p0-gy', 'A-GRAVE', 0, null)],
        board: {
          ...p0.board,
          monsterZones: [
            card('p0-m0', 'A-FACEUP', 0, 'Attack'),
            card('p0-m1', 'A-FACEDOWN', 0, 'DefenseDown'),
            null,
            null,
            null,
          ],
          spellTrapZones: [card('p0-st0', 'A-SETSPELL', 0, 'DefenseDown'), null, null, null, null],
        },
      },
      {
        ...p1,
        graveyard: [card('p1-gy', 'B-GRAVE', 1, null)],
        board: {
          ...p1.board,
          monsterZones: [
            card('p1-m0', 'B-FACEUP', 1, 'DefenseUp'),
            card('p1-m1', 'B-FACEDOWN', 1, 'DefenseDown'),
            null,
            null,
            null,
          ],
          spellTrapZones: [card('p1-st0', 'B-SETTRAP', 1, 'DefenseDown'), null, null, null, null],
        },
      },
    ],
  };
}

describe('toStateView', () => {
  it('shows the viewer their own hand in full and the opponent hand as hidden cards', () => {
    const s = richState();
    const v0 = toStateView(s, 0);
    expect(v0.players[0].hand).toEqual(
      s.players[0].hand.map((c) => ({
        hidden: false,
        instanceId: c.instanceId,
        definitionId: c.definitionId,
        position: c.position,
        ownerIndex: 0,
      })),
    );
    expect(v0.players[1].hand).toHaveLength(s.players[1].hand.length);
    expect(v0.players[1].handCount).toBe(s.players[1].hand.length);
    for (const c of v0.players[1].hand) expect(c.hidden).toBe(true);
    expect(v0.players[1].hand.map((c) => c.instanceId)).toEqual(
      s.players[1].hand.map((c) => c.instanceId),
    );
  });

  it('is symmetric: viewer 1 sees own hand and a hidden hand for player 0', () => {
    const s = richState();
    const v1 = toStateView(s, 1);
    expect(v1.viewerIndex).toBe(1);
    expect(v1.players[1].hand.every((c) => !c.hidden)).toBe(true);
    expect(v1.players[0].hand.every((c) => c.hidden)).toBe(true);
    expect(v1.players[0].handCount).toBe(s.players[0].hand.length);
  });

  it('never exposes deck contents to anyone, only counts', () => {
    const s = richState();
    for (const viewer of [0, 1] as const) {
      const v = toStateView(s, viewer);
      expect(v.players[0].deckCount).toBe(s.players[0].deck.length);
      expect(v.players[1].deckCount).toBe(s.players[1].deck.length);
      expect(v.players[0]).not.toHaveProperty('deck');
      expect(v.players[1]).not.toHaveProperty('deck');
    }
  });

  it('keeps graveyards and face-up field cards fully visible to both viewers', () => {
    const s = richState();
    for (const viewer of [0, 1] as const) {
      const v = toStateView(s, viewer);
      expect(v.players[0].graveyard[0]).toMatchObject({ hidden: false, definitionId: 'A-GRAVE' });
      expect(v.players[1].graveyard[0]).toMatchObject({ hidden: false, definitionId: 'B-GRAVE' });
      expect(v.players[0].board.monsterZones[0]).toMatchObject({
        hidden: false,
        definitionId: 'A-FACEUP',
        position: 'Attack',
      });
      expect(v.players[1].board.monsterZones[0]).toMatchObject({
        hidden: false,
        definitionId: 'B-FACEUP',
        position: 'DefenseUp',
      });
    }
  });

  it('shows own face-down cards but hides the opponent face-down monster and spell/trap', () => {
    const s = richState();
    const v0 = toStateView(s, 0);
    expect(v0.players[0].board.monsterZones[1]).toMatchObject({
      hidden: false,
      definitionId: 'A-FACEDOWN',
      position: 'DefenseDown',
    });
    expect(v0.players[0].board.spellTrapZones[0]).toMatchObject({
      hidden: false,
      definitionId: 'A-SETSPELL',
    });
    expect(v0.players[1].board.monsterZones[1]).toEqual({
      hidden: true,
      instanceId: 'p1-m1',
      ownerIndex: 1,
    });
    expect(v0.players[1].board.spellTrapZones[0]).toEqual({
      hidden: true,
      instanceId: 'p1-st0',
      ownerIndex: 1,
    });
    expect(v0.players[1].board.monsterZones[2]).toBeNull();
  });

  it('fails closed: opponent spell/trap with no face-up marker (position null) is hidden', () => {
    const s = richState();
    const [p0, p1] = s.players;
    const tweaked: GameState = {
      ...s,
      players: [
        p0,
        {
          ...p1,
          board: {
            ...p1.board,
            spellTrapZones: [card('p1-st1', 'B-UNKNOWN', 1, null), null, null, null, null],
          },
        },
      ],
    };
    expect(toStateView(tweaked, 0).players[1].board.spellTrapZones[0]).toEqual({
      hidden: true,
      instanceId: 'p1-st1',
      ownerIndex: 1,
    });
  });

  it('does not leak hidden definitionIds anywhere in the serialized view', () => {
    const s = richState();
    const json = JSON.stringify(toStateView(s, 0));
    const secrets = [
      'B-FACEDOWN',
      'B-SETTRAP',
      ...s.players[1].hand.map((c) => c.definitionId),
      ...s.players[1].deck.map((c) => c.definitionId),
    ];
    for (const secret of secrets) expect(json).not.toContain(secret);
    expect(json).not.toContain('"rng"');
    expect(json).not.toContain('chainStack');
    const json1 = JSON.stringify(toStateView(s, 1));
    expect(json1).not.toContain('A-FACEDOWN');
    expect(json1).not.toContain('A-SETSPELL');
  });

  it('passes public fields through unchanged', () => {
    const s = { ...richState(), turnCount: 3, phase: 'Main1' as const, version: 42 };
    const v = toStateView(s, 1);
    expect(v).toMatchObject({
      matchId: 'm1',
      version: 42,
      turnCount: 3,
      turnPlayerIndex: s.turnPlayerIndex,
      phase: 'Main1',
      winnerIndex: null,
      pendingPrompt: null,
      ruleset: s.ruleset,
    });
    expect(v.players[0]).toMatchObject({ playerId: 'alice', lifePoints: s.players[0].lifePoints });
    expect(v.players[1]).toMatchObject({ playerId: 'bob', hasNormalSummonedThisTurn: false });
  });

  it('does not mutate the input and is deterministic', () => {
    const s = richState();
    const snapshot = JSON.stringify(s);
    const a = toStateView(s, 0);
    const b = toStateView(s, 0);
    expect(JSON.stringify(s)).toBe(snapshot);
    expect(a).toEqual(b);
  });

  it.each([0, 1, 'draw'] as const)('works after the duel ended (winnerIndex=%s)', (winner) => {
    const s = { ...richState(), winnerIndex: winner };
    for (const viewer of [0, 1] as const) {
      const v = toStateView(s, viewer);
      expect(v.winnerIndex).toBe(winner);
      expect(v.players[viewer === 0 ? 1 : 0].hand.every((c) => c.hidden)).toBe(true);
    }
  });

  it('passes a pending prompt through (public) while hiding the rest', () => {
    const s: GameState = {
      ...richState(),
      pendingPrompt: {
        promptId: 'discard-1',
        playerIndex: 0,
        kind: 'DiscardToHandLimit',
        payload: { count: 1 },
      },
    };
    expect(toStateView(s, 1).pendingPrompt).toEqual(s.pendingPrompt);
  });

  describe('pending prompt payload (deny by default for the player who is not asked)', () => {
    const targetPrompt = {
      promptId: 'effect-3-9',
      playerIndex: 0 as const,
      kind: 'SelectEffectTarget',
      payload: {
        cardInstanceId: 'p0-7',
        effectId: 'e1',
        costInstanceIds: ['p0-8'],
        candidateInstanceIds: ['p1-3', 'p1-4'],
        count: 1,
      },
    };

    it('gives the prompted player the full SelectEffectTarget payload', () => {
      const s: GameState = { ...richState(), pendingPrompt: targetPrompt };
      expect(toStateView(s, 0).pendingPrompt).toEqual(targetPrompt);
    });

    it('hides the SelectEffectTarget payload (which hand card is being activated) from the other player', () => {
      const s: GameState = { ...richState(), pendingPrompt: targetPrompt };
      const seen = toStateView(s, 1).pendingPrompt;
      expect(seen).toEqual({
        promptId: 'effect-3-9',
        playerIndex: 0,
        kind: 'SelectEffectTarget',
        payload: null,
      });
      expect(JSON.stringify(seen)).not.toContain('p0-7');
    });

    it('hides the payload of an unknown prompt kind from the other player', () => {
      const s: GameState = {
        ...richState(),
        pendingPrompt: {
          promptId: 'x',
          playerIndex: 1,
          kind: 'FutureKind',
          payload: { secret: 1 },
        },
      };
      expect(toStateView(s, 0).pendingPrompt?.payload).toBeNull();
      expect(toStateView(s, 1).pendingPrompt?.payload).toEqual({ secret: 1 });
    });
  });

  it('hides the opponent field zone card when it has no face-up marker', () => {
    const s = richState();
    const [p0, p1] = s.players;
    const withField: GameState = {
      ...s,
      players: [p0, { ...p1, board: { ...p1.board, fieldZone: card('p1-f', 'B-FIELD', 1, null) } }],
    };
    expect(toStateView(withField, 0).players[1].board.fieldZone).toEqual({
      hidden: true,
      instanceId: 'p1-f',
      ownerIndex: 1,
    });
  });
});
