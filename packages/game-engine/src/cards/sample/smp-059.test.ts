import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  attack,
  battle,
  lp,
  main,
  stats,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-059 Rampart Mason (Tier B, Rock, DEF 1700): Continuous — face-up Rock monsters its controller controls
 * (itself included) gain 400 DEF. SMP-002 is a Rock (DEF 2400); the filler `M1` is a Warrior; `BIG` has 2000 ATK.
 */

describe('SMP-059 Rampart Mason', () => {
  it('my Rocks gain 400 DEF, itself included; ATK, other races and the opponent`s Rocks are untouched', () => {
    const state = main({
      myMonsters: [
        [0, 'SMP-059'],
        [1, 'SMP-002'],
        [2, 'M1'],
      ],
      oppMonsters: [[0, 'SMP-002']],
    });
    expect(stats(state, 0, 0)).toEqual({ atk: 800, def: 2100 });
    expect(stats(state, 0, 1)).toEqual({ atk: 1800, def: 2800 });
    expect(stats(state, 0, 2).def).toBe(1000);
    expect(stats(state, 1, 0).def).toBe(2400);
  });

  it('the wall holds: BIG (2000) attacks it in Defense (1700 + 400) — not destroyed, the attacker takes 100', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[0, 'SMP-059', 'DefenseUp']],
    });
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(types(events)).toEqual(['AttackDeclared', 'DamageDealt']);
    expect(state.players[1].board.monsterZones[0]).not.toBeNull();
    expect(lp(state)).toEqual([7900, 8000]);
    expect(events).toMatchSnapshot();
  });

  it('attacked while face-down: it is flipped first, then its own bonus counts', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[0, 'SMP-059', 'DefenseDown']],
    });
    expect(stats(before, 1, 0).def).toBe(1700); // face-down: printed value
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(types(events)).toContain('MonsterFlipped');
    expect(types(events)).not.toContain('MonsterDestroyed');
    expect(lp(state)).toEqual([7900, 8000]);
  });

  it('a Continuous effect is never activated', () => {
    const state = main({ myMonsters: [[0, 'SMP-059']] });
    expectEngineError(
      () => apply(state, activate('m0-0', 'raise-ramparts')),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
  });
});
