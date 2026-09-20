import { describe, it } from 'vitest';

/**
 * C11 contract (P3, task 3.4) — see docs/design/engine.md "Kích hoạt Trap/Spell".
 * [DECISION] Trap must be Set to activate; [RULE] not on the turn it was Set;
 * [RULE] normal Spell activates from hand in own Main Phase.
 * Quick-Play Spell: deferred to P3 (Speed 2), not covered here.
 */
describe('trap activation (C11)', () => {
  it.todo('trap in hand cannot be activated');
  it.todo('trap set this turn cannot be activated this turn');
  it.todo('set trap can be activated from the next turn');
  it.todo('normal spell can be activated from hand in Main Phase');
  it.todo('activating a trap in hand is rejected with TRAP_NOT_SET');
  it.todo('activating a trap set this turn is rejected with TRAP_SET_THIS_TURN');
  it.todo('legalActions never lists Activate for a trap in hand, only Set');
});
