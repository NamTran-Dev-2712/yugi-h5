import { describe, expect, it } from 'vitest';
import {
  apply,
  attack,
  battle,
  flipSummon,
  lp,
  main,
  summon,
  types,
} from '../../testing/sample-card-kit.js';

/* Task 4.7 — SMP-053 Sporeburst Cap (Tier B): OnFlip MANDATORY — 600 damage to its controller's opponent. */

describe('SMP-053 Sporeburst Cap', () => {
  it('Flip Summon: 600 damage to the opponent, no prompt', () => {
    const before = main({ myMonsters: [[0, 'SMP-053', 'DefenseDown']] });
    const { state, events } = apply(before, flipSummon('m0-0'));
    expect(types(events)).toEqual([
      'FlipSummoned',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([8000, 7400]);
    expect(events).toMatchSnapshot();
  });

  it('attacked while face-down and destroyed: it still bursts — the ATTACKER takes 600', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[0, 'SMP-053', 'DefenseDown']],
    });
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(types(events)).toEqual(
      expect.arrayContaining(['MonsterFlipped', 'MonsterDestroyed', 'DamageDealt']),
    );
    expect(lp(state)).toEqual([7400, 8000]);
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toEqual(['SMP-053']);
  });

  it('Normal Summoned face-up: no flip, no damage', () => {
    const { state, events } = apply(main({ hand: ['SMP-053'] }), summon('h0'));
    expect(types(events)).toEqual(['NormalSummoned']);
    expect(lp(state)).toEqual([8000, 8000]);
  });

  it('the burst can end the duel', () => {
    const before = main({ myMonsters: [[0, 'SMP-053', 'DefenseDown']], oppLp: 600 });
    const { state, events } = apply(before, flipSummon('m0-0'));
    expect(types(events).at(-1)).toBe('DuelEnded');
    expect(state.winnerIndex).toBe(0);
  });
});
