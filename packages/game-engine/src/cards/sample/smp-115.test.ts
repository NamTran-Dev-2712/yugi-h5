import { describe, expect, it } from 'vitest';
import type { GameState } from '../../state/types.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, apply, lp, main, setSpellTrap, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.3 — SMP-115 (Tier B), Normal Spell: inflict 600 damage to your opponent. The real card used for "a Normal Spell
 * that was Set is activated from its Spell/Trap Zone" (your turn, Main Phase; it then goes to the graveyard).
 */

describe('SMP-115', () => {
  it('from the hand: 600 damage, then the graveyard', () => {
    const { state, events } = apply(main({ hand: ['SMP-115'] }), activate('h0', 'ember-burn'));
    expect(lp(state)).toEqual([8000, 7400]);
    expect(events).toContainEqual({
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'h0',
      definitionId: 'SMP-115',
      from: 'Hand',
    });
  });

  it('Set, then activated from its zone on the same turn: 600 damage, graveyard from the Spell/Trap Zone', () => {
    const set = apply(main({ hand: ['SMP-115'] }), setSpellTrap('h0', 3)).state;
    const { state, events } = apply(set, activate('h0', 'ember-burn'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events).toContainEqual({
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'h0',
      definitionId: 'SMP-115',
      from: 'SpellTrapZone',
    });
    expect(lp(state)).toEqual([8000, 7400]);
    expect(state.players[0].board.spellTrapZones[3]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h0']);
  });

  it('Set on an earlier turn: activated in Main Phase 2, not in the Battle Phase', () => {
    const later = main({ mySpellTraps: [[0, 'SMP-115', 1]] }, 'Main2');
    expect(lp(apply(later, activate('ms-0', 'ember-burn')).state)).toEqual([8000, 7400]);
    const battle: GameState = { ...later, phase: 'Battle' };
    expectEngineError(() => apply(battle, activate('ms-0', 'ember-burn')), 'WRONG_PHASE');
  });

  it('the opponent cannot activate their Set copy on my turn', () => {
    const theirs = main({ oppSpellTraps: [[0, 'SMP-115', 1]] });
    expectEngineError(() => apply(theirs, activate('os-0', 'ember-burn', 1)), 'NOT_TURN_PLAYER');
  });
});
