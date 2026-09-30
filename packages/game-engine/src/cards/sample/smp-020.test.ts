import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { answer, apply, main, sampleCtx, summon, types } from '../../testing/sample-card-kit.js';

/*
 * Task 3.8 — SMP-020 Snarewood Tracker (Tier B): OnSummon OPTIONAL — destroy 1 Spell/Trap the opponent controls
 * (target chosen when it activates). The opponent's cards here are SMP-201 (no effect) so nothing can respond.
 */

const withBackrow = () =>
  main({
    hand: ['SMP-020'],
    oppSpellTraps: [
      [1, 'SMP-201'],
      [3, 'SMP-201'],
    ],
  });

describe('SMP-020 Snarewood Tracker', () => {
  it('Summon asks the owner (TriggerActivation); the answers are one per target + decline', () => {
    const { state, events } = apply(withBackrow(), summon('h0'));
    expect(types(events)).toEqual(['NormalSummoned']);
    expect(state.pendingPrompt).toMatchObject({ kind: 'TriggerActivation', playerIndex: 0 });
    const legal = getLegalActions(state, 0, sampleCtx);
    expect(legal).toContainEqual(answer(state, ['os-1']));
    expect(legal).toContainEqual(answer(state, ['os-3']));
    expect(legal).toContainEqual(answer(state, [], true));
  });

  it('accept + target: the chosen face-down Spell/Trap is destroyed', () => {
    const asked = apply(withBackrow(), summon('h0')).state;
    const { state, events } = apply(asked, answer(asked, ['os-3']));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'SpellTrapDestroyed',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[1].board.spellTrapZones[3]).toBeNull();
    expect(state.players[1].board.spellTrapZones[1]?.definitionId).toBe('SMP-201');
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toEqual(['SMP-201']);
    expect(events).toMatchSnapshot();
  });

  it('decline: nothing happens, the monster stays', () => {
    const asked = apply(withBackrow(), summon('h0')).state;
    const { state, events } = apply(asked, answer(asked, [], true));
    expect(events).toEqual([]);
    expect(state.pendingPrompt).toBeNull();
    expect(state.players[1].board.spellTrapZones.filter((c) => c !== null)).toHaveLength(2);
  });

  it('bad answers are rejected: own card as target, two targets', () => {
    const asked = apply(withBackrow(), summon('h0')).state;
    expectEngineError(() => apply(asked, answer(asked, ['m0-0'])), 'INVALID_TRIGGER_ANSWER');
    expectEngineError(
      () => apply(asked, answer(asked, ['os-1', 'os-3'])),
      'INVALID_TRIGGER_ANSWER',
    );
  });

  it('no Spell/Trap on the opponent side: no target, the trigger does not activate', () => {
    const { state, events } = apply(main({ hand: ['SMP-020'] }), summon('h0'));
    expect(types(events)).toEqual(['NormalSummoned']);
    expect(state.pendingPrompt).toBeNull();
  });
});
