import { describe, expect, it } from 'vitest';
import type { Action } from './actions/types.js';
import { applyAction } from './apply-action.js';
import { getLegalActions } from './legal-actions.js';
import { fixtureCtx, fixtureState } from './testing/effect-fixtures.js';

const ofType = (actions: Action[], type: Action['type']) => actions.filter((a) => a.type === type);

describe('getLegalActions — Spell/Trap (task 3.2)', () => {
  it('lists SetSpellTrap for every free zone of a Spell/Trap in hand, never for a monster', () => {
    const state = fixtureState({ hand: ['DRAW', 'M1'] });
    const sets = ofType(getLegalActions(state, 0, fixtureCtx), 'SetSpellTrap');
    expect(sets).toHaveLength(5);
    expect(sets.every((a) => a.type === 'SetSpellTrap' && a.payload.cardInstanceId === 'h0')).toBe(
      true,
    );
  });

  it('lists ActivateEffect for a Normal Spell (and not for a Trap, a Continuous Spell, or in the wrong phase)', () => {
    const activate = (hand: string[], phase: 'Main1' | 'Battle' = 'Main1') =>
      ofType(getLegalActions(fixtureState({ hand, phase }), 0, fixtureCtx), 'ActivateEffect');
    expect(activate(['DRAW'])).toEqual([
      { type: 'ActivateEffect', payload: { playerIndex: 0, cardInstanceId: 'h0', effectId: 'e1' } },
    ]);
    expect(activate(['TRAP'])).toEqual([]);
    expect(activate(['CONT'])).toEqual([]);
    expect(activate(['DRAW'], 'Battle')).toEqual([]);
  });

  it('enumerates cost selections and keeps only the payable ones', () => {
    const state = fixtureState({ hand: ['DISCARD_DRAW', 'M1', 'DRAW'] });
    const legal = ofType(getLegalActions(state, 0, fixtureCtx), 'ActivateEffect');
    const withCost = legal.filter(
      (a) => a.type === 'ActivateEffect' && a.payload.cardInstanceId === 'h0',
    );
    expect(
      withCost.map((a) => (a.type === 'ActivateEffect' ? a.payload.costInstanceIds : null)),
    ).toEqual([['h1'], ['h2']]);
  });

  it('lists a target prompt answer for every combination of candidates, only for the prompted seat', () => {
    const opened = applyAction(
      fixtureState({
        hand: ['KILL'],
        oppMonsters: [
          [0, 'M1'],
          [3, 'M2'],
        ],
      }),
      { type: 'ActivateEffect', payload: { playerIndex: 0, cardInstanceId: 'h0', effectId: 'e1' } },
      fixtureCtx,
    ).state;
    const mine = ofType(getLegalActions(opened, 0, fixtureCtx), 'ResolvePendingPrompt');
    expect(
      mine.map((a) => (a.type === 'ResolvePendingPrompt' ? a.payload.cardInstanceIds : null)),
    ).toEqual([['o0-0'], ['o0-3']]);
    expect(ofType(getLegalActions(opened, 1, fixtureCtx), 'ResolvePendingPrompt')).toEqual([]);
    // Nothing else but Surrender is possible while the prompt is open.
    expect(
      getLegalActions(opened, 0, fixtureCtx)
        .map((a) => a.type)
        .sort(),
    ).toEqual(['ResolvePendingPrompt', 'ResolvePendingPrompt', 'Surrender']);
  });
});
