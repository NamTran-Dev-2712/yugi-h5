import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, answer, apply, battle, main, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-117 (Tier B), Normal Spell. Cost: discard 1 card. Target 1 face-up Level 4 or lower monster the
 * opponent controls; destroy it. `M1` is Level 4, `BIG_L5` Level 5.
 */

const EFFECT = 'culling';

describe('SMP-117', () => {
  it('discards the chosen card, destroys the only legal target', () => {
    const before = main({
      hand: ['SMP-117', 'M1'],
      oppMonsters: [
        [0, 'M1'],
        [1, 'BIG_L5'],
        [2, 'M1', 'DefenseDown'],
      ],
    });
    const { state, events } = apply(before, activate('h0', EFFECT, 0, ['h1']));
    expect(types(events)).toEqual([
      'EffectActivated',
      'CardDiscarded',
      'ChainLinkAdded',
      'MonsterDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(state.players[1].board.monsterZones.map((c) => c?.instanceId ?? null)).toEqual([
      null,
      'o0-1',
      'o0-2',
      null,
      null,
    ]);
    expect(state.players[0].hand).toEqual([]);
    expect(state.players[0].graveyard.map((c) => c.definitionId).sort()).toEqual(['M1', 'SMP-117']);
    expect(events).toMatchSnapshot();
  });

  it('two legal targets: asks which one, then destroys it', () => {
    const before = main({
      hand: ['SMP-117', 'SMP-103'],
      oppMonsters: [
        [0, 'M1'],
        [3, 'M2'],
      ],
    });
    const asked = apply(before, activate('h0', EFFECT, 0, ['h1'])).state;
    expect(asked.pendingPrompt).toMatchObject({
      kind: 'SelectEffectTarget',
      payload: { candidateInstanceIds: ['o0-0', 'o0-3'], count: 1 },
    });
    expect(asked.players[0].hand).toHaveLength(2); // nothing is paid before the target is chosen
    const { state } = apply(asked, answer(asked, ['o0-3']));
    expect(state.players[1].board.monsterZones[3]).toBeNull();
    expect(state.players[1].board.monsterZones[0]).not.toBeNull();
  });

  it('the cost must be paid: no other card in hand, or no card named → INVALID_COST', () => {
    const alone = main({ hand: ['SMP-117'], oppMonsters: [[0, 'M1']] });
    expectEngineError(() => apply(alone, activate('h0', EFFECT)), 'INVALID_COST');
    expectEngineError(() => apply(alone, activate('h0', EFFECT, 0, ['h0'])), 'INVALID_COST');
    const two = main({ hand: ['SMP-117', 'M1'], oppMonsters: [[0, 'M1']] });
    expectEngineError(() => apply(two, activate('h0', EFFECT)), 'INVALID_COST');
  });

  it('only Level 5+ or face-down monsters: NO_VALID_TARGET', () => {
    const s = main({
      hand: ['SMP-117', 'M1'],
      oppMonsters: [
        [0, 'BIG_L5'],
        [1, 'M1', 'DefenseDown'],
      ],
    });
    expectEngineError(() => apply(s, activate('h0', EFFECT, 0, ['h1'])), 'NO_VALID_TARGET');
  });

  it('a Normal Spell: Main Phase only', () => {
    const s = battle({ hand: ['SMP-117', 'M1'], oppMonsters: [[0, 'M1']] });
    expectEngineError(() => apply(s, activate('h0', EFFECT, 0, ['h1'])), 'WRONG_PHASE');
  });
});
