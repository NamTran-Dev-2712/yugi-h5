import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  attack,
  endPhase,
  lp,
  main,
  setSpellTrap,
  stats,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-124 (Tier B), Field Spell: every face-up EARTH monster on the field (both sides) gains 200 ATK and 200
 * DEF. The filler `M1` is EARTH (1000 / 1000); SMP-008 is WIND (1600 / 900).
 */

const board = {
  myMonsters: [
    [0, 'M1'],
    [1, 'SMP-008'],
  ] as [number, string][],
  oppMonsters: [
    [0, 'M1'],
    [1, 'SMP-008'],
  ] as [number, string][],
};

describe('SMP-124', () => {
  it('activated from the hand: stays face-up in the Field Zone, EARTH monsters of BOTH sides gain 200 / 200', () => {
    const { state, events } = apply(
      main({ hand: ['SMP-124'], ...board }),
      activate('h0', 'activate'),
    );
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[0].board.fieldZone).toMatchObject({
      instanceId: 'h0',
      position: 'Attack',
    });
    expect(stats(state, 0, 0)).toEqual({ atk: 1200, def: 1200 });
    expect(stats(state, 1, 0)).toEqual({ atk: 1200, def: 1200 });
    expect(stats(state, 0, 1)).toEqual({ atk: 1600, def: 900 });
    expect(stats(state, 1, 1)).toEqual({ atk: 1600, def: 900 });
    expect(events).toMatchSnapshot();
  });

  it('Set first: no bonus while face-down, then activated from the Field Zone', () => {
    const set = apply(main({ hand: ['SMP-124'], ...board }), setSpellTrap('h0', 0)).state;
    expect(set.players[0].board.fieldZone).toMatchObject({ position: 'DefenseDown' });
    expect(stats(set, 0, 0).atk).toBe(1000);
    const on = apply(set, activate('h0', 'activate')).state;
    expect(stats(on, 0, 0).atk).toBe(1200);
  });

  it('both sides are boosted alike: two EARTH 1000s still tie and destroy each other', () => {
    const on = apply(main({ hand: ['SMP-124'], ...board }), activate('h0', 'activate')).state;
    const { state, events } = apply(apply(on, endPhase()).state, attack('m0-0', 'o0-0'));
    expect(types(events).filter((t) => t === 'MonsterDestroyed')).toHaveLength(2);
    expect(lp(state)).toEqual([8000, 8000]);
  });

  it('the DEF bonus counts: SMP-008 (1600) no longer breaks SMP-005 (EARTH, DEF 1400 → 1600)', () => {
    const before = main({
      hand: ['SMP-124'],
      myMonsters: [[0, 'SMP-008']],
      oppMonsters: [[0, 'SMP-005', 'DefenseUp']],
    });
    const on = apply(before, activate('h0', 'activate')).state;
    expect(stats(on, 1, 0).def).toBe(1600);
    const { state, events } = apply(apply(on, endPhase()).state, attack('m0-0', 'o0-0'));
    expect(types(events)).not.toContain('MonsterDestroyed');
    expect(lp(state)).toEqual([8000, 8000]);
  });

  it('replaced by another Field Spell of mine: the old one goes to the graveyard, its bonus ends', () => {
    const on = apply(
      main({ hand: ['SMP-124', 'SMP-113'], ...board }),
      activate('h0', 'activate'),
    ).state;
    const { state } = apply(on, activate('h1', 'activate'));
    expect(state.players[0].board.fieldZone).toMatchObject({ definitionId: 'SMP-113' });
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-124']);
    expect(stats(state, 0, 0).atk).toBe(1000);
    expect(stats(state, 0, 1).atk).toBe(1900);
  });

  it('its Continuous effect is never activated', () => {
    expectEngineError(
      () => apply(main({ hand: ['SMP-124'] }), activate('h0', 'loam-boost')),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
  });
});
