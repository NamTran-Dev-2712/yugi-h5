import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  attack,
  battle,
  endPhase,
  lp,
  main,
  stats,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-123 (Tier B), Continuous Spell: when activated, gain 500 LP; while face-up, DARK monsters you control
 * gain 300 ATK. SMP-009 is DARK (ATK 1700); the filler `M1` is EARTH.
 */

const board = {
  myMonsters: [
    [0, 'SMP-009'],
    [1, 'M1'],
  ] as [number, string][],
  oppMonsters: [[0, 'SMP-009']] as [number, string][],
};

describe('SMP-123', () => {
  it('activated from the hand: heals 500 once, stays face-up, my DARK monsters gain 300 ATK', () => {
    const { state, events } = apply(
      main({ hand: ['SMP-123'], ...board }),
      activate('h0', 'activate'),
    );
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'LifePointsRecovered',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([8500, 8000]);
    expect(state.players[0].board.spellTrapZones[0]).toMatchObject({
      instanceId: 'h0',
      position: 'Attack',
    });
    expect(state.players[0].graveyard).toEqual([]);
    expect(stats(state, 0, 0).atk).toBe(2000);
    expect(stats(state, 0, 1).atk).toBe(1000); // EARTH
    expect(stats(state, 1, 0).atk).toBe(1700); // the opponent's DARK monster
    expect(events).toMatchSnapshot();
  });

  it('the boost decides a battle between two SMP-009: mine (2000) wins', () => {
    const on = apply(main({ hand: ['SMP-123'], ...board }), activate('h0', 'activate')).state;
    const { state } = apply(apply(on, endPhase()).state, attack('m0-0', 'o0-0'));
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(state.players[0].board.monsterZones[0]).not.toBeNull();
    expect(lp(state)).toEqual([8500, 7700]);
  });

  it('face-up it cannot be activated again (no second heal); its Continuous effect is never activated', () => {
    const on = apply(main({ hand: ['SMP-123'] }), activate('h0', 'activate')).state;
    expectEngineError(() => apply(on, activate('h0', 'activate')), 'NOT_ACTIVATABLE');
    expectEngineError(
      () => apply(main({ hand: ['SMP-123'] }), activate('h0', 'dusk-boost')),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
  });

  it('a Spell Speed 1 card: Main Phase only; no empty Spell/Trap Zone → NO_FREE_SPELL_TRAP_ZONE', () => {
    expectEngineError(
      () => apply(battle({ hand: ['SMP-123'] }), activate('h0', 'activate')),
      'WRONG_PHASE',
    );
    const full = main({
      hand: ['SMP-123'],
      mySpellTraps: [0, 1, 2, 3, 4].map((z) => [z, 'TRAP_PLAIN'] as [number, string]),
    });
    expectEngineError(() => apply(full, activate('h0', 'activate')), 'NO_FREE_SPELL_TRAP_ZONE');
  });
});
