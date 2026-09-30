import { describe, expect, it } from 'vitest';
import { activate, apply, attack, battle, main, types } from '../../testing/sample-card-kit.js';

/* Task 3.8 — SMP-021 Ashen Moth (Tier B): OnDestroyed MANDATORY — its controller draws 1 card. */

describe('SMP-021 Ashen Moth', () => {
  it('destroyed by battle: its owner (the opponent here) draws 1 after the damage step', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppMonsters: [[2, 'SMP-021']] });
    const { state, events } = apply(before, attack('m0-0', 'o0-2'));
    expect(types(events)).toEqual([
      'AttackDeclared',
      'MonsterDestroyed',
      'DamageDealt',
      'EffectActivated',
      'ChainLinkAdded',
      'CardDrawn',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[1].hand).toHaveLength(before.players[1].hand.length + 1);
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toEqual(['SMP-021']);
    expect(events).toMatchSnapshot();
  });

  it('destroyed by an effect (my Set SMP-202): a second chain draws for its owner', () => {
    const before = main({ oppMonsters: [[1, 'SMP-021']], mySpellTraps: [[0, 'SMP-202']] });
    const { state, events } = apply(before, activate('ms-0', 'sinkhole'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
      'EffectActivated',
      'ChainLinkAdded',
      'CardDrawn',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[1].hand).toHaveLength(before.players[1].hand.length + 1);
  });

  it('survives the battle (DEF 600 > ATK 500 of SMP-013): no trigger', () => {
    const before = battle({
      myMonsters: [[0, 'SMP-013']],
      oppMonsters: [[2, 'SMP-021', 'DefenseUp']],
    });
    const { events } = apply(before, attack('m0-0', 'o0-2'));
    expect(types(events)).not.toContain('EffectActivated');
  });
});
