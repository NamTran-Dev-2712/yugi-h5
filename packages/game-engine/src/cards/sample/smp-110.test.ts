import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  attack,
  battle,
  lp,
  main,
  sampleCtx,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.1 — SMP-110 Lifespark Exchange (Tier B), Quick-Play Spell (Spell Speed 2). Cost: discard 1 MONSTER card.
 * Inflict 600 damage to your opponent, then gain 600 LP (two operations, in order).
 */

describe('SMP-110 Lifespark Exchange', () => {
  it('discards a monster, then 600 damage and 600 LP gain', () => {
    const before = main({ hand: ['SMP-110', 'M1'], myLp: 5000 });
    const { state, events } = apply(before, activate('h0', 'lifespark', 0, ['h1']));
    expect(types(events)).toEqual([
      'EffectActivated',
      'CardDiscarded',
      'ChainLinkAdded',
      'DamageDealt',
      'LifePointsRecovered',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([5600, 7400]);
    expect(events).toMatchSnapshot();
  });

  it('a Spell is not a valid discard (cost filter: Monster)', () => {
    const state = main({ hand: ['SMP-110', 'SMP-103'] });
    expectEngineError(() => apply(state, activate('h0', 'lifespark', 0, ['h1'])), 'INVALID_COST');
    // (SMP-103 itself stays activatable; only SMP-110 must be missing.)
    expect(
      getLegalActions(state, 0, sampleCtx).some(
        (a) => a.type === 'ActivateEffect' && a.payload.cardInstanceId === 'h0',
      ),
    ).toBe(false);
  });

  it('listed only with the monster as the cost', () => {
    const legal = getLegalActions(main({ hand: ['SMP-110', 'SMP-103', 'M1'] }), 0, sampleCtx);
    expect(
      legal.filter((a) => a.type === 'ActivateEffect' && a.payload.cardInstanceId === 'h0'),
    ).toEqual([activate('h0', 'lifespark', 0, ['h2'])]);
  });

  it('Set earlier: answers the opponent attack (Spell Speed 2)', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'SMP-110']] });
    const opened = apply(before, attack('m0-0')).state;
    expect(opened.chainWindow).toMatchObject({ priorityPlayer: 1, reactionTo: { kind: 'Attack' } });
    // Player 1 discards a card from the hand dealt by StartDuel (all fixture monsters `D`).
    const discard = opened.players[1].hand[0]!.instanceId;
    const { state } = apply(opened, activate('os-0', 'lifespark', 1, [discard]));
    // 600 to player 0, player 1 gains 600 then takes the 2000 direct attack.
    expect(lp(state)).toEqual([7400, 6600]);
  });
});
