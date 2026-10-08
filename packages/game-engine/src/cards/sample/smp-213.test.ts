import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  attack,
  battle,
  lp,
  main,
  setSpellTrap,
  stats,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-213 (Tier B), Continuous Trap: face-up monsters you control gain 400 DEF. Set it, activate it from a
 * later turn (any phase); it stays face-up in its Spell/Trap Zone. `M1` is 1000 / 1000; SMP-008 has 1600 ATK.
 */

describe('SMP-213', () => {
  it('a Trap: not from the hand, not on the turn it was Set', () => {
    const start = main({ hand: ['SMP-213'] });
    expectEngineError(() => apply(start, activate('h0', 'activate')), 'TRAP_NOT_SET');
    const set = apply(start, setSpellTrap('h0', 0)).state;
    expectEngineError(() => apply(set, activate('h0', 'activate')), 'TRAP_SET_THIS_TURN');
  });

  it('Set on an earlier turn: flips, stays face-up, my monsters gain 400 DEF (ATK and the opponent`s do not)', () => {
    const before = main({
      mySpellTraps: [[1, 'SMP-213', 1]],
      myMonsters: [[0, 'M1']],
      oppMonsters: [[0, 'M1']],
    });
    const { state, events } = apply(before, activate('ms-1', 'activate'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[0].board.spellTrapZones[1]).toMatchObject({
      instanceId: 'ms-1',
      position: 'Attack',
    });
    expect(state.players[0].graveyard).toEqual([]);
    expect(stats(state, 0, 0)).toEqual({ atk: 1000, def: 1400 });
    expect(stats(state, 1, 0)).toEqual({ atk: 1000, def: 1000 });
    expect(events).toMatchSnapshot();
  });

  it("the wall holds on the opponent's side: SMP-008 (1600) bounces off a 1300 → 1700 DEF monster", () => {
    // Player 1 owns the Trap here, already face-up: built by activating it on player 1's Set copy in a chain window.
    const before = battle({
      hand: ['SMP-102'],
      myMonsters: [[0, 'SMP-008']],
      oppMonsters: [[0, 'SMP-017', 'DefenseUp']],
      oppSpellTraps: [[0, 'SMP-213']],
    });
    const waiting = apply(before, activate('h0', 'flash-burn')).state;
    expect(waiting.chainWindow).toMatchObject({ priorityPlayer: 1 });
    const on = apply(waiting, activate('os-0', 'activate', 1)).state;
    expect(on.players[1].board.spellTrapZones[0]).toMatchObject({ position: 'Attack' });
    expect(stats(on, 1, 0).def).toBe(1700);
    const { state, events } = apply(on, attack('m0-0', 'o0-0'));
    expect(types(events)).not.toContain('MonsterDestroyed');
    expect(lp(state)).toEqual([7900, 7500]);
  });

  it('face-up it cannot be activated again; its Continuous effect is never activated', () => {
    const before = main({ mySpellTraps: [[0, 'SMP-213', 1]] });
    expectEngineError(
      () => apply(before, activate('ms-0', 'shield-wall')),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
    const on = apply(before, activate('ms-0', 'activate')).state;
    expectEngineError(() => apply(on, activate('ms-0', 'activate')), 'NOT_ACTIVATABLE');
  });
});
