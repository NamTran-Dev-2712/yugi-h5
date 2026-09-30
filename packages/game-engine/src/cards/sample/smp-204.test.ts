import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  lp,
  main,
  setSpellTrap,
  summon,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.1 — SMP-204 Tollgate Snare (Tier B), Normal Trap (Spell Speed 2). Cost: pay 500 LP. Target 1 Spell/Trap
 * your opponent controls; destroy it.
 */

describe('SMP-204 Tollgate Snare', () => {
  it('my Set copy in my turn: pays 500 LP, destroys the opponent Spell/Trap', () => {
    const before = main({ mySpellTraps: [[1, 'SMP-204']], oppSpellTraps: [[0, 'SMP-201']] });
    const { state, events } = apply(before, activate('ms-1', 'toll-snare'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'LifePointsPaid',
      'ChainLinkAdded',
      'SpellTrapDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([7500, 8000]);
    expect(state.players[1].board.spellTrapZones[0]).toBeNull();
    expect(state.players[0].board.spellTrapZones[1]).toBeNull();
    expect(events).toMatchSnapshot();
  });

  it('answers the opponent Normal Summon by destroying their Set card', () => {
    const before = main({
      hand: ['M1'],
      mySpellTraps: [[2, 'SMP-201']],
      oppSpellTraps: [[0, 'SMP-204']],
    });
    const opened = apply(before, summon('h0')).state;
    expect(opened.chainWindow).toMatchObject({ priorityPlayer: 1, reactionTo: { kind: 'Summon' } });
    const { state } = apply(opened, activate('os-0', 'toll-snare', 1));
    expect(lp(state)).toEqual([8000, 7500]);
    expect(state.players[0].board.spellTrapZones[2]).toBeNull();
  });

  it('not enough LP (exactly 500): INVALID_COST', () => {
    expectEngineError(
      () =>
        apply(
          main({ mySpellTraps: [[1, 'SMP-204']], oppSpellTraps: [[0, 'SMP-201']], myLp: 500 }),
          activate('ms-1', 'toll-snare'),
        ),
      'INVALID_COST',
    );
  });

  it('no opponent Spell/Trap: NO_VALID_TARGET; Set this turn: TRAP_SET_THIS_TURN', () => {
    expectEngineError(
      () => apply(main({ mySpellTraps: [[1, 'SMP-204']] }), activate('ms-1', 'toll-snare')),
      'NO_VALID_TARGET',
    );
    const set = apply(
      main({ hand: ['SMP-204'], oppSpellTraps: [[0, 'SMP-201']] }),
      setSpellTrap('h0'),
    ).state;
    expectEngineError(() => apply(set, activate('h0', 'toll-snare')), 'TRAP_SET_THIS_TURN');
  });
});
