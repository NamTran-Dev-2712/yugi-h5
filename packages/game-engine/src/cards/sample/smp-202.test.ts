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
  setSpellTrap,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 3.8 — SMP-202 Sudden Sinkhole (Tier B), Normal Trap (Spell Speed 2): destroy 1 monster your opponent controls
 * (target chosen on activation). Must be Set first (C11) and not in the turn it was Set ([RULE] trapSetTurnDelay).
 */

describe('SMP-202 Sudden Sinkhole', () => {
  it('answers an attack: the attacker is destroyed, the attack stops (no damage)', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'SMP-202']] });
    const opened = apply(before, attack('m0-0'));
    expect(types(opened.events)).toEqual(['AttackDeclared']);
    const { state, events } = apply(opened.state, activate('os-0', 'sinkhole', 1));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(state.players[0].board.monsterZones[0]).toBeNull();
    expect(lp(state)).toEqual([8000, 8000]);
    expect(state.chainWindow).toBeNull();
    expect(events).toMatchSnapshot();
  });

  it('two targets: the activation asks which one (SelectEffectTarget)', () => {
    const before = battle({
      myMonsters: [
        [0, 'BIG'],
        [1, 'M1'],
      ],
      oppSpellTraps: [[0, 'SMP-202']],
    });
    const opened = apply(before, attack('m0-0')).state;
    const { state } = apply(opened, activate('os-0', 'sinkhole', 1));
    expect(state.pendingPrompt).toMatchObject({ kind: 'SelectEffectTarget', playerIndex: 1 });
  });

  it('passing lets the attack through', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'SMP-202']] });
    const opened = apply(before, attack('m0-0')).state;
    expect(lp(apply(opened, pass(1)).state)).toEqual([8000, 6000]);
  });

  it('from the hand: TRAP_NOT_SET; Set this turn: TRAP_SET_THIS_TURN', () => {
    const inHand = main({ hand: ['SMP-202'], oppMonsters: [[0, 'M1']] });
    expectEngineError(() => apply(inHand, activate('h0', 'sinkhole')), 'TRAP_NOT_SET');
    const set = apply(inHand, setSpellTrap('h0')).state;
    expectEngineError(() => apply(set, activate('h0', 'sinkhole')), 'TRAP_SET_THIS_TURN');
  });

  it('no opponent monster: NO_VALID_TARGET', () => {
    expectEngineError(
      () => apply(main({ mySpellTraps: [[0, 'SMP-202']] }), activate('ms-0', 'sinkhole')),
      'NO_VALID_TARGET',
    );
  });
});
