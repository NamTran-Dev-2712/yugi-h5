import { describe, expect, it } from 'vitest';
import { applyAction } from './apply-action.js';
import { DEFAULT_RULESET } from '@yugi/shared';
import type { StartDuelAction, DrawAction } from './actions/types.js';

function deckOf(prefix: string, size: number): string[] {
  return Array.from({ length: size }, (_, i) => `${prefix}-${i}`);
}

function startDuelAction(
  seed: string,
  ruleset?: StartDuelAction['payload']['ruleset'],
  startingLP?: StartDuelAction['payload']['startingLP'],
): StartDuelAction {
  return {
    type: 'StartDuel',
    payload: {
      matchId: 'match-1',
      seed,
      playerIds: ['alice', 'bob'],
      deckLists: [deckOf('A', 40), deckOf('B', 40)],
      ...(ruleset ? { ruleset } : {}),
      ...(startingLP ? { startingLP } : {}),
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

describe('applyAction / StartDuel per-side life points (C2 [DECISION])', () => {
  it('defaults both players to 8000 LP and a 5-card hand', () => {
    const { state } = applyAction(null, startDuelAction('seed-lp'));

    expect(state.players[0].lifePoints).toBe(8000);
    expect(state.players[1].lifePoints).toBe(8000);
    expect(state.players[0].hand).toHaveLength(5);
    expect(state.ruleset.extraMonsterZones).toBe(0);
  });

  it('lets StartDuel override life points per side', () => {
    const { state } = applyAction(null, startDuelAction('seed-lp', undefined, [10000, 8000]));

    expect(state.players[0].lifePoints).toBe(10000);
    expect(state.players[1].lifePoints).toBe(8000);
    expect(state.ruleset.startingLP).toBe(8000);
  });

  it('per-side LP overrides the ruleset startingLP', () => {
    const { state } = applyAction(
      null,
      startDuelAction('seed-lp', { startingLP: 4000 }, [6000, 4000]),
    );

    expect(state.players.map((p) => p.lifePoints)).toEqual([6000, 4000]);
  });

  it.each([[0], [-5], [1.5], [Number.NaN]])('rejects invalid LP override %s', (bad) => {
    expect(() => applyAction(null, startDuelAction('seed-lp', undefined, [bad, 8000]))).toThrow(
      /startingLP/,
    );
  });

  it('is reproducible for the same seed and per-side LP', () => {
    const a = applyAction(null, startDuelAction('seed-x', undefined, [9000, 7000]));
    const b = applyAction(null, startDuelAction('seed-x', undefined, [9000, 7000]));

    expect(a.state).toEqual(b.state);
  });
});

describe('applyAction / StartDuel ruleset', () => {
  it('stores the resolved default ruleset in state', () => {
    const { state } = applyAction(null, startDuelAction('seed-rules'));

    expect(state.ruleset).toEqual(DEFAULT_RULESET);
  });

  it('applies ruleset overrides passed to StartDuel', () => {
    const { state } = applyAction(
      null,
      startDuelAction('seed-rules', { startingLP: 4000, openingHandSize: 6 }),
    );

    expect(state.players[0].lifePoints).toBe(4000);
    expect(state.players[1].lifePoints).toBe(4000);
    expect(state.players[0].hand).toHaveLength(6);
    expect(state.players[0].deck).toHaveLength(34);
    expect(state.ruleset.handLimit).toBe(DEFAULT_RULESET.handLimit);
  });

  it('keeps state JSON-serializable and reproducible for the same seed and ruleset', () => {
    const run1 = applyAction(null, startDuelAction('seed-json', { startingLP: 5000 }));
    const run2 = applyAction(null, startDuelAction('seed-json', { startingLP: 5000 }));

    expect(JSON.parse(JSON.stringify(run1.state))).toEqual(run1.state);
    expect(run1.state).toEqual(run2.state);
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
