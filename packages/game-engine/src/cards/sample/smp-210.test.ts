import { describe, expect, it } from 'vitest';
import type { Action } from '../../actions/types.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  lp,
  main,
  pass,
  setMonster,
  summon,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.4 — SMP-210 (Tier B), Counter Trap (Spell Speed 3): when your opponent Normal Summons or Flip Summons a
 * monster, negate the Summon; the monster goes to the graveyard. Player 0 Summons, player 1 holds the Set copy `os-0`.
 */

const NEGATE = 'gate-of-refusal';

describe('SMP-210', () => {
  it('negates a Normal Summon: the monster goes to the graveyard, the Normal Summon stays used', () => {
    const before = main({ hand: ['M1', 'M1'], oppSpellTraps: [[0, 'SMP-210']] });
    const opened = apply(before, summon('h0', 2)).state;
    expect(opened.chainWindow).toMatchObject({
      priorityPlayer: 1,
      reactionTo: { kind: 'Summon' },
      summoned: { playerIndex: 0, instanceId: 'h0' },
    });

    const { state, events } = apply(opened, activate('os-0', NEGATE, 1));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'SummonNegated',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events.find((e) => e.type === 'ChainLinkAdded')).toMatchObject({ spellSpeed: 3 });
    expect(state.players[0].board.monsterZones[2]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h0']);
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toEqual(['SMP-210']);
    expectEngineError(() => apply(state, summon('h1', 0)), 'NORMAL_SUMMON_USED');
    expect(events).toMatchSnapshot();
  });

  it('negates a Flip Summon', () => {
    const before = main({
      myMonsters: [[1, 'M1', 'DefenseDown']],
      oppSpellTraps: [[0, 'SMP-210']],
    });
    const flip: Action = {
      type: 'FlipSummon',
      payload: { playerIndex: 0, cardInstanceId: 'm0-1' },
    };
    const opened = apply(before, flip).state;
    const { state, events } = apply(opened, activate('os-0', NEGATE, 1));
    expect(types(events)).toContain('SummonNegated');
    expect(state.players[0].board.monsterZones[1]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['m0-1']);
  });

  it('task 4.4c: negates the Summon of SMP-019 (mandatory "when Summoned" burn) — the 300 damage never happens', () => {
    const before = main({ hand: ['SMP-019'], oppSpellTraps: [[0, 'SMP-210']] });
    const opened = apply(before, summon('h0', 2));
    // The Summon window comes before the trigger: nothing on the chain yet.
    expect(types(opened.events)).toEqual(['NormalSummoned']);
    expect(opened.state.chainStack).toEqual([]);
    expect(opened.state.chainWindow).toMatchObject({
      priorityPlayer: 1,
      reactionTo: { kind: 'Summon' },
    });

    const { state, events } = apply(opened.state, activate('os-0', NEGATE, 1));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'SummonNegated',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual(lp(before));
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-019']);
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(true);
    expect(state.chainWindow).toBeNull();
  });

  it('task 4.4c: the holder passes instead — SMP-019 then burns for 300, as with no Set card at all', () => {
    const before = main({ hand: ['SMP-019'], oppSpellTraps: [[0, 'SMP-210']] });
    const opened = apply(before, summon('h0', 2)).state;
    const { state, events } = apply(opened, pass(1));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    const direct = apply(main({ hand: ['SMP-019'] }), summon('h0', 2)).state;
    expect(lp(state)).toEqual(lp(direct));
    expect(lp(state)[1]).toBe(lp(before)[1] - 300);
    expect(state.players[1].board.spellTrapZones[0]?.position).toBe('DefenseDown');
  });

  it('task 4.4c: negates the Flip Summon of SMP-044 (optional FLIP effect) — its owner is never asked', () => {
    const before = main({
      myMonsters: [[1, 'SMP-044', 'DefenseDown']],
      oppMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'SMP-210']],
    });
    const flip: Action = {
      type: 'FlipSummon',
      payload: { playerIndex: 0, cardInstanceId: 'm0-1' },
    };
    const opened = apply(before, flip).state;
    expect(opened.pendingPrompt).toBeNull();
    const { state, events } = apply(opened, activate('os-0', NEGATE, 1));
    expect(types(events)).toContain('SummonNegated');
    expect(state.pendingPrompt).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['m0-1']);
    expect(state.players[1].board.monsterZones[0]?.instanceId).toBe('o0-0');

    // Passing instead: the owner is asked about the FLIP effect only now.
    const asked = apply(opened, pass(1)).state;
    expect(asked.pendingPrompt).toMatchObject({ kind: 'TriggerActivation', playerIndex: 0 });
  });

  it('a Set is not a Summon: no window; the holder may also just pass on a Summon', () => {
    const set = apply(main({ hand: ['M1'], oppSpellTraps: [[0, 'SMP-210']] }), setMonster('h0'));
    expect(set.state.chainWindow).toBeNull();

    const opened = apply(
      main({ hand: ['M1'], oppSpellTraps: [[0, 'SMP-210']] }),
      summon('h0'),
    ).state;
    const passed = apply(opened, pass(1)).state;
    expect(passed.players[0].board.monsterZones[0]?.instanceId).toBe('h0');
    expect(passed.players[1].board.spellTrapZones[0]?.position).toBe('DefenseDown');
  });

  it('never starts a chain, and cannot answer a Spell', () => {
    expectEngineError(
      () => apply(main({ mySpellTraps: [[0, 'SMP-210']] }), activate('ms-0', NEGATE)),
      'NOTHING_TO_RESPOND_TO',
    );
    const spell = apply(
      main({ hand: ['SMP-101'], oppSpellTraps: [[0, 'SMP-210']] }),
      activate('h0', 'draw-one'),
    );
    expect(spell.state.chainWindow).toBeNull();
    expect(types(spell.events)).toContain('CardDrawn');
  });
});
