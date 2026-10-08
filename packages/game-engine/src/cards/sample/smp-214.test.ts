import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, apply, lp, main, pass, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-214 (Tier B), Counter Trap (Spell Speed 3). Cost: discard 1 card. When your opponent activates a SPELL
 * Card: negate that activation; the card goes to the graveyard. Player 0 activates, player 1 holds `os-0` and discards
 * the first card of their hand (`p1-…`, dealt by the fixture).
 */

const NEGATE = 'spell-ward';

const spellOnChain = () =>
  apply(main({ hand: ['SMP-101'], oppSpellTraps: [[0, 'SMP-214']] }), activate('h0', 'draw-one'))
    .state;

describe('SMP-214', () => {
  it('negates a Normal Spell (SMP-101): nothing is drawn, 1 card discarded, both cards in the graveyard', () => {
    const waiting = spellOnChain();
    expect(waiting.chainWindow).toMatchObject({ priorityPlayer: 1 });
    const discard = waiting.players[1].hand[0]!;

    const { state, events } = apply(waiting, activate('os-0', NEGATE, 1, [discard.instanceId]));
    expect(types(events)).toEqual([
      'EffectActivated',
      'CardDiscarded',
      'ChainLinkAdded',
      'ChainLinkNegated',
      'CardSentToGraveyard',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events.find((e) => e.type === 'ChainLinkAdded')).toMatchObject({ spellSpeed: 3 });
    expect(types(events)).not.toContain('CardDrawn');
    expect(lp(state)).toEqual([8000, 8000]);
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-101']);
    expect(state.players[1].hand).toHaveLength(waiting.players[1].hand.length - 1);
    expect(state.players[1].graveyard.map((c) => c.definitionId).sort()).toEqual(
      [discard.definitionId, 'SMP-214'].sort(),
    );
    expect(events).toMatchSnapshot();
  });

  it('the cost must be named: no discard → INVALID_COST; passing lets the Spell resolve', () => {
    const waiting = spellOnChain();
    expectEngineError(() => apply(waiting, activate('os-0', NEGATE, 1)), 'INVALID_COST');
    const passed = apply(waiting, pass(1));
    expect(types(passed.events)).toContain('CardDrawn');
    expect(passed.state.players[1].board.spellTrapZones[0]?.position).toBe('DefenseDown');
  });

  it('does not answer a Trap: my Set SMP-203 resolves at once (SMP-209 would have stopped it)', () => {
    const before = main({ mySpellTraps: [[0, 'SMP-203', 1]], oppSpellTraps: [[0, 'SMP-214']] });
    const { state, events } = apply(before, activate('ms-0', 'counterspark'));
    expect(state.chainWindow).toBeNull();
    expect(types(events)).toContain('DamageDealt');
    expect(lp(state)).toEqual([8000, 7200]);
  });

  it('does not answer a monster effect either: SMP-019 burns on Summon', () => {
    const before = main({ hand: ['SMP-019'], oppSpellTraps: [[0, 'SMP-214']] });
    const { state } = apply(before, {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 0 },
    });
    expect(state.chainWindow).toBeNull();
    expect(lp(state)).toEqual([8000, 7700]);
  });

  it('a Counter Trap never starts a chain', () => {
    const s = main({ mySpellTraps: [[0, 'SMP-214', 1]], hand: ['M1'] });
    expectEngineError(() => apply(s, activate('ms-0', NEGATE, 0, ['h0'])), 'NOTHING_TO_RESPOND_TO');
  });
});
