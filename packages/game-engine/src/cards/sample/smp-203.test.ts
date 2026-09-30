import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  attack,
  battle,
  lp,
  main,
  pass,
  types,
} from '../../testing/sample-card-kit.js';

/* Task 3.8 — SMP-203 Counterspark (Tier B), Normal Trap (Spell Speed 2): 800 damage to the opponent. */

describe('SMP-203 Counterspark', () => {
  it('answers an attack: 800 to the attacker’s controller, then the attack resolves', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'SMP-203']] });
    const opened = apply(before, attack('m0-0')).state;
    const { state, events } = apply(opened, activate('os-0', 'counterspark', 1));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
      'DamageDealt',
    ]);
    expect(lp(state)).toEqual([7200, 6000]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'CardSentToGraveyard', from: 'SpellTrapZone' }),
    );
    expect(events).toMatchSnapshot();
  });

  it('answers a Normal Summon (reaction window 3.4c)', () => {
    const before = main({ hand: ['M1'], oppSpellTraps: [[0, 'SMP-203']] });
    const opened = apply(before, {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 0 },
    }).state;
    expect(opened.chainWindow).toMatchObject({ priorityPlayer: 1, reactionTo: { kind: 'Summon' } });
    expect(lp(apply(opened, activate('os-0', 'counterspark', 1)).state)).toEqual([7200, 8000]);
    expect(apply(opened, pass(1)).state.chainWindow).toBeNull();
  });

  it('my own Set copy, in my turn: burns the opponent', () => {
    const { state } = apply(
      main({ mySpellTraps: [[0, 'SMP-203']] }),
      activate('ms-0', 'counterspark'),
    );
    expect(lp(state)).toEqual([8000, 7200]);
  });

  it('from the hand: TRAP_NOT_SET', () => {
    expectEngineError(
      () => apply(main({ hand: ['SMP-203'] }), activate('h0', 'counterspark')),
      'TRAP_NOT_SET',
    );
  });
});
