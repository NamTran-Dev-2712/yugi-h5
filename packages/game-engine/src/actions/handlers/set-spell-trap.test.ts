import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import type { SetSpellTrapAction } from '../types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState } from '../../testing/effect-fixtures.js';

const set = (
  cardInstanceId: string,
  zoneIndex = 0,
  playerIndex: 0 | 1 = 0,
): SetSpellTrapAction => ({
  type: 'SetSpellTrap',
  payload: { playerIndex, cardInstanceId, zoneIndex },
});

describe('SetSpellTrap', () => {
  it('sets a Spell face-down in the chosen zone, stamps the turn, leaves the hand', () => {
    const state = deepFreeze(fixtureState({ hand: ['DRAW', 'M1'] }));
    const { state: next, events } = applyAction(state, set('h0', 2), fixtureCtx);
    const placed = next.players[0].board.spellTrapZones[2];
    expect(placed).toEqual({
      instanceId: 'h0',
      definitionId: 'DRAW',
      ownerIndex: 0,
      position: 'DefenseDown',
      setTurn: state.turnCount,
    });
    expect(next.players[0].hand.map((c) => c.instanceId)).toEqual(['h1']);
    expect(next.version).toBe(state.version + 1);
    expect(events).toEqual([
      { type: 'SpellTrapSet', playerIndex: 0, instanceId: 'h0', zoneIndex: 2 },
    ]);
  });

  it('the event never carries a definitionId (the card is face-down)', () => {
    const { events } = applyAction(fixtureState({ hand: ['TRAP'] }), set('h0'), fixtureCtx);
    expect(JSON.stringify(events)).not.toContain('TRAP');
  });

  it('sets a Trap too, in Main2, and any number of times per turn without using the Normal Summon', () => {
    let state = fixtureState({ hand: ['TRAP', 'DRAW', 'HEAL'], phase: 'Main2' });
    state = applyAction(state, set('h0', 0), fixtureCtx).state;
    state = applyAction(state, set('h1', 1), fixtureCtx).state;
    state = applyAction(state, set('h2', 2), fixtureCtx).state;
    expect(state.players[0].board.spellTrapZones.filter((c) => c !== null)).toHaveLength(3);
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(false);
  });

  it('rejects: wrong phase, not your turn, occupied zone, bad zone, not in hand, monster, unknown card', () => {
    const base = fixtureState({ hand: ['DRAW', 'M1', 'DRAW'] });
    expectEngineError(
      () => applyAction({ ...base, phase: 'Battle' }, set('h0'), fixtureCtx),
      'WRONG_PHASE',
    );
    expectEngineError(() => applyAction(base, set('h0', 0, 1), fixtureCtx), 'NOT_TURN_PLAYER');
    expectEngineError(() => applyAction(base, set('h0', 5), fixtureCtx), 'INVALID_ZONE');
    expectEngineError(() => applyAction(base, set('h0', -1), fixtureCtx), 'INVALID_ZONE');
    expectEngineError(() => applyAction(base, set('h0', 1.5), fixtureCtx), 'INVALID_ZONE');
    expectEngineError(() => applyAction(base, set('nope'), fixtureCtx), 'CARD_NOT_IN_HAND');
    expectEngineError(() => applyAction(base, set('h1'), fixtureCtx), 'NOT_A_SPELL_TRAP');
    const occupied = applyAction(base, set('h0', 3), fixtureCtx).state;
    expectEngineError(() => applyAction(occupied, set('h2', 3), fixtureCtx), 'ZONE_OCCUPIED');
    expectEngineError(
      () =>
        applyAction(
          {
            ...base,
            players: [
              {
                ...base.players[0],
                hand: [{ ...base.players[0].hand[0]!, definitionId: 'GHOST' }],
              },
              base.players[1],
            ],
          },
          set('h0'),
          fixtureCtx,
        ),
      'CARD_DEFINITION_NOT_FOUND',
    );
  });

  it('rejects when the duel ended or a prompt is pending; needs a resolver', () => {
    const base = fixtureState({ hand: ['DRAW'] });
    expectEngineError(
      () => applyAction({ ...base, winnerIndex: 1 }, set('h0'), fixtureCtx),
      'DUEL_ENDED',
    );
    expectEngineError(
      () =>
        applyAction(
          {
            ...base,
            pendingPrompt: {
              promptId: 'x',
              playerIndex: 0,
              kind: 'DiscardToHandLimit',
              payload: { count: 1 },
            },
          },
          set('h0'),
          fixtureCtx,
        ),
      'PENDING_PROMPT',
    );
    expectEngineError(() => applyAction(base, set('h0'), undefined as never), 'NO_CARD_RESOLVER');
  });

  it('a rejected action leaves the input state untouched (frozen)', () => {
    const state = deepFreeze(fixtureState({ hand: ['DRAW'] }));
    expectEngineError(() => applyAction(state, set('h0', 9), fixtureCtx), 'INVALID_ZONE');
  });
});
