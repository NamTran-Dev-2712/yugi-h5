import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, answer, apply, battle, lp, main, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-120 (Tier B), Quick-Play Spell: target 1 Level 4 or lower monster in your hand; Special Summon it in
 * face-up Defense Position. SMP-005 is Level 3, `BIG_L5` Level 5.
 */

const EFFECT = 'ambush';

describe('SMP-120', () => {
  it('in the Battle Phase: the only Level 4 or lower monster in hand arrives in face-up Defense', () => {
    const before = battle({ hand: ['SMP-120', 'SMP-005', 'BIG_L5', 'SMP-103'] });
    const { state, events } = apply(before, activate('h0', EFFECT));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterSpecialSummoned',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(state.players[0].board.monsterZones[0]).toMatchObject({
      instanceId: 'h1',
      position: 'DefenseUp',
    });
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(false);
    expect(state.players[0].hand.map((c) => c.instanceId)).toEqual(['h2', 'h3']);
    expect(events).toMatchSnapshot();
  });

  it('two candidates: asks which one', () => {
    const before = main({ hand: ['SMP-120', 'SMP-005', 'M1'] });
    const asked = apply(before, activate('h0', EFFECT)).state;
    expect(asked.pendingPrompt).toMatchObject({
      kind: 'SelectEffectTarget',
      payload: { candidateInstanceIds: ['h1', 'h2'], count: 1 },
    });
    const { state } = apply(asked, answer(asked, ['h2']));
    expect(state.players[0].board.monsterZones[0]).toMatchObject({ instanceId: 'h2' });
  });

  it('only Level 5+ monsters or Spells in hand: NO_VALID_TARGET', () => {
    const s = main({ hand: ['SMP-120', 'BIG_L5', 'SMP-103'] });
    expectEngineError(() => apply(s, activate('h0', EFFECT)), 'NO_VALID_TARGET');
  });

  it('no empty Monster Zone: NO_FREE_MONSTER_ZONE', () => {
    const s = main({
      hand: ['SMP-120', 'SMP-005'],
      myMonsters: [0, 1, 2, 3, 4].map((z) => [z, 'M1'] as [number, string]),
    });
    expectEngineError(() => apply(s, activate('h0', EFFECT)), 'NO_FREE_MONSTER_ZONE');
  });

  it('the ambusher is Summoned: SMP-048 heals its controller', () => {
    const { state } = apply(main({ hand: ['SMP-120', 'SMP-048'] }), activate('h0', EFFECT));
    expect(lp(state)).toEqual([8500, 8000]);
  });
});
