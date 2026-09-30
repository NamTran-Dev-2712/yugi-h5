import { describe, expect, it } from 'vitest';
import { effectiveStats } from '../../effects/continuous.js';
import { getLegalActions } from '../../legal-actions.js';
import type { GameState } from '../../state/types.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  attack,
  battle,
  lp,
  main,
  sampleCtx,
  summon,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 3.8 — SMP-022 Banner Captain (Tier B): Continuous — the OTHER face-up monsters you control gain 300 ATK while
 * it is face-up on the field. A monster is the only Continuous source that reaches the field today (ADR 3.6).
 */

const stats = (state: GameState, seat: 0 | 1, zone: number) =>
  effectiveStats(state, state.players[seat].board.monsterZones[zone]!, sampleCtx);

describe('SMP-022 Banner Captain', () => {
  it('face-up: my other monsters +300 ATK, itself and the opponent unchanged, DEF unchanged', () => {
    const state = main({
      myMonsters: [
        [0, 'SMP-022'],
        [1, 'M1'],
      ],
      oppMonsters: [[2, 'M1']],
    });
    expect(stats(state, 0, 1)).toEqual({ atk: 1300, def: 1000 });
    expect(stats(state, 0, 0)).toEqual({ atk: 1500, def: 1000 });
    expect(stats(state, 1, 2)).toEqual({ atk: 1000, def: 1000 });
  });

  it('face-down (Set): no bonus', () => {
    const state = main({
      myMonsters: [
        [0, 'SMP-022', 'DefenseDown'],
        [1, 'M1'],
      ],
    });
    expect(stats(state, 0, 1)).toEqual({ atk: 1000, def: 1000 });
  });

  it('applies as soon as it is Summoned, and in combat: M1 (1300) beats M1 (1000) for 300', () => {
    const summoned = apply(
      main({ hand: ['SMP-022'], myMonsters: [[1, 'M1']] }),
      summon('h0'),
    ).state;
    expect(stats(summoned, 0, 1).atk).toBe(1300);
    const before = battle({
      myMonsters: [
        [0, 'SMP-022'],
        [1, 'M1'],
      ],
      oppMonsters: [[2, 'M1']],
    });
    const { state, events } = apply(before, attack('m0-1', 'o0-2'));
    expect(types(events)).toEqual(['AttackDeclared', 'MonsterDestroyed', 'DamageDealt']);
    expect(lp(state)).toEqual([8000, 7700]);
  });

  it('cannot be activated and is never listed', () => {
    const state = main({ myMonsters: [[0, 'SMP-022']] });
    expectEngineError(
      () => apply(state, activate('m0-0', 'rally-atk')),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
    expect(getLegalActions(state, 0, sampleCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );
  });
});
