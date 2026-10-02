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
  summon,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.4 — SMP-201 Guardian Barrier (Tier B), Normal Trap (Spell Speed 2): when an opponent's monster declares an
 * attack, negate that attack. No longer a placeholder. Player 0 attacks; player 1 holds the Set copy `os-0`.
 */

describe('SMP-201 Guardian Barrier', () => {
  it('negates the declared attack: no damage, the attacker has attacked, the Trap goes to the graveyard', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'SMP-201']] });
    const opened = apply(before, attack('m0-0')).state;
    expect(opened.chainWindow).toMatchObject({ priorityPlayer: 1, reactionTo: { kind: 'Attack' } });

    const { state, events } = apply(opened, activate('os-0', 'guardian-barrier', 1));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'AttackNegated',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events.find((e) => e.type === 'ChainLinkAdded')).toMatchObject({ spellSpeed: 2 });
    expect(lp(state)).toEqual([8000, 8000]);
    expect(state.players[0].board.monsterZones[0]?.attackedTurn).toBe(3);
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toEqual(['SMP-201']);
    expect(events).toMatchSnapshot();
  });

  it('protects the attacked monster: it is neither flipped nor destroyed', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[1, 'M1', 'DefenseDown']],
      oppSpellTraps: [[0, 'SMP-201']],
    });
    const { state } = apply(
      apply(before, attack('m0-0', 'o0-1')).state,
      activate('os-0', 'guardian-barrier', 1),
    );
    expect(state.players[1].board.monsterZones[1]?.position).toBe('DefenseDown');
  });

  it('the defender may let the attack through', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'SMP-201']] });
    const { state } = apply(apply(before, attack('m0-0')).state, pass(1));
    expect(lp(state)).toEqual([8000, 6000]);
  });

  it('only against an attack: not on my own turn, not after a Summon; a Trap must be Set first', () => {
    expectEngineError(
      () => apply(main({ mySpellTraps: [[0, 'SMP-201']] }), activate('ms-0', 'guardian-barrier')),
      'NOTHING_TO_NEGATE',
    );
    const afterSummon = apply(
      main({ hand: ['M1'], oppSpellTraps: [[0, 'SMP-201']] }),
      summon('h0'),
    );
    expect(afterSummon.state.chainWindow).toBeNull();

    const start = main({ hand: ['SMP-201'] });
    expectEngineError(() => apply(start, activate('h0', 'guardian-barrier')), 'TRAP_NOT_SET');
    expect(
      apply(start, setSpellTrap('h0', 0)).state.players[0].board.spellTrapZones[0],
    ).toMatchObject({ instanceId: 'h0', position: 'DefenseDown' });
  });

  it('Set this turn: the attack is not interrupted', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'SMP-201', 3]] });
    const { state, events } = apply(before, attack('m0-0'));
    expect(state.chainWindow).toBeNull();
    expect(types(events)).toEqual(['AttackDeclared', 'DamageDealt']);
  });
});
