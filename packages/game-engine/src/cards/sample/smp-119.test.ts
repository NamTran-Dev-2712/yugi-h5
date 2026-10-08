import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  answer,
  apply,
  battle,
  main,
  setSpellTrap,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-119 (Tier B), Quick-Play Spell: target 1 Spell/Trap the opponent controls; destroy it. From the hand in
 * any phase of your own turn; once Set, not on the turn it was Set.
 */

const EFFECT = 'snap-gust';

describe('SMP-119', () => {
  it('from the hand in the Battle Phase: destroys the only Spell/Trap', () => {
    const before = battle({ hand: ['SMP-119'], oppSpellTraps: [[2, 'TRAP_PLAIN']] });
    const { state, events } = apply(before, activate('h0', EFFECT));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'SpellTrapDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events.find((e) => e.type === 'ChainLinkAdded')).toMatchObject({ spellSpeed: 2 });
    expect(state.players[1].board.spellTrapZones[2]).toBeNull();
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toEqual(['TRAP_PLAIN']);
    expect(events).toMatchSnapshot();
  });

  it('several Spells/Traps (a Field Spell included): asks which one', () => {
    const before = main({
      hand: ['SMP-119'],
      oppSpellTraps: [[0, 'TRAP_PLAIN']],
      oppField: ['SMP-113', 'Attack'],
    });
    const asked = apply(before, activate('h0', EFFECT)).state;
    expect(asked.pendingPrompt).toMatchObject({
      kind: 'SelectEffectTarget',
      payload: { candidateInstanceIds: ['os-0', 'of'] },
    });
    const { state, events } = apply(asked, answer(asked, ['of']));
    expect(types(events)).toContain('FieldSpellDestroyed');
    expect(state.players[1].board.fieldZone).toBeNull();
    expect(state.players[1].board.spellTrapZones[0]).not.toBeNull();
  });

  it('nothing to destroy: NO_VALID_TARGET (my own cards are not targets)', () => {
    const s = main({ hand: ['SMP-119'], mySpellTraps: [[0, 'TRAP_PLAIN']] });
    expectEngineError(() => apply(s, activate('h0', EFFECT)), 'NO_VALID_TARGET');
  });

  it('Set this turn: not yet; Set on an earlier turn: activated from its zone', () => {
    const start = main({ hand: ['SMP-119'], oppSpellTraps: [[0, 'TRAP_PLAIN']] });
    const set = apply(start, setSpellTrap('h0', 0)).state;
    expectEngineError(() => apply(set, activate('h0', EFFECT)), 'SPELL_SET_THIS_TURN');
    const earlier = main({
      mySpellTraps: [[1, 'SMP-119', 1]],
      oppSpellTraps: [[0, 'TRAP_PLAIN']],
    });
    const { state } = apply(earlier, activate('ms-1', EFFECT));
    expect(state.players[1].board.spellTrapZones[0]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-119']);
  });
});
