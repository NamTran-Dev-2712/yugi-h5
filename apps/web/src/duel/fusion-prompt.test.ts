import type { PlayerAction, StateView } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { loadFixture } from './fixtures';
import { fusionAnswer, fusionPromptOf, fusionSourceOf, isFusionAnswer } from './fusion-prompt';

/* Task 4.5b — reading a Fusion prompt and the one answer that may be sent without being listed in legalActions. */

const monster = loadFixture('fusion-monster').view;
const materials = loadFixture('fusion-material').view;

const answer = (
  view: StateView,
  ids: string[],
  extra: Record<string, unknown> = {},
): PlayerAction =>
  ({
    type: 'ResolvePendingPrompt',
    payload: {
      playerIndex: view.viewerIndex,
      promptId: view.pendingPrompt!.promptId,
      cardInstanceIds: ids,
      ...extra,
    },
  }) as PlayerAction;

const withPrompt = (view: StateView, over: Partial<NonNullable<StateView['pendingPrompt']>>) => ({
  ...view,
  pendingPrompt: { ...view.pendingPrompt!, ...over },
});

describe('fusionPromptOf', () => {
  it('reads kind, promptId, candidates (server order) and count from the prompt payload', () => {
    expect(fusionPromptOf(monster)).toEqual({
      kind: 'SelectFusionMonster',
      promptId: 'fusion-5-31',
      candidates: ['p0-x0', 'p0-x2'],
      count: 1,
    });
    expect(fusionPromptOf(materials)).toEqual({
      kind: 'SelectFusionMaterials',
      promptId: 'fusion-5-32',
      candidates: ['p0-1', 'p0-2', 'p0-11'],
      count: 2,
    });
  });

  it('is null without a prompt, for another prompt kind, and once the duel is over', () => {
    expect(fusionPromptOf(loadFixture('midgame').view)).toBeNull();
    expect(fusionPromptOf(loadFixture('effect-target').view)).toBeNull();
    expect(fusionPromptOf({ ...monster, winnerIndex: 1 })).toBeNull();
  });

  it('is null for a prompt addressed to the other seat (its payload is null on the wire)', () => {
    expect(fusionPromptOf(withPrompt(monster, { playerIndex: 1, payload: null }))).toBeNull();
    // Even if a payload were there, a prompt that is not mine is not mine to answer.
    expect(fusionPromptOf(withPrompt(monster, { playerIndex: 1 }))).toBeNull();
  });

  it.each([
    ['null payload', null],
    ['no candidates', { count: 1 }],
    ['candidates not a list', { candidateInstanceIds: 'p0-x0', count: 1 }],
    ['no count', { candidateInstanceIds: ['p0-x0'] }],
    ['count 0', { candidateInstanceIds: ['p0-x0'], count: 0 }],
    ['count not an integer', { candidateInstanceIds: ['p0-x0', 'p0-x2'], count: 1.5 }],
    ['fewer candidates than count', { candidateInstanceIds: ['p0-x0'], count: 2 }],
  ])('is null for a malformed payload (%s) — nothing is guessed', (_name, payload) => {
    expect(fusionPromptOf(withPrompt(monster, { payload }))).toBeNull();
  });
});

describe('isFusionAnswer — the only unlisted action the client may send', () => {
  it('accepts exactly `count` different candidates of the open Fusion prompt, in any order', () => {
    expect(isFusionAnswer(monster, answer(monster, ['p0-x2']))).toBe(true);
    expect(isFusionAnswer(materials, answer(materials, ['p0-2', 'p0-1']))).toBe(true);
    // A pair the server did not list among its combinations is still accepted here: the server decides.
    expect(isFusionAnswer(materials, answer(materials, ['p0-2', 'p0-11']))).toBe(true);
  });

  it('fusionAnswer builds that action from the prompt and the selection', () => {
    const prompt = fusionPromptOf(materials)!;
    const built = fusionAnswer(materials, prompt, ['p0-1', 'p0-11']);
    expect(built).toEqual(answer(materials, ['p0-1', 'p0-11']));
    expect(isFusionAnswer(materials, built)).toBe(true);
  });

  it.each([
    ['too few cards', ['p0-1']],
    ['too many cards', ['p0-1', 'p0-2', 'p0-11']],
    ['the same card twice', ['p0-1', 'p0-1']],
    ['a card that is not a candidate', ['p0-1', 'p0-3']],
    ['an opponent card', ['p0-1', 'p1-12']],
    ['nothing', []],
  ])('refuses %s', (_name, ids) => {
    expect(isFusionAnswer(materials, answer(materials, ids))).toBe(false);
  });

  it('refuses another prompt id, another seat, a decline, an extra key', () => {
    const ok = answer(materials, ['p0-1', 'p0-2']);
    const p = ok.payload as Record<string, unknown>;
    const forged = (payload: Record<string, unknown>): PlayerAction =>
      ({ type: 'ResolvePendingPrompt', payload }) as PlayerAction;
    expect(isFusionAnswer(materials, forged({ ...p, promptId: 'fusion-5-99' }))).toBe(false);
    expect(isFusionAnswer(materials, forged({ ...p, playerIndex: 1 }))).toBe(false);
    expect(isFusionAnswer(materials, forged({ ...p, decline: true }))).toBe(false);
    expect(isFusionAnswer(materials, forged({ ...p, zoneIndex: 2 }))).toBe(false);
  });

  it('refuses every other action type, and any answer when no Fusion prompt is open for me', () => {
    const endPhase: PlayerAction = { type: 'EndPhase', payload: { playerIndex: 0 } };
    expect(isFusionAnswer(materials, endPhase)).toBe(false);
    const summon: PlayerAction = {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex: 0 },
    };
    expect(isFusionAnswer(materials, summon)).toBe(false);
    const target = loadFixture('effect-target').view;
    const targetId = (target.pendingPrompt!.payload as { candidateInstanceIds: string[] })
      .candidateInstanceIds[0]!;
    expect(isFusionAnswer(target, answer(target, [targetId]))).toBe(false);
    expect(
      isFusionAnswer(
        withPrompt(materials, { playerIndex: 1 }),
        answer(materials, ['p0-1', 'p0-2']),
      ),
    ).toBe(false);
    expect(
      isFusionAnswer({ ...materials, winnerIndex: 0 }, answer(materials, ['p0-1', 'p0-2'])),
    ).toBe(false);
  });
});

describe('fusionSourceOf — the label under a material, read from where the view shows the card', () => {
  it('hand / field for my own cards (a face-down monster of mine is on the field too)', () => {
    expect(fusionSourceOf(materials, 'p0-1')).toBe('hand');
    expect(fusionSourceOf(materials, 'p0-2')).toBe('hand');
    expect(fusionSourceOf(materials, 'p0-10')).toBe('field');
    expect(fusionSourceOf(materials, 'p0-11')).toBe('field');
  });

  it('null for an Extra Deck card, an opponent card and an unknown id (no label is invented)', () => {
    expect(fusionSourceOf(materials, 'p0-x0')).toBeNull();
    expect(fusionSourceOf(materials, 'p1-12')).toBeNull();
    expect(fusionSourceOf(materials, 'p1-h1')).toBeNull();
    expect(fusionSourceOf(materials, 'nope')).toBeNull();
  });
});
