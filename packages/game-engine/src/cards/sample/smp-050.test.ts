import { describe, expect, it } from 'vitest';
import { answer, apply, lp, main, summon, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-050 Packcaller (Tier B): OnSummon OPTIONAL — target 1 Level 3 or lower monster in your hand; Special
 * Summon it in face-up Defense Position. SMP-011 is Level 2, SMP-005 Level 3, SMP-009 Level 4.
 */

describe('SMP-050 Packcaller', () => {
  it('Summon asks its owner; only Level 3 or lower MONSTERS in the hand are candidates', () => {
    const before = main({ hand: ['SMP-050', 'SMP-011', 'SMP-009', 'SMP-103', 'SMP-005'] });
    const { state, events } = apply(before, summon('h0'));
    expect(types(events)).toEqual(['NormalSummoned']);
    expect(state.pendingPrompt).toMatchObject({
      kind: 'TriggerActivation',
      playerIndex: 0,
      payload: { optional: true, candidateInstanceIds: ['h1', 'h4'], count: 1 },
    });
  });

  it('accept: the chosen monster is Special Summoned face-up in Defense, lowest empty zone', () => {
    const asked = apply(main({ hand: ['SMP-050', 'SMP-011', 'SMP-005'] }), summon('h0')).state;
    const { state, events } = apply(asked, answer(asked, ['h2']));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterSpecialSummoned',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'MonsterSpecialSummoned',
        instanceId: 'h2',
        from: 'Hand',
        zoneIndex: 1,
      }),
    );
    expect(state.players[0].board.monsterZones[1]).toMatchObject({
      definitionId: 'SMP-005',
      position: 'DefenseUp',
    });
    expect(state.players[0].hand.map((c) => c.instanceId)).toEqual(['h1']);
    expect(events).toMatchSnapshot();
  });

  it('decline: the hand is untouched', () => {
    const asked = apply(main({ hand: ['SMP-050', 'SMP-011'] }), summon('h0')).state;
    const { state, events } = apply(asked, answer(asked, [], true));
    expect(events).toEqual([]);
    expect(state.players[0].hand).toHaveLength(1);
    expect(state.players[0].board.monsterZones.filter((c) => c !== null)).toHaveLength(1);
  });

  it('no Level 3 or lower monster in the hand: no prompt', () => {
    const { state } = apply(main({ hand: ['SMP-050', 'SMP-009', 'SMP-103'] }), summon('h0'));
    expect(state.pendingPrompt).toBeNull();
  });

  it('no empty Monster Zone left after its own Summon: no prompt', () => {
    const before = main({
      hand: ['SMP-050', 'SMP-011'],
      myMonsters: [1, 2, 3, 4].map((z) => [z, 'M1'] as [number, string]),
    });
    const { state } = apply(before, summon('h0', 0));
    expect(state.pendingPrompt).toBeNull();
    expect(state.players[0].hand).toHaveLength(1);
  });

  it('the pack answers: Special Summoning SMP-048 fires its own "when Summoned" heal afterwards', () => {
    const asked = apply(main({ hand: ['SMP-050', 'SMP-048'] }), summon('h0')).state;
    const { state, events } = apply(asked, answer(asked, ['h1']));
    expect(types(events).filter((t) => t === 'ChainResolved')).toHaveLength(2);
    expect(lp(state)).toEqual([8500, 8000]);
  });
});
