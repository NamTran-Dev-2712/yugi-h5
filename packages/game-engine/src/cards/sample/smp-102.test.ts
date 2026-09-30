import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  attack,
  battle,
  lp,
  main,
  setSpellTrap,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 3.8 — SMP-102 Flash Arrow (Tier B), Quick-Play Spell (Spell Speed 2): 500 damage to the opponent.
 * [RULE] from the hand only during your own turn (any phase); on the opponent's turn it must have been Set before,
 * and not in the turn it was Set (task 3.4).
 */

describe('SMP-102 Flash Arrow', () => {
  it('from the hand in my Battle Phase: 500 damage, the card goes to the graveyard from the hand', () => {
    const before = battle({ hand: ['SMP-102'] });
    const { state, events } = apply(before, activate('h0', 'flash-burn'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([8000, 7500]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'CardSentToGraveyard', from: 'Hand' }),
    );
    expect(events).toMatchSnapshot();
  });

  it('from the hand on the opponent’s turn: rejected', () => {
    const state = { ...main({ hand: ['SMP-102'] }), turnPlayerIndex: 1 as const };
    expectEngineError(() => apply(state, activate('h0', 'flash-burn')), 'NOT_TURN_PLAYER');
  });

  it('Set this turn: cannot be activated yet', () => {
    const set = apply(main({ hand: ['SMP-102'] }), setSpellTrap('h0', 2)).state;
    expectEngineError(() => apply(set, activate('h0', 'flash-burn')), 'SPELL_SET_THIS_TURN');
  });

  it('Set earlier, on the opponent’s turn: answers their attack, then the attack goes on', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'SMP-102']] });
    const opened = apply(before, attack('m0-0')).state;
    expect(opened.chainWindow).toMatchObject({ priorityPlayer: 1, reactionTo: { kind: 'Attack' } });
    const { state, events } = apply(opened, activate('os-0', 'flash-burn', 1));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
      'DamageDealt',
    ]);
    expect(lp(state)).toEqual([7500, 6000]);
  });

  it('chains onto a Normal Spell (Speed 2 ≥ 1): LIFO — Flash Arrow resolves first', () => {
    const before = main({ hand: ['SMP-103'], oppSpellTraps: [[0, 'SMP-102']] });
    const opened = apply(before, activate('h0', 'heal')).state;
    expect(opened.chainWindow?.priorityPlayer).toBe(1);
    // Nobody can respond to link 2: both are auto-passed and the whole chain resolves in this call (ADR 3.3).
    const { state, events } = apply(opened, activate('os-0', 'flash-burn', 1));
    expect(events.filter((e) => e.type === 'ChainLinkAdded')).toHaveLength(1);
    expect(state.chainStack).toEqual([]);
    const lpEvents = events.filter(
      (e) => e.type === 'DamageDealt' || e.type === 'LifePointsRecovered',
    );
    expect(types(lpEvents)).toEqual(['DamageDealt', 'LifePointsRecovered']);
    expect(lp(state)).toEqual([8500, 8000]);
  });
});
