import { describe, expect, it } from 'vitest';
import { effectiveStats } from '../../effects/continuous.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  lp,
  main,
  pass,
  sampleCtx,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.4 — SMP-209 (Tier B), Counter Trap (Spell Speed 3). Cost: pay 1000 LP. When your opponent activates a Spell or
 * Trap Card: negate that activation; the card goes to the graveyard. Player 0 activates, player 1 holds `os-0`.
 */

const NEGATE = 'sealing-rune';

describe('SMP-209', () => {
  it('negates a Normal Spell (SMP-101): nothing is drawn, 1000 LP paid, both cards in the graveyard', () => {
    const before = main({ hand: ['SMP-101'], oppSpellTraps: [[0, 'SMP-209']] });
    const waiting = apply(before, activate('h0', 'draw-one')).state;
    expect(waiting.chainWindow).toEqual({ priorityPlayer: 1, passCount: 0 });

    const { state, events } = apply(waiting, activate('os-0', NEGATE, 1));
    expect(types(events)).toEqual([
      'EffectActivated',
      'LifePointsPaid',
      'ChainLinkAdded',
      'ChainLinkNegated',
      'CardSentToGraveyard',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events.find((e) => e.type === 'ChainLinkAdded')).toMatchObject({ spellSpeed: 3 });
    expect(lp(state)).toEqual([8000, 7000]);
    expect(state.players[0].hand).toEqual([]);
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-101']);
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toEqual(['SMP-209']);
    expect(events).toMatchSnapshot();
  });

  it('negates a Continuous Spell (SMP-114): it leaves the field and its +300 ATK is gone', () => {
    const before = main({
      hand: ['SMP-114'],
      myMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'SMP-209']],
    });
    const waiting = apply(before, activate('h0', 'activate')).state;
    const atk = (s: typeof waiting) =>
      effectiveStats(s, s.players[0].board.monsterZones[0]!, sampleCtx).atk;
    expect(atk(waiting)).toBe(1300);
    const { state } = apply(waiting, activate('os-0', NEGATE, 1));
    expect(state.players[0].board.spellTrapZones.every((c) => c === null)).toBe(true);
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-114']);
    expect(atk(state)).toBe(1000);
  });

  it('negates a Trap (SMP-203) chained to my Spell — my own turn, from my Set copy', () => {
    const before = main({
      hand: ['SMP-101'],
      mySpellTraps: [[0, 'SMP-209']],
      oppSpellTraps: [[0, 'SMP-203']],
    });
    const link2 = apply(
      apply(before, activate('h0', 'draw-one')).state,
      activate('os-0', 'counterspark', 1),
    ).state;
    const { state, events } = apply(link2, activate('ms-0', NEGATE));
    expect(types(events)).not.toContain('DamageDealt');
    expect(types(events)).toContain('CardDrawn');
    expect(lp(state)).toEqual([7000, 8000]);
  });

  it('never starts a chain, needs more than 1000 LP, and is passed over when the opponent lets the Spell resolve', () => {
    expectEngineError(
      () => apply(main({ mySpellTraps: [[0, 'SMP-209']] }), activate('ms-0', NEGATE)),
      'NOTHING_TO_RESPOND_TO',
    );
    const poor = apply(
      main({ hand: ['SMP-101'], oppSpellTraps: [[0, 'SMP-209']], oppLp: 1000 }),
      activate('h0', 'draw-one'),
    );
    expect(poor.state.chainWindow).toBeNull();
    expect(types(poor.events)).toContain('CardDrawn');

    const waiting = apply(
      main({ hand: ['SMP-101'], oppSpellTraps: [[0, 'SMP-209']] }),
      activate('h0', 'draw-one'),
    ).state;
    const passed = apply(waiting, pass(1));
    expect(types(passed.events)).toContain('CardDrawn');
    expect(passed.state.players[1].board.spellTrapZones[0]?.position).toBe('DefenseDown');
  });

  it('does not answer a monster effect: only Spell/Trap activations', () => {
    // A fixture monster with a mandatory OnDestroyed trigger (400 damage) is destroyed by a fixture Spell.
    const before = main({
      hand: ['KILL'],
      mySpellTraps: [[0, 'SMP-209']],
      oppMonsters: [[0, 'DES_BURN']],
    });
    const { state, events } = apply(before, activate('h0', 'e1'));
    expect(state.chainWindow).toBeNull();
    expect(events.filter((e) => e.type === 'DamageDealt')).toHaveLength(1);
    expect(state.players[0].board.spellTrapZones[0]?.position).toBe('DefenseDown');
  });
});
