import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  answer,
  apply,
  lp,
  main,
  sampleCtx,
  summon,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-049 Mistfen Marksman (Tier B): OnSummon OPTIONAL, cost: pay 800 LP — target 1 face-up Level 4 or lower
 * monster the opponent controls; destroy it. `M1` is Level 4, `BIG_L5` Level 5.
 */

const board = (myLp?: number) =>
  main({
    hand: ['SMP-049'],
    oppMonsters: [
      [0, 'M1'],
      [1, 'BIG_L5'],
      [2, 'M1', 'DefenseDown'],
      [3, 'M2'],
    ],
    ...(myLp === undefined ? {} : { myLp }),
  });

describe('SMP-049 Mistfen Marksman', () => {
  it('Summon asks its owner; only face-up Level 4 or lower monsters are candidates', () => {
    const { state, events } = apply(board(), summon('h0'));
    expect(types(events)).toEqual(['NormalSummoned']);
    expect(state.pendingPrompt).toMatchObject({
      kind: 'TriggerActivation',
      playerIndex: 0,
      payload: { optional: true, candidateInstanceIds: ['o0-0', 'o0-3'], count: 1 },
    });
    const legal = getLegalActions(state, 0, sampleCtx);
    expect(legal).toContainEqual(answer(state, ['o0-0']));
    expect(legal).toContainEqual(answer(state, ['o0-3']));
    expect(legal).toContainEqual(answer(state, [], true));
    expect(lp(state)).toEqual([8000, 8000]); // nothing is paid before the answer
  });

  it('accept: 800 LP paid, the chosen monster is destroyed', () => {
    const asked = apply(board(), summon('h0')).state;
    const { state, events } = apply(asked, answer(asked, ['o0-3']));
    expect(types(events)).toEqual([
      'EffectActivated',
      'LifePointsPaid',
      'ChainLinkAdded',
      'MonsterDestroyed',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([7200, 8000]);
    expect(state.players[1].board.monsterZones[3]).toBeNull();
    expect(state.players[1].board.monsterZones[0]).not.toBeNull();
    expect(events).toMatchSnapshot();
  });

  it('decline: nothing paid, nothing destroyed', () => {
    const asked = apply(board(), summon('h0')).state;
    const { state, events } = apply(asked, answer(asked, [], true));
    expect(events).toEqual([]);
    expect(lp(state)).toEqual([8000, 8000]);
    expect(state.players[1].board.monsterZones.filter((c) => c !== null)).toHaveLength(4);
  });

  it('a Level 5 or face-down monster is not a legal answer', () => {
    const asked = apply(board(), summon('h0')).state;
    expectEngineError(() => apply(asked, answer(asked, ['o0-1'])), 'INVALID_TRIGGER_ANSWER');
    expectEngineError(() => apply(asked, answer(asked, ['o0-2'])), 'INVALID_TRIGGER_ANSWER');
  });

  it('cannot pay (LP must stay above 0: exactly 800 LP is not enough): the trigger does not activate', () => {
    const { state, events } = apply(board(800), summon('h0'));
    expect(types(events)).toEqual(['NormalSummoned']);
    expect(state.pendingPrompt).toBeNull();
    const rich = apply(board(801), summon('h0')).state;
    expect(rich.pendingPrompt).toMatchObject({ kind: 'TriggerActivation' });
  });

  it('no legal target (only Level 5+ / face-down monsters): no prompt', () => {
    const s = main({
      hand: ['SMP-049'],
      oppMonsters: [
        [0, 'BIG_L5'],
        [1, 'M1', 'DefenseDown'],
      ],
    });
    expect(apply(s, summon('h0')).state.pendingPrompt).toBeNull();
  });
});
