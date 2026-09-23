import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import type { EndPhaseAction, StartDuelAction } from '../types.js';
import type { GameState, Phase } from '../../state/types.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { deepFreeze } from '../../testing/deep-freeze.js';

function deckOf(prefix: string, size: number): string[] {
  return Array.from({ length: size }, (_, i) => `${prefix}-${i}`);
}

function start(
  ruleset?: StartDuelAction['payload']['ruleset'],
  deckSize = 40,
  seed = 'seed-end-phase',
): GameState {
  return applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed,
      playerIds: ['alice', 'bob'],
      deckLists: [deckOf('A', deckSize), deckOf('B', deckSize)],
      ...(ruleset ? { ruleset } : {}),
    },
  }).state;
}

const endPhase = (playerIndex: 0 | 1): EndPhaseAction => ({
  type: 'EndPhase',
  payload: { playerIndex },
});

function step(state: GameState, n: number) {
  let current = state;
  const events = [];
  for (let i = 0; i < n; i++) {
    const r = applyAction(current, endPhase(current.turnPlayerIndex));
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

describe('EndPhase / phase order', () => {
  it('EndPhase advances through phases in order', () => {
    let state = start();
    const seen: Phase[] = [state.phase];
    for (let i = 0; i < 6; i++) {
      state = applyAction(state, endPhase(state.turnPlayerIndex)).state;
      seen.push(state.phase);
    }
    expect(seen).toEqual(['Draw', 'Standby', 'Main1', 'Battle', 'Main2', 'End', 'Draw']);
  });

  it('emits PhaseChanged for each step', () => {
    const { events } = applyAction(start(), endPhase(0));
    expect(events).toContainEqual({
      type: 'PhaseChanged',
      from: 'Draw',
      to: 'Standby',
      turnPlayerIndex: 0,
    });
  });

  it('bumps version once per action', () => {
    const state = start();
    expect(applyAction(state, endPhase(0)).state.version).toBe(state.version + 1);
  });
});

describe('EndPhase / turn 1 draw rule (G1)', () => {
  it('first player does not draw on turn 1', () => {
    const before = start();
    const { state, events } = applyAction(before, endPhase(0));

    expect(state.players[0].hand).toHaveLength(5);
    expect(state.players[0].deck).toHaveLength(35);
    expect(events.some((e) => e.type === 'CardDrawn')).toBe(false);
  });

  it('first player draws on turn 1 when firstTurnDraw is true', () => {
    const { state, events } = applyAction(start({ firstTurnDraw: true }), endPhase(0));

    expect(state.players[0].hand).toHaveLength(6);
    expect(events.filter((e) => e.type === 'CardDrawn')).toHaveLength(1);
  });

  it('second player draws on their first turn', () => {
    // 6 steps end turn 1; 1 more leaves Draw of turn 2 (draw happens on leaving Draw).
    const { state } = step(start(), 7);

    expect(state.turnCount).toBe(2);
    expect(state.turnPlayerIndex).toBe(1);
    expect(state.players[1].hand).toHaveLength(6);
    expect(state.players[1].deck).toHaveLength(34);
    expect(state.players[0].hand).toHaveLength(5);
  });

  it('first player draws normally on turn 3', () => {
    const { state } = step(start(), 13);

    expect(state.turnCount).toBe(3);
    expect(state.turnPlayerIndex).toBe(0);
    expect(state.players[0].hand).toHaveLength(6);
  });
});

describe('EndPhase / turn change', () => {
  it('swaps turn player, increments turnCount and resets to Draw', () => {
    const { state, events } = step(start(), 6);

    expect(state.turnCount).toBe(2);
    expect(state.turnPlayerIndex).toBe(1);
    expect(state.phase).toBe('Draw');
    expect(events).toContainEqual({ type: 'TurnChanged', turnCount: 2, turnPlayerIndex: 1 });
  });

  it('resets hasNormalSummonedThisTurn for both players', () => {
    const started = start();
    const dirty: GameState = {
      ...started,
      players: [
        { ...started.players[0], hasNormalSummonedThisTurn: true },
        { ...started.players[1], hasNormalSummonedThisTurn: true },
      ],
    };
    const { state } = step({ ...dirty, phase: 'End' }, 1);

    expect(state.players[0].hasNormalSummonedThisTurn).toBe(false);
    expect(state.players[1].hasNormalSummonedThisTurn).toBe(false);
  });
});

describe('EndPhase / deck-out and rejection', () => {
  it('ends the duel with DeckOut when the turn draw cannot be made', () => {
    const started = start({ firstTurnDraw: true }, 5);
    const { state, events } = applyAction(started, endPhase(0));

    expect(state.winnerIndex).toBe(1);
    expect(state.phase).toBe('Draw');
    expect(events).toEqual([
      { type: 'DeckOut', playerIndex: 0 },
      { type: 'DuelEnded', winnerIndex: 1, reason: 'DECK_OUT' },
    ]);
  });

  it('rejects an action from the non-turn player', () => {
    expectEngineError(() => applyAction(start(), endPhase(1)), 'NOT_TURN_PLAYER');
  });

  it('rejects once the duel has a winner', () => {
    const over: GameState = { ...start(), winnerIndex: 1 };
    expectEngineError(() => applyAction(over, endPhase(0)), 'DUEL_ENDED');
  });

  it('rejects while a prompt is pending', () => {
    const prompted: GameState = {
      ...start(),
      pendingPrompt: { promptId: 'p', playerIndex: 0, kind: 'X', payload: null },
    };
    expectEngineError(() => applyAction(prompted, endPhase(0)), 'PENDING_PROMPT');
  });

  it('requires an existing state', () => {
    expectEngineError(() => applyAction(null, endPhase(0)), 'NO_STATE');
  });
});

describe('EndPhase / purity', () => {
  it('is deterministic, immutable and JSON-serializable', () => {
    const before = start();
    const snapshot = JSON.stringify(before);
    const a = applyAction(before, endPhase(0));
    const b = applyAction(before, endPhase(0));

    expect(JSON.stringify(before)).toBe(snapshot);
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a.state))).toEqual(a.state);
  });
});

describe('EndPhase / no input mutation', () => {
  it('never mutates a deep-frozen input state across a full turn cycle (draw + turn change)', () => {
    let state = deepFreeze(start({ firstTurnDraw: true }));
    for (let i = 0; i < 14; i++) {
      state = deepFreeze(applyAction(state, endPhase(state.turnPlayerIndex)).state);
    }
    expect(state.turnCount).toBe(3);
  });
});
