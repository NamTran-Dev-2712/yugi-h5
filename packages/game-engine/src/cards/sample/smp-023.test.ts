import { describe, expect, it } from 'vitest';
import { effectiveStats } from '../../effects/continuous.js';
import type { GameState } from '../../state/types.js';
import {
  apply,
  attack,
  battle,
  lp,
  main,
  sampleCtx,
  types,
} from '../../testing/sample-card-kit.js';

/* Task 3.8 — SMP-023 Bog Wraith (Tier B): Continuous — face-up monsters your opponent controls lose 300 ATK. */

const stats = (state: GameState, seat: 0 | 1, zone: number) =>
  effectiveStats(state, state.players[seat].board.monsterZones[zone]!, sampleCtx);

describe('SMP-023 Bog Wraith', () => {
  it('face-up: opponent monsters −300 ATK (DEF unchanged); mine unchanged', () => {
    const state = main({
      myMonsters: [
        [0, 'SMP-023'],
        [1, 'M1'],
      ],
      oppMonsters: [[2, 'M1']],
    });
    expect(stats(state, 1, 2)).toEqual({ atk: 700, def: 1000 });
    expect(stats(state, 0, 1)).toEqual({ atk: 1000, def: 1000 });
    expect(stats(state, 0, 0)).toEqual({ atk: 1300, def: 1200 });
  });

  it('clamped at 0: SMP-013 (500 ATK) on the opponent side reads 200; a weaker one would read 0', () => {
    const state = main({ myMonsters: [[0, 'SMP-023']], oppMonsters: [[1, 'SMP-013']] });
    expect(stats(state, 1, 1).atk).toBe(200);
  });

  it('face-down opponent monsters are not affected (they keep printed stats)', () => {
    const state = main({
      myMonsters: [[0, 'SMP-023']],
      oppMonsters: [[1, 'M1', 'DefenseDown']],
    });
    expect(stats(state, 1, 1)).toEqual({ atk: 1000, def: 1000 });
  });

  it('combat: my M1 (1000) vs their M1 (700) → theirs destroyed, 300 damage', () => {
    const before = battle({
      myMonsters: [
        [0, 'SMP-023'],
        [1, 'M1'],
      ],
      oppMonsters: [[2, 'M1']],
    });
    const { state, events } = apply(before, attack('m0-1', 'o0-2'));
    expect(types(events)).toEqual(['AttackDeclared', 'MonsterDestroyed', 'DamageDealt']);
    expect(lp(state)).toEqual([8000, 7700]);
  });
});
