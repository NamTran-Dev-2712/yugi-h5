import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import type { GameState, Phase } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import type { ActionContext, SurrenderAction } from '../types.js';

const ctx: ActionContext = { cardDefinitions: () => undefined };

function duel(overrides: Partial<GameState> = {}): GameState {
  const started = applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed: 'seed-surrender',
      playerIds: ['alice', 'bob'],
      deckLists: [
        Array.from({ length: 40 }, (_, i) => `D-${i}`),
        Array.from({ length: 40 }, (_, i) => `D-${i}`),
      ],
    },
  }).state;
  return { ...started, phase: 'Main1', ...overrides };
}

const surrender = (playerIndex: 0 | 1): SurrenderAction => ({
  type: 'Surrender',
  payload: { playerIndex },
});

describe('Surrender', () => {
  it('turn player surrenders → opponent wins', () => {
    const state = duel({ turnPlayerIndex: 0 });
    const { state: next, events } = applyAction(state, surrender(0), ctx);
    expect(next.winnerIndex).toBe(1);
    expect(events).toEqual([{ type: 'DuelEnded', winnerIndex: 1, reason: 'SURRENDER' }]);
  });

  it('non-turn player may surrender → turn player wins', () => {
    const state = duel({ turnPlayerIndex: 0 });
    const { state: next, events } = applyAction(state, surrender(1), ctx);
    expect(next.winnerIndex).toBe(0);
    expect(events).toEqual([{ type: 'DuelEnded', winnerIndex: 0, reason: 'SURRENDER' }]);
  });

  it.each<Phase>(['Draw', 'Standby', 'Main1', 'Battle', 'Main2', 'End'])(
    'is allowed in %s phase',
    (phase) => {
      const { state: next } = applyAction(duel({ phase }), surrender(0), ctx);
      expect(next.winnerIndex).toBe(1);
    },
  );

  it('is allowed while a prompt is pending', () => {
    const state = duel({
      pendingPrompt: { promptId: 'p', playerIndex: 1, kind: 'X', payload: null },
    });
    expect(applyAction(state, surrender(0), ctx).state.winnerIndex).toBe(1);
  });

  it('works without ActionContext', () => {
    expect(applyAction(duel(), surrender(1)).state.winnerIndex).toBe(0);
  });

  it.each<[string, GameState['winnerIndex']]>([
    ['player 0 won', 0],
    ['player 1 won', 1],
    ['a draw', 'draw'],
  ])('is rejected with DUEL_ENDED after %s', (_label, winnerIndex) => {
    expectEngineError(() => applyAction(duel({ winnerIndex }), surrender(0), ctx), 'DUEL_ENDED');
  });

  it('cannot surrender twice', () => {
    const { state: ended } = applyAction(duel(), surrender(0), ctx);
    expectEngineError(() => applyAction(ended, surrender(1), ctx), 'DUEL_ENDED');
  });

  describe('allowSurrender ruleset flag', () => {
    const disabled = (overrides: Partial<GameState> = {}): GameState => {
      const state = duel(overrides);
      return { ...state, ruleset: { ...state.ruleset, allowSurrender: false } };
    };

    it.each<0 | 1>([0, 1])('rejects player %i with SURRENDER_DISABLED when disabled', (who) => {
      expectEngineError(() => applyAction(disabled(), surrender(who), ctx), 'SURRENDER_DISABLED');
    });

    it('reports DUEL_ENDED before SURRENDER_DISABLED once the duel is over', () => {
      expectEngineError(
        () => applyAction(disabled({ winnerIndex: 0 }), surrender(1), ctx),
        'DUEL_ENDED',
      );
    });

    it('leaves state untouched when rejected', () => {
      const state = deepFreeze(disabled());
      expectEngineError(() => applyAction(state, surrender(0), ctx), 'SURRENDER_DISABLED');
      expect(state.winnerIndex).toBeNull();
    });

    it('is allowed when explicitly enabled', () => {
      const state = duel();
      const enabled = { ...state, ruleset: { ...state.ruleset, allowSurrender: true } };
      expect(applyAction(enabled, surrender(0), ctx).state.winnerIndex).toBe(1);
    });
  });

  it('blocks later actions with DUEL_ENDED', () => {
    const { state: ended } = applyAction(duel(), surrender(0), ctx);
    expectEngineError(
      () => applyAction(ended, { type: 'EndPhase', payload: { playerIndex: 0 } }),
      'DUEL_ENDED',
    );
  });

  it('changes only winnerIndex and version; does not mutate input', () => {
    const state = deepFreeze(duel());
    const { state: next } = applyAction(state, surrender(0), ctx);
    expect(next).toEqual({ ...state, winnerIndex: 1, version: state.version + 1 });
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
  });
});
