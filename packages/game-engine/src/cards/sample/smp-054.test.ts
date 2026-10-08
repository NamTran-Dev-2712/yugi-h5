import { describe, expect, it } from 'vitest';
import { answer, apply, attack, battle, lp, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-054 Barrow Thane (Tier B, Level 5, ATK 2000): OnDestroyed OPTIONAL — target 1 Level 4 or lower monster
 * in its owner's graveyard; Special Summon it in face-up Defense Position. It is Level 5 itself, so it can never bring
 * itself back. Here it attacks SMP-003 (ATK 2700) and is destroyed. SMP-005 is Level 3, SMP-002 Level 6.
 */

const doomed = (myGraveyard: string[]) =>
  battle({ myMonsters: [[0, 'SMP-054']], oppMonsters: [[0, 'SMP-003']], myGraveyard });

describe('SMP-054 Barrow Thane', () => {
  it('destroyed by battle: asks its owner; only Level 4 or lower monsters of the graveyard are candidates (never itself)', () => {
    const { state, events } = apply(
      doomed(['SMP-005', 'SMP-002', 'SMP-103']),
      attack('m0-0', 'o0-0'),
    );
    expect(types(events)).toEqual(['AttackDeclared', 'MonsterDestroyed', 'DamageDealt']);
    expect(lp(state)).toEqual([7300, 8000]);
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toContain('SMP-054');
    expect(state.pendingPrompt).toMatchObject({
      kind: 'TriggerActivation',
      playerIndex: 0,
      payload: { optional: true, candidateInstanceIds: ['g0'], count: 1 },
    });
  });

  it('accept: the retainer returns from the graveyard in face-up Defense', () => {
    const asked = apply(doomed(['SMP-005', 'SMP-002']), attack('m0-0', 'o0-0')).state;
    const { state, events } = apply(asked, answer(asked, ['g0']));
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
        instanceId: 'g0',
        from: 'Graveyard',
        zoneIndex: 0,
      }),
    );
    expect(state.players[0].board.monsterZones[0]).toMatchObject({
      definitionId: 'SMP-005',
      position: 'DefenseUp',
    });
    expect(state.players[0].graveyard.map((c) => c.definitionId).sort()).toEqual([
      'SMP-002',
      'SMP-054',
    ]);
    expect(events).toMatchSnapshot();
  });

  it('decline: nothing comes back', () => {
    const asked = apply(doomed(['SMP-005']), attack('m0-0', 'o0-0')).state;
    const { state, events } = apply(asked, answer(asked, [], true));
    expect(events).toEqual([]);
    expect(state.players[0].board.monsterZones.every((c) => c === null)).toBe(true);
    expect(state.players[0].graveyard).toHaveLength(2);
  });

  it('only itself / Level 5+ monsters / Spells in the graveyard: no prompt (no loop)', () => {
    const { state } = apply(doomed(['SMP-002', 'SMP-103', 'SMP-054']), attack('m0-0', 'o0-0'));
    expect(state.pendingPrompt).toBeNull();
    expect(state.players[0].board.monsterZones.every((c) => c === null)).toBe(true);
  });

  it('survives the battle (attacks a weaker monster): no trigger', () => {
    const before = battle({
      myMonsters: [[0, 'SMP-054']],
      oppMonsters: [[0, 'M1']],
      myGraveyard: ['SMP-005'],
    });
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(types(events)).not.toContain('EffectActivated');
    expect(state.pendingPrompt).toBeNull();
  });

  it('the returning monster is Summoned: SMP-048 then heals its controller', () => {
    const asked = apply(doomed(['SMP-048']), attack('m0-0', 'o0-0')).state;
    const { state } = apply(asked, answer(asked, ['g0']));
    expect(lp(state)).toEqual([7800, 8000]);
  });
});
