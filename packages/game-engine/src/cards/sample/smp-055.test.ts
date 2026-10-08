import { describe, expect, it } from 'vitest';
import { activate, apply, attack, battle, lp, main, types } from '../../testing/sample-card-kit.js';

/* Task 4.7 — SMP-055 Rolling Blastrock (Tier B, ATK 1200 / DEF 600): OnDestroyed MANDATORY — 500 damage to its owner's opponent. */

describe('SMP-055 Rolling Blastrock', () => {
  it('destroyed by battle (attacks BIG, ATK 2000): I take 800 battle damage, the opponent takes 500', () => {
    const before = battle({ myMonsters: [[0, 'SMP-055']], oppMonsters: [[0, 'BIG']] });
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(types(events)).toEqual([
      'AttackDeclared',
      'MonsterDestroyed',
      'DamageDealt',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([7200, 7500]);
    expect(state.pendingPrompt).toBeNull();
    expect(events).toMatchSnapshot();
  });

  it("the opponent's copy destroyed by my effect (fixture Spell KILL): it burns ME", () => {
    const before = main({ hand: ['KILL'], oppMonsters: [[1, 'SMP-055']] });
    const { state, events } = apply(before, activate('h0', 'e1'));
    expect(types(events).filter((t) => t === 'ChainResolved')).toHaveLength(2);
    expect(lp(state)).toEqual([7500, 8000]);
  });

  it('survives the battle (Defense 600 against ATK 500): no trigger', () => {
    const before = battle({
      myMonsters: [[0, 'SMP-013']],
      oppMonsters: [[0, 'SMP-055', 'DefenseUp']],
    });
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(types(events)).not.toContain('EffectActivated');
    expect(lp(state)).toEqual([7900, 8000]);
  });

  it('Tributed for a cost (SMP-118) is not destroyed: no damage', () => {
    const before = main({ hand: ['SMP-118'], myMonsters: [[0, 'SMP-055']] });
    const { state, events } = apply(before, activate('h0', 'offering-draw', 0, ['m0-0']));
    expect(types(events)).toContain('MonsterTributed');
    expect(types(events)).not.toContain('DamageDealt');
    expect(lp(state)).toEqual([8000, 8000]);
  });
});
