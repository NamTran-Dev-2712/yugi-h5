import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  attack,
  battle,
  lp,
  main,
  pass,
  sampleCtx,
  summon,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.1 — SMP-206 Battle Flare (Tier B), Normal Trap (Spell Speed 2). Only during the Battle Phase (PhaseIs Battle):
 * inflict 1000 damage to your opponent.
 */

describe('SMP-206 Battle Flare', () => {
  it('answers the opponent attack in the Battle Phase: 1000 damage, then the attack resolves', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'SMP-206']] });
    const opened = apply(before, attack('m0-0')).state;
    const { state, events } = apply(opened, activate('os-0', 'battle-flare', 1));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
      'DamageDealt',
    ]);
    expect(lp(state)).toEqual([7000, 6000]);
    expect(events).toMatchSnapshot();
  });

  it('in the Main Phase: CONDITION_NOT_MET, and a Summon opens no reaction window for it', () => {
    expectEngineError(
      () => apply(main({ mySpellTraps: [[0, 'SMP-206']] }), activate('ms-0', 'battle-flare')),
      'CONDITION_NOT_MET',
    );
    const summoned = apply(
      main({ hand: ['M1'], oppSpellTraps: [[0, 'SMP-206']] }),
      summon('h0'),
    ).state;
    expect(summoned.chainWindow).toBeNull();
  });

  it('my own Set copy in my Battle Phase is listed and burns the opponent', () => {
    const state = battle({ mySpellTraps: [[0, 'SMP-206']] });
    expect(getLegalActions(state, 0, sampleCtx)).toContainEqual(activate('ms-0', 'battle-flare'));
    expect(lp(apply(state, activate('ms-0', 'battle-flare')).state)).toEqual([8000, 7000]);
  });

  it('passing lets the attack through untouched', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'SMP-206']] });
    const opened = apply(before, attack('m0-0')).state;
    expect(lp(apply(opened, pass(1)).state)).toEqual([8000, 6000]);
  });
});
