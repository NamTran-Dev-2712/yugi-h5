import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, answer, apply, main, sampleCtx, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.1 — SMP-105 Canopy Gale (Tier B), Normal Spell: target 1 Spell/Trap your opponent controls; destroy it.
 */

describe('SMP-105 Canopy Gale', () => {
  it('destroys the only opponent Spell/Trap (target chosen automatically)', () => {
    const before = main({ hand: ['SMP-105'], oppSpellTraps: [[0, 'SMP-201']] });
    const { state, events } = apply(before, activate('h0', 'gale-sweep'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'SpellTrapDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(state.players[1].board.spellTrapZones[0]).toBeNull();
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toEqual(['SMP-201']);
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-105']);
    expect(events).toMatchSnapshot();
  });

  it('two opponent Spells/Traps: asks which one, destroys only that one', () => {
    const before = main({
      hand: ['SMP-105'],
      oppSpellTraps: [
        [0, 'SMP-201'],
        [3, 'SMP-201'],
      ],
    });
    const asked = apply(before, activate('h0', 'gale-sweep')).state;
    expect(asked.pendingPrompt).toMatchObject({ kind: 'SelectEffectTarget', playerIndex: 0 });
    const { state } = apply(asked, answer(asked, ['os-3']));
    expect(state.players[1].board.spellTrapZones[0]).not.toBeNull();
    expect(state.players[1].board.spellTrapZones[3]).toBeNull();
  });

  it('no opponent Spell/Trap: NO_VALID_TARGET and not listed', () => {
    const state = main({ hand: ['SMP-105'] });
    expectEngineError(() => apply(state, activate('h0', 'gale-sweep')), 'NO_VALID_TARGET');
    expect(getLegalActions(state, 0, sampleCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );
  });

  it('my own Spell/Trap is never a target', () => {
    expectEngineError(
      () =>
        apply(
          main({ hand: ['SMP-105'], mySpellTraps: [[0, 'SMP-201']] }),
          activate('h0', 'gale-sweep'),
        ),
      'NO_VALID_TARGET',
    );
  });
});
