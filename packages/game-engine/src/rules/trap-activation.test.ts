import { describe, expect, it } from 'vitest';
import { applyAction } from '../apply-action.js';
import { getLegalActions } from '../legal-actions.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState } from '../testing/effect-fixtures.js';

/**
 * C11 contract (P3, task 3.4) — see docs/design/engine.md "Kích hoạt Trap/Spell".
 * [DECISION] Trap must be Set to activate; [RULE] not on the turn it was Set;
 * [RULE] normal Spell activates from hand in own Main Phase.
 * Quick-Play Spell: deferred to P3 (Speed 2), not covered here.
 * Task 3.2 covers the hand side (Trap in hand, Normal Spell from hand); activating a SET Trap is task 3.4.
 */
describe('trap activation (C11)', () => {
  const activate = {
    type: 'ActivateEffect',
    payload: { playerIndex: 0, cardInstanceId: 'h0', effectId: 'e1' },
  } as const;

  it('trap in hand cannot be activated', () => {
    const state = fixtureState({ hand: ['TRAP'] });
    expectEngineError(() => applyAction(state, activate, fixtureCtx), 'TRAP_NOT_SET');
  });
  it.todo('trap set this turn cannot be activated this turn');
  it.todo('set trap can be activated from the next turn');
  it('normal spell can be activated from hand in Main Phase', () => {
    const state = fixtureState({ hand: ['DRAW'] });
    expect(() => applyAction(state, activate, fixtureCtx)).not.toThrow();
  });
  it('activating a trap in hand is rejected with TRAP_NOT_SET', () => {
    const state = fixtureState({ hand: ['TRAP'] });
    expectEngineError(() => applyAction(state, activate, fixtureCtx), 'TRAP_NOT_SET');
  });
  it.todo('activating a trap set this turn is rejected with TRAP_SET_THIS_TURN');
  it('legalActions never lists Activate for a trap in hand, only Set', () => {
    const state = fixtureState({ hand: ['TRAP'] });
    const legal = getLegalActions(state, 0, fixtureCtx);
    expect(legal.some((a) => a.type === 'ActivateEffect')).toBe(false);
    expect(legal.some((a) => a.type === 'SetSpellTrap')).toBe(true);
  });
});
