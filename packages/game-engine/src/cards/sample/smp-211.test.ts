import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  answer,
  apply,
  battle,
  lp,
  main,
  setSpellTrap,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-211 (Tier B), Normal Trap. Cost: discard 1 card. Target 1 monster in your graveyard; Special Summon it
 * in face-up Defense Position. A Trap: Set it first, not on the turn it was Set.
 */

const EFFECT = 'second-rising';

describe('SMP-211', () => {
  it('Set on an earlier turn: discards, then the monster returns in face-up Defense (any phase)', () => {
    const before = battle({
      mySpellTraps: [[0, 'SMP-211', 1]],
      hand: ['SMP-103'],
      myGraveyard: ['BIG', 'SMP-101'],
    });
    const { state, events } = apply(before, activate('ms-0', EFFECT, 0, ['h0']));
    expect(types(events)).toEqual([
      'EffectActivated',
      'CardDiscarded',
      'ChainLinkAdded',
      'MonsterSpecialSummoned',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(state.players[0].board.monsterZones[0]).toMatchObject({
      instanceId: 'g0',
      position: 'DefenseUp',
    });
    expect(state.players[0].hand).toEqual([]);
    expect(state.players[0].graveyard.map((c) => c.definitionId).sort()).toEqual([
      'SMP-101',
      'SMP-103',
      'SMP-211',
    ]);
    expect(events).toMatchSnapshot();
  });

  it('several monsters in the graveyard: asks which one (a Level 8 monster comes back without Tributes)', () => {
    const before = main({
      mySpellTraps: [[0, 'SMP-211', 1]],
      hand: ['SMP-103'],
      myGraveyard: ['M1', 'SMP-003'],
    });
    const asked = apply(before, activate('ms-0', EFFECT, 0, ['h0'])).state;
    expect(asked.pendingPrompt).toMatchObject({
      kind: 'SelectEffectTarget',
      payload: { candidateInstanceIds: ['g0', 'g1'], count: 1 },
    });
    const { state } = apply(asked, answer(asked, ['g1']));
    expect(state.players[0].board.monsterZones[0]).toMatchObject({ definitionId: 'SMP-003' });
  });

  it('a Trap: not from the hand, not on the turn it was Set', () => {
    const start = main({ hand: ['SMP-211', 'SMP-103'], myGraveyard: ['BIG'] });
    expectEngineError(() => apply(start, activate('h0', EFFECT, 0, ['h1'])), 'TRAP_NOT_SET');
    const set = apply(start, setSpellTrap('h0', 0)).state;
    expectEngineError(() => apply(set, activate('h0', EFFECT, 0, ['h1'])), 'TRAP_SET_THIS_TURN');
  });

  it('nothing to discard → INVALID_COST; the monster discarded as the cost is not a target → NO_VALID_TARGET', () => {
    const noHand = main({ mySpellTraps: [[0, 'SMP-211', 1]], myGraveyard: ['BIG'] });
    expectEngineError(() => apply(noHand, activate('ms-0', EFFECT)), 'INVALID_COST');
    const emptyGrave = main({ mySpellTraps: [[0, 'SMP-211', 1]], hand: ['BIG'] });
    expectEngineError(
      () => apply(emptyGrave, activate('ms-0', EFFECT, 0, ['h0'])),
      'NO_VALID_TARGET',
    );
  });

  it('the returning monster is Summoned: SMP-048 heals its controller', () => {
    const before = main({
      mySpellTraps: [[0, 'SMP-211', 1]],
      hand: ['SMP-103'],
      myGraveyard: ['SMP-048'],
    });
    const { state } = apply(before, activate('ms-0', EFFECT, 0, ['h0']));
    expect(lp(state)).toEqual([8500, 8000]);
  });
});
