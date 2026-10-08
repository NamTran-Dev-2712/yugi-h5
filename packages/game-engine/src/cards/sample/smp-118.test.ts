import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, apply, battle, main, types } from '../../testing/sample-card-kit.js';

/* Task 4.7 — SMP-118 (Tier B), Normal Spell. Cost: Tribute 1 monster you control. Draw 2 cards. */

const EFFECT = 'offering-draw';

describe('SMP-118', () => {
  it('Tributes my monster, draws 2', () => {
    const before = main({
      hand: ['SMP-118'],
      myMonsters: [
        [0, 'M1'],
        [1, 'BIG'],
      ],
    });
    const { state, events } = apply(before, activate('h0', EFFECT, 0, ['m0-0']));
    expect(types(events)).toEqual([
      'EffectActivated',
      'MonsterTributed',
      'ChainLinkAdded',
      'CardDrawn',
      'CardDrawn',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(state.players[0].hand).toHaveLength(2);
    expect(state.players[0].board.monsterZones[0]).toBeNull();
    expect(state.players[0].board.monsterZones[1]).not.toBeNull();
    expect(state.players[0].graveyard.map((c) => c.definitionId).sort()).toEqual(['M1', 'SMP-118']);
    expect(events).toMatchSnapshot();
  });

  it('a face-down monster of mine can be Tributed too', () => {
    const before = main({ hand: ['SMP-118'], myMonsters: [[0, 'M1', 'DefenseDown']] });
    const { state } = apply(before, activate('h0', EFFECT, 0, ['m0-0']));
    expect(state.players[0].hand).toHaveLength(2);
  });

  it('no monster of mine, none named, or the opponent`s monster named → INVALID_COST', () => {
    const none = main({ hand: ['SMP-118'], oppMonsters: [[0, 'M1']] });
    expectEngineError(() => apply(none, activate('h0', EFFECT)), 'INVALID_COST');
    expectEngineError(() => apply(none, activate('h0', EFFECT, 0, ['o0-0'])), 'INVALID_COST');
    const mine = main({ hand: ['SMP-118'], myMonsters: [[0, 'M1']] });
    expectEngineError(() => apply(mine, activate('h0', EFFECT)), 'INVALID_COST');
  });

  it('a Normal Spell: Main Phase only', () => {
    const s = battle({ hand: ['SMP-118'], myMonsters: [[0, 'M1']] });
    expectEngineError(() => apply(s, activate('h0', EFFECT, 0, ['m0-0'])), 'WRONG_PHASE');
  });
});
