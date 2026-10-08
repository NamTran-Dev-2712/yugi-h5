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

/* Task 4.7 — SMP-051 Dustbound Archivist (Tier B): OnFlip MANDATORY — its controller draws 1 card. DEF 1300. */

describe('SMP-051 Dustbound Archivist', () => {
  it('Flip Summon: draws 1, no prompt', () => {
    const before = main({ myMonsters: [[0, 'SMP-051', 'DefenseDown']] });
    const { state, events } = apply(before, flipSummon('m0-0'));
    expect(types(events)).toEqual([
      'FlipSummoned',
      'EffectActivated',
      'ChainLinkAdded',
      'CardDrawn',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[0].hand).toHaveLength(before.players[0].hand.length + 1);
    expect(state.pendingPrompt).toBeNull();
    expect(events).toMatchSnapshot();
  });

  it('flipped by an attack it survives (DEF 1300 > ATK 1000): its controller draws, the attacker takes 300', () => {
    const before = battle({
      myMonsters: [[0, 'M1']],
      oppMonsters: [[0, 'SMP-051', 'DefenseDown']],
    });
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(types(events)).toEqual(expect.arrayContaining(['MonsterFlipped', 'CardDrawn']));
    expect(state.players[1].hand).toHaveLength(before.players[1].hand.length + 1);
    expect(state.players[1].board.monsterZones[0]).toMatchObject({ position: 'DefenseUp' });
    expect(lp(state)).toEqual([7700, 8000]);
  });

  it('flipped and destroyed by the attack: still draws (the effect activates from the graveyard)', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[0, 'SMP-051', 'DefenseDown']],
    });
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(types(events)).toEqual(
      expect.arrayContaining(['MonsterFlipped', 'MonsterDestroyed', 'CardDrawn']),
    );
    expect(state.players[1].hand).toHaveLength(before.players[1].hand.length + 1);
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toEqual(['SMP-051']);
  });

  it('Normal Summoned face-up: it never flipped, nothing is drawn', () => {
    const before = main({ hand: ['SMP-051'] });
    const { state, events } = apply(before, summon('h0'));
    expect(types(events)).toEqual(['NormalSummoned']);
    expect(state.players[0].hand).toHaveLength(0);
  });
});
