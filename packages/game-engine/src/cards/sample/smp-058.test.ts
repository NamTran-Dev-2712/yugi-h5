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
 * Task 4.7 — SMP-058 Gloam Devourer (Tier B, DARK, ATK 1600): Continuous — face-up LIGHT monsters the opponent controls
 * lose 400 ATK. SMP-017 is LIGHT (ATK 1800), SMP-004 LIGHT (ATK 700); the filler `M1` is EARTH.
 */

describe('SMP-058 Gloam Devourer', () => {
  it("the opponent's LIGHT monsters lose 400 ATK; other attributes and my own LIGHT monsters do not", () => {
    const state = main({
      myMonsters: [
        [0, 'SMP-058'],
        [1, 'SMP-004'],
      ],
      oppMonsters: [
        [0, 'SMP-017'],
        [1, 'M1'],
      ],
    });
    expect(stats(state, 1, 0)).toEqual({ atk: 1400, def: 1300 });
    expect(stats(state, 1, 1).atk).toBe(1000);
    expect(stats(state, 0, 1).atk).toBe(700);
    expect(stats(state, 0, 0).atk).toBe(1600);
  });

  it('two Devourers stack, and ATK never goes below 0', () => {
    const state = main({
      myMonsters: [
        [0, 'SMP-058'],
        [1, 'SMP-058'],
      ],
      oppMonsters: [
        [0, 'SMP-017'],
        [1, 'SMP-004'],
      ],
    });
    expect(stats(state, 1, 0).atk).toBe(1000);
    expect(stats(state, 1, 1).atk).toBe(0);
  });

  it('the penalty decides a battle: 1600 beats SMP-017 (1800 − 400)', () => {
    const before = battle({ myMonsters: [[0, 'SMP-058']], oppMonsters: [[0, 'SMP-017']] });
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(types(events)).toEqual(['AttackDeclared', 'MonsterDestroyed', 'DamageDealt']);
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(lp(state)).toEqual([8000, 7800]);
    expect(events).toMatchSnapshot();
  });

  it('once it leaves the field the penalty is gone', () => {
    const before = battle({
      myMonsters: [[0, 'SMP-058']],
      oppMonsters: [
        [0, 'BIG'],
        [1, 'SMP-017'],
      ],
    });
    expect(stats(before, 1, 1).atk).toBe(1400);
    const { state } = apply(before, attack('m0-0', 'o0-0'));
    expect(state.players[0].board.monsterZones[0]).toBeNull();
    expect(stats(state, 1, 1).atk).toBe(1800);
  });

  it('a Continuous effect is never activated', () => {
    const state = main({ myMonsters: [[0, 'SMP-058']] });
    expectEngineError(
      () => apply(state, activate('m0-0', 'devour-light')),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
  });
});
