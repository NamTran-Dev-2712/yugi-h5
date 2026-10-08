import { describe, expect, it } from 'vitest';
import {
  activate,
  apply,
  lp,
  main,
  setMonster,
  summon,
  types,
} from '../../testing/sample-card-kit.js';

/* Task 4.7 — SMP-048 Wellspring Medic (Tier B): OnSummon MANDATORY — its controller gains 500 LP. */

describe('SMP-048 Wellspring Medic', () => {
  it('Normal Summon: the trigger goes on the chain by itself and heals 500 (no prompt)', () => {
    const { state, events } = apply(main({ hand: ['SMP-048'] }), summon('h0'));
    expect(types(events)).toEqual([
      'NormalSummoned',
      'EffectActivated',
      'ChainLinkAdded',
      'LifePointsRecovered',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([8500, 8000]);
    expect(state.pendingPrompt).toBeNull();
    expect(state.players[0].board.monsterZones[0]?.definitionId).toBe('SMP-048');
    expect(events).toMatchSnapshot();
  });

  it('Set is not a Summon: nothing triggers', () => {
    const { state, events } = apply(main({ hand: ['SMP-048'] }), setMonster('h0'));
    expect(types(events)).toEqual(['MonsterSet']);
    expect(lp(state)).toEqual([8000, 8000]);
  });

  it('Special Summoned by SMP-111 from the hand: it is a Summon too, heals 500', () => {
    const before = main({ hand: ['SMP-111', 'SMP-048'] });
    const { state, events } = apply(before, activate('h0', 'call-from-hand'));
    expect(types(events)).toContain('MonsterSpecialSummoned');
    expect(types(events).filter((t) => t === 'LifePointsRecovered')).toHaveLength(1);
    expect(lp(state)).toEqual([8500, 8000]);
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(false);
  });

  it('heals its CONTROLLER, whatever the LP total (no cap at 8000)', () => {
    const { state } = apply(main({ hand: ['SMP-048'], myLp: 100, oppLp: 100 }), summon('h0'));
    expect(lp(state)).toEqual([600, 100]);
  });
});
