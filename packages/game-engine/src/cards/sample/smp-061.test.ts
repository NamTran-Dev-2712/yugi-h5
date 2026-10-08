import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  answer,
  apply,
  attack,
  battle,
  lp,
  main,
  stats,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-061 (Fusion Monster, ATK 2500): SMP-058 Gloam Devourer + SMP-054 Barrow Thane. Continuous — face-up
 * monsters the opponent controls lose 200 ATK.
 */

describe('SMP-061', () => {
  it('Fusion Summoned by SMP-116: the opponent`s monsters lose 200 ATK from then on', () => {
    const before = main({
      hand: ['SMP-116', 'SMP-058', 'SMP-054'],
      myExtraDeck: ['SMP-061'],
      oppMonsters: [[0, 'M1']],
    });
    expect(stats(before, 1, 0).atk).toBe(1000);
    const activated = apply(before, activate('h0', 'merging-crucible')).state;
    const picked = apply(activated, answer(activated, ['x0'])).state;
    const { state, events } = apply(picked, answer(picked, ['h1', 'h2']));
    expect(types(events)).toContain('MonsterFusionSummoned');
    expect(state.players[0].board.monsterZones[0]).toMatchObject({ definitionId: 'SMP-061' });
    expect(stats(state, 0, 0)).toEqual({ atk: 2500, def: 2000 });
    expect(stats(state, 1, 0).atk).toBe(800);
    expect(events).toMatchSnapshot();
  });

  it('every opponent monster, any attribute; DEF and my own monsters are untouched', () => {
    const state = main({
      myMonsters: [
        [0, 'SMP-061'],
        [1, 'M1'],
      ],
      oppMonsters: [
        [0, 'SMP-017'],
        [1, 'SMP-003'],
      ],
    });
    expect(stats(state, 1, 0)).toEqual({ atk: 1600, def: 1300 });
    expect(stats(state, 1, 1)).toEqual({ atk: 2500, def: 2000 });
    expect(stats(state, 0, 1).atk).toBe(1000);
  });

  it('the penalty decides a battle: it ties with SMP-003 (2700 − 200), both are destroyed', () => {
    const before = battle({ myMonsters: [[0, 'SMP-061']], oppMonsters: [[0, 'SMP-003']] });
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(types(events).filter((t) => t === 'MonsterDestroyed')).toHaveLength(2);
    expect(lp(state)).toEqual([8000, 8000]);
    // A Fusion Monster that leaves the field goes to the graveyard (ADR 068).
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-061']);
  });

  it('a Continuous effect is never activated', () => {
    const state = main({ myMonsters: [[0, 'SMP-061']] });
    expectEngineError(
      () => apply(state, activate('m0-0', 'dread-aura')),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
  });
});
