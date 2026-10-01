import { describe, expect, it } from 'vitest';
import { effectiveStats } from '../../effects/continuous.js';
import type { GameState } from '../../state/types.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  main,
  sampleCtx,
  setSpellTrap,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.3 — SMP-114 (Tier B), Continuous Spell: all face-up Warrior monsters you control gain 300 ATK. The card stays
 * face-up in a Spell/Trap Zone after its activation resolves. Fillers: `M1` is a Warrior, `M2` a Dragon (1000 ATK each).
 */

const atk = (state: GameState, player: 0 | 1, zone: number) =>
  effectiveStats(state, state.players[player].board.monsterZones[zone]!, sampleCtx).atk;

const board = {
  myMonsters: [
    [0, 'M1'],
    [1, 'M2'],
  ] as [number, string][],
  oppMonsters: [[0, 'M1']] as [number, string][],
};

describe('SMP-114', () => {
  it('activated from the hand: stays face-up in the lowest empty Spell/Trap Zone; only MY Warriors gain 300 ATK', () => {
    const { state, events } = apply(
      main({ hand: ['SMP-114'], ...board }),
      activate('h0', 'activate'),
    );
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[0].board.spellTrapZones[0]).toMatchObject({
      instanceId: 'h0',
      position: 'Attack',
    });
    expect(state.players[0].graveyard).toEqual([]);
    expect([atk(state, 0, 0), atk(state, 0, 1), atk(state, 1, 0)]).toEqual([1300, 1000, 1000]);
  });

  it('Set first, then activated in place on the same turn', () => {
    const set = apply(main({ hand: ['SMP-114'], ...board }), setSpellTrap('h0', 2)).state;
    expect(atk(set, 0, 0)).toBe(1000);
    const { state } = apply(set, activate('h0', 'activate'));
    expect(state.players[0].board.spellTrapZones[2]).toMatchObject({ position: 'Attack' });
    expect(atk(state, 0, 0)).toBe(1300);
  });

  it('two copies stack', () => {
    const one = apply(main({ hand: ['SMP-114', 'SMP-114'], ...board }), activate('h0', 'activate'));
    const { state } = apply(one.state, activate('h1', 'activate'));
    expect(atk(state, 0, 0)).toBe(1600);
  });

  it('not in the Battle Phase; its Continuous effect is never activated', () => {
    expectEngineError(
      () => apply(main({ hand: ['SMP-114'] }, 'Main1'), activate('h0', 'banner-boost')),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
    const battle: GameState = { ...main({ hand: ['SMP-114'] }), phase: 'Battle' };
    expectEngineError(() => apply(battle, activate('h0', 'activate')), 'WRONG_PHASE');
  });
});
