import { describe, expect, it } from 'vitest';
import type { Action } from '../../actions/types.js';
import { getLegalActions } from '../../legal-actions.js';
import {
  answer,
  apply,
  attack,
  battle,
  main,
  sampleCtx,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.2d — SMP-044 (Tier B), Effect Monster, OnFlip OPTIONAL: when flipped face-up (Flip Summon, or flipped by an
 * attack), you can target 1 monster your opponent controls; destroy it.
 */

const flipSummon = (cardInstanceId: string): Action => ({
  type: 'FlipSummon',
  payload: { playerIndex: 0, cardInstanceId },
});

const setUp = () =>
  main({
    myMonsters: [[1, 'SMP-044', 'DefenseDown']],
    oppMonsters: [
      [0, 'M1'],
      [2, 'BIG'],
    ],
  });

describe('SMP-044', () => {
  it('Flip Summon asks the owner: one answer per opponent monster + decline', () => {
    const { state, events } = apply(setUp(), flipSummon('m0-1'));
    expect(types(events)).toEqual(['FlipSummoned']);
    expect(state.players[0].board.monsterZones[1]?.position).toBe('Attack');
    expect(state.pendingPrompt).toMatchObject({ kind: 'TriggerActivation', playerIndex: 0 });
    const legal = getLegalActions(state, 0, sampleCtx);
    expect(legal).toContainEqual(answer(state, ['o0-0']));
    expect(legal).toContainEqual(answer(state, ['o0-2']));
    expect(legal).toContainEqual(answer(state, [], true));
  });

  it('accept + target: the chosen opponent monster is destroyed', () => {
    const asked = apply(setUp(), flipSummon('m0-1')).state;
    const { state, events } = apply(asked, answer(asked, ['o0-2']));
    expect(types(events)).toContain('MonsterDestroyed');
    expect(state.players[1].board.monsterZones[2]).toBeNull();
    expect(state.players[1].board.monsterZones[0]).not.toBeNull();
    expect(state.pendingPrompt).toBeNull();
  });

  it('decline: nothing is destroyed', () => {
    const asked = apply(setUp(), flipSummon('m0-1')).state;
    const { state } = apply(asked, answer(asked, [], true));
    expect(state.players[1].board.monsterZones.filter((c) => c !== null)).toHaveLength(2);
    expect(state.pendingPrompt).toBeNull();
  });

  it('flipped by an attack and destroyed: still triggers (from the graveyard) for its owner', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[0, 'SMP-044', 'DefenseDown']],
    });
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(types(events)).toEqual(
      expect.arrayContaining(['AttackDeclared', 'MonsterFlipped', 'MonsterDestroyed']),
    );
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toContain('SMP-044');
    expect(state.pendingPrompt).toMatchObject({ kind: 'TriggerActivation', playerIndex: 1 });
    const done = apply(state, answer(state, ['m0-0'])).state;
    expect(done.players[0].board.monsterZones[0]).toBeNull();
  });

  it('no opponent monster: the Flip Summon asks nothing', () => {
    const s = main({ myMonsters: [[1, 'SMP-044', 'DefenseDown']] });
    const { state } = apply(s, flipSummon('m0-1'));
    expect(state.pendingPrompt).toBeNull();
    expect(state.players[0].board.monsterZones[1]?.position).toBe('Attack');
  });
});
