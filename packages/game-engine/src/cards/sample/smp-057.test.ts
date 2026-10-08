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
 * Task 4.7 — SMP-057 Greymane Alpha (Tier B, Beast, ATK 1500): Continuous — OTHER face-up Beast monsters its controller
 * controls gain 200 ATK. SMP-005 is a Beast (ATK 900); the filler `M1` is a Warrior (ATK 1000).
 */

describe('SMP-057 Greymane Alpha', () => {
  it('my other Beasts gain 200 ATK; not itself, not a Warrior, not the opponent`s Beast', () => {
    const state = main({
      myMonsters: [
        [0, 'SMP-057'],
        [1, 'SMP-005'],
        [2, 'M1'],
      ],
      oppMonsters: [[0, 'SMP-005']],
    });
    expect(stats(state, 0, 0)).toEqual({ atk: 1500, def: 1200 });
    expect(stats(state, 0, 1)).toEqual({ atk: 1100, def: 1400 });
    expect(stats(state, 0, 2).atk).toBe(1000);
    expect(stats(state, 1, 0).atk).toBe(900);
  });

  it('two Alphas boost each other', () => {
    const state = main({
      myMonsters: [
        [0, 'SMP-057'],
        [1, 'SMP-057'],
      ],
    });
    expect([stats(state, 0, 0).atk, stats(state, 0, 1).atk]).toEqual([1700, 1700]);
  });

  it('face-down it boosts nobody', () => {
    const state = main({
      myMonsters: [
        [0, 'SMP-057', 'DefenseDown'],
        [1, 'SMP-005'],
      ],
    });
    expect(stats(state, 0, 1).atk).toBe(900);
  });

  it('the boost decides a battle: SMP-005 (900 + 200) beats a 1000 ATK monster', () => {
    const before = battle({
      myMonsters: [
        [0, 'SMP-057'],
        [1, 'SMP-005'],
      ],
      oppMonsters: [[0, 'M1']],
    });
    const { state, events } = apply(before, attack('m0-1', 'o0-0'));
    expect(types(events)).toEqual(['AttackDeclared', 'MonsterDestroyed', 'DamageDealt']);
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(lp(state)).toEqual([8000, 7900]);
    expect(events).toMatchSnapshot();
  });

  it('a Continuous effect is never activated', () => {
    const state = main({ myMonsters: [[0, 'SMP-057']] });
    expectEngineError(
      () => apply(state, activate('m0-0', 'pack-leader')),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
  });
});
