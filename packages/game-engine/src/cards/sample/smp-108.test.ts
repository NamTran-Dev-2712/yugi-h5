import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, apply, main, sampleCtx, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.1 — SMP-108 Giantfall (Tier B), Normal Spell: target 1 face-up Level 5 or higher monster your opponent
 * controls; destroy it. The level filter means face-down monsters are never targets (their identity is hidden, 3.2).
 */

describe('SMP-108 Giantfall', () => {
  it('destroys a face-up Level 5+ opponent monster, leaves the Level 4 one', () => {
    const before = main({
      hand: ['SMP-108'],
      oppMonsters: [
        [0, 'M1'],
        [1, 'SMP-015'],
      ],
    });
    const { state, events } = apply(before, activate('h0', 'giant-fall'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(state.players[1].board.monsterZones[0]).not.toBeNull();
    expect(state.players[1].board.monsterZones[1]).toBeNull();
    expect(events).toMatchSnapshot();
  });

  it('a Level 5+ opponent monster in face-up Defense is a target too', () => {
    const before = main({ hand: ['SMP-108'], oppMonsters: [[0, 'SMP-018', 'DefenseUp']] });
    expect(apply(before, activate('h0', 'giant-fall')).state.players[1].board.monsterZones[0]).toBe(
      null,
    );
  });

  it('only Level 4 or lower: NO_VALID_TARGET, not listed', () => {
    const state = main({ hand: ['SMP-108'], oppMonsters: [[0, 'SMP-017']] });
    expectEngineError(() => apply(state, activate('h0', 'giant-fall')), 'NO_VALID_TARGET');
    expect(getLegalActions(state, 0, sampleCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );
  });

  it('a face-down Level 5+ monster is not a target', () => {
    expectEngineError(
      () =>
        apply(
          main({ hand: ['SMP-108'], oppMonsters: [[0, 'SMP-015', 'DefenseDown']] }),
          activate('h0', 'giant-fall'),
        ),
      'NO_VALID_TARGET',
    );
  });

  it('my own Level 5+ monster is not a target', () => {
    expectEngineError(
      () =>
        apply(
          main({ hand: ['SMP-108'], myMonsters: [[0, 'SMP-015']] }),
          activate('h0', 'giant-fall'),
        ),
      'NO_VALID_TARGET',
    );
  });
});
