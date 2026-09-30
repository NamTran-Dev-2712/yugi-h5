import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, apply, lp, main, sampleCtx, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.1 — SMP-109 Sacrificial Bolt (Tier B), Normal Spell. Cost: Tribute 1 monster. Inflict 1000 damage to your
 * opponent. The Tribute is chosen with `costInstanceIds` on activation (task 3.2).
 */

describe('SMP-109 Sacrificial Bolt', () => {
  it('tributes 1 of my monsters, then 1000 damage to the opponent', () => {
    const before = main({ hand: ['SMP-109'], myMonsters: [[2, 'M1']] });
    const { state, events } = apply(before, activate('h0', 'sacrifice-bolt', 0, ['m0-2']));
    expect(types(events)).toEqual([
      'EffectActivated',
      'MonsterTributed',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([8000, 7000]);
    expect(state.players[0].board.monsterZones[2]).toBeNull();
    expect(events).toMatchSnapshot();
  });

  it('a face-down monster of mine can be tributed', () => {
    const before = main({ hand: ['SMP-109'], myMonsters: [[0, 'M1', 'DefenseDown']] });
    expect(lp(apply(before, activate('h0', 'sacrifice-bolt', 0, ['m0-0'])).state)).toEqual([
      8000, 7000,
    ]);
  });

  it('no monster to tribute: INVALID_COST, not listed', () => {
    const state = main({ hand: ['SMP-109'], oppMonsters: [[0, 'M1']] });
    expectEngineError(() => apply(state, activate('h0', 'sacrifice-bolt', 0, [])), 'INVALID_COST');
    expect(getLegalActions(state, 0, sampleCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );
  });

  it('cannot tribute an opponent monster', () => {
    expectEngineError(
      () =>
        apply(
          main({ hand: ['SMP-109'], myMonsters: [[0, 'M1']], oppMonsters: [[0, 'M1']] }),
          activate('h0', 'sacrifice-bolt', 0, ['o0-0']),
        ),
      'INVALID_COST',
    );
  });

  it('listed once per monster I could tribute', () => {
    const legal = getLegalActions(
      main({
        hand: ['SMP-109'],
        myMonsters: [
          [0, 'M1'],
          [3, 'M1'],
        ],
      }),
      0,
      sampleCtx,
    );
    expect(legal.filter((a) => a.type === 'ActivateEffect')).toEqual([
      activate('h0', 'sacrifice-bolt', 0, ['m0-0']),
      activate('h0', 'sacrifice-bolt', 0, ['m0-3']),
    ]);
  });
});
