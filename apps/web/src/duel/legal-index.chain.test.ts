import type { PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { loadFixture } from './fixtures';
import { activatableSetCards, isListed, passAction, triggerAnswers } from './legal-index';

/** Task 3.7: lookups for the chain UI. Only filtering of what the server listed. */

const pass0: PlayerAction = { type: 'PassPriority', payload: { playerIndex: 0 } };
const pass1: PlayerAction = { type: 'PassPriority', payload: { playerIndex: 1 } };

describe('passAction', () => {
  it('returns the listed PassPriority of the viewer', () => {
    expect(passAction([pass1, pass0], 0)).toBe(pass0);
  });

  it('is null when only the other seat may pass, or nobody', () => {
    expect(passAction([pass1], 0)).toBeNull();
    expect(passAction(loadFixture('midgame').legalActions, 0)).toBeNull();
  });
});

describe('activatableSetCards', () => {
  it('lists my Set cards with at least one listed ActivateEffect, in the order given', () => {
    const f = loadFixture('chain-respond');
    expect(activatableSetCards(f.legalActions, 0, ['p0-30', 'p0-31', 'p0-99'])).toEqual([
      'p0-30',
      'p0-31',
    ]);
  });

  it('ignores activations of another seat and cards not asked about', () => {
    const other: PlayerAction = {
      type: 'ActivateEffect',
      payload: { playerIndex: 1, cardInstanceId: 'p0-31', effectId: 'x' },
    };
    const f = loadFixture('chain-reaction');
    expect(activatableSetCards([other, ...f.legalActions], 0, ['p0-31'])).toEqual([]);
    expect(activatableSetCards(f.legalActions, 0, ['p0-31'])).toEqual([]);
    expect(activatableSetCards(f.legalActions, 0, ['p0-30'])).toEqual(['p0-30']);
  });
});

describe('triggerAnswers', () => {
  const f = loadFixture('trigger-optional');
  const promptId = f.view.pendingPrompt!.promptId;

  it('splits the decline answer from the activating answers', () => {
    const { answers, decline } = triggerAnswers(f.legalActions, 0, promptId);
    expect(answers.map((a) => a.payload.cardInstanceIds)).toEqual([['p1-10'], ['p1-12']]);
    expect(answers.every((a) => a.payload.decline !== true)).toBe(true);
    expect(decline?.payload.decline).toBe(true);
    for (const a of [...answers, decline!]) expect(isListed(f.legalActions, a)).toBe(true);
  });

  it('has no decline for a mandatory trigger (nothing listed)', () => {
    const legal = f.legalActions.filter(
      (a) => !(a.type === 'ResolvePendingPrompt' && a.payload.decline),
    );
    expect(triggerAnswers(legal, 0, promptId).decline).toBeNull();
  });

  it('ignores answers to another prompt or of another seat', () => {
    expect(triggerAnswers(f.legalActions, 0, 'other').answers).toEqual([]);
    expect(triggerAnswers(f.legalActions, 1, promptId).answers).toEqual([]);
  });
});
