import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { getLegalActions } from '../legal-actions.js';
import type { GameState } from '../state/types.js';
import type { FixtureSetup } from '../testing/effect-fixtures.js';
import {
  activate,
  answer,
  apply,
  battle,
  endPhase,
  lp,
  main,
  pass,
  sampleCtx,
  summon,
  types,
  withMonsterEffects,
} from '../testing/sample-card-kit.js';

/*
 * Task 4.8 — a face-up monster in its controller's Monster Zone activates its own Ignition effect (`ActivateEffect`),
 * behind `ruleset.allowMonsterEffectActivation` (absent = off: nothing changes), and `oncePerTurn` on an effect.
 * G28 [DECISION] (owner, 2026-10-09): usable on the very turn the monster was Summoned / flipped; "once per turn" is
 * counted per copy of the card. Test-only cards `IGN_*` (testing/sample-card-kit.ts). Player 0 is the turn player.
 */

const on = (setup: FixtureSetup, phase: 'Main1' | 'Main2' = 'Main1'): GameState =>
  withMonsterEffects(main(setup, phase));

const monsterAt = (state: GameState, zone = 0, player: 0 | 1 = 0) =>
  state.players[player].board.monsterZones[zone];

/** Ends phases (whoever's turn it is) until player 0 is in Main Phase 1 of a later turn. */
const nextOwnMain1 = (from: GameState): GameState => {
  let state = from;
  for (let i = 0; i < 20; i++) {
    state = apply(state, endPhase(state.turnPlayerIndex)).state;
    if (state.turnPlayerIndex === 0 && state.phase === 'Main1' && state.turnCount > from.turnCount)
      return state;
  }
  throw new Error('never came back to Main Phase 1');
};

describe('the flag is off (default): a monster on the field activates nothing, exactly as before', () => {
  it('the default ruleset has no such key at all (older states and golden files stay as they are)', () => {
    expect('allowMonsterEffectActivation' in main({}).ruleset).toBe(false);
  });

  it('own face-up monster with an Ignition effect: CARD_NOT_IN_HAND', () => {
    const state = main({ myMonsters: [[0, 'IGN_PAY']] });
    expectEngineError(() => apply(state, activate('m0-0', 'e1')), 'CARD_NOT_IN_HAND');
  });

  it('own monster with a Continuous effect: CONTINUOUS_NOT_ACTIVATABLE; a monster in the hand: NOT_A_SPELL_TRAP', () => {
    const state = main({ hand: ['IGN_PAY'], myMonsters: [[0, 'CONT_WALL']] });
    expectEngineError(() => apply(state, activate('m0-0', 'e1')), 'CONTINUOUS_NOT_ACTIVATABLE');
    expectEngineError(() => apply(state, activate('h0', 'e1')), 'NOT_A_SPELL_TRAP');
  });

  it('nothing of a monster is listed in the legal actions', () => {
    const state = main({
      hand: ['M1'],
      myMonsters: [
        [0, 'IGN_PAY'],
        [1, 'IGN_ONCE'],
      ],
    });
    expect(getLegalActions(state, 0, sampleCtx).filter((a) => a.type === 'ActivateEffect')).toEqual(
      [],
    );
  });

  it('an explicit false is off too', () => {
    const state = main({ myMonsters: [[0, 'IGN_PAY']] });
    const off: GameState = {
      ...state,
      ruleset: { ...state.ruleset, allowMonsterEffectActivation: false },
    };
    expectEngineError(() => apply(off, activate('m0-0', 'e1')), 'CARD_NOT_IN_HAND');
  });
});

describe('the flag is on: activating an Ignition effect of a monster on the field', () => {
  it('pays the cost, goes on the chain as a Spell Speed 1 link from the Monster Zone, resolves; the monster STAYS', () => {
    const before = on({ myMonsters: [[0, 'IGN_PAY']] });
    const { state, events } = apply(before, activate('m0-0', 'e1'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'LifePointsPaid',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(events[2]).toMatchObject({ instanceId: 'm0-0', effectId: 'e1', spellSpeed: 1 });
    expect(lp(state)).toEqual([7500, 7500]);
    expect(monsterAt(state)).toMatchObject({ instanceId: 'm0-0', position: 'Attack' });
    expect(state.players[0].graveyard).toEqual([]);
    expect(state.chainStack).toEqual([]);
    expect(state.chainWindow).toBeNull();
    expect(state.version).toBe(before.version + 1);
  });

  it('works in Main Phase 2 and for a monster in face-up Defense Position', () => {
    const state = on({ myMonsters: [[0, 'IGN_PAY', 'DefenseUp']] }, 'Main2');
    expect(lp(apply(state, activate('m0-0', 'e1')).state)).toEqual([7500, 7500]);
  });

  it('an effect without `oncePerTurn` may be activated again and again in the same turn', () => {
    let state = on({ myMonsters: [[0, 'IGN_PAY']] });
    for (let i = 0; i < 3; i++) state = apply(state, activate('m0-0', 'e1')).state;
    expect(lp(state)).toEqual([6500, 6500]);
  });

  it('G28 [DECISION]: usable on the very turn the monster was Normal Summoned', () => {
    const summoned = apply(on({ hand: ['IGN_PAY'] }), summon('h0')).state;
    expect(monsterAt(summoned)).toMatchObject({ instanceId: 'h0', summonedTurn: 3 });
    expect(lp(apply(summoned, activate('h0', 'e1')).state)).toEqual([7500, 7500]);
  });

  it('wrong phase: WRONG_PHASE', () => {
    const state = withMonsterEffects(battle({ myMonsters: [[0, 'IGN_PAY']] }));
    expectEngineError(() => apply(state, activate('m0-0', 'e1')), 'WRONG_PHASE');
  });

  it("not your turn: NOT_TURN_PLAYER; the opponent's monster is never yours to activate: CARD_NOT_IN_HAND", () => {
    const state = on({ oppMonsters: [[0, 'IGN_PAY']] });
    expectEngineError(() => apply(state, activate('o0-0', 'e1', 1)), 'NOT_TURN_PLAYER');
    expectEngineError(() => apply(state, activate('o0-0', 'e1', 0)), 'CARD_NOT_IN_HAND');
  });

  it('a face-down monster: NOT_ACTIVATABLE', () => {
    const state = on({ myMonsters: [[0, 'IGN_PAY', 'DefenseDown']] });
    expectEngineError(() => apply(state, activate('m0-0', 'e1')), 'NOT_ACTIVATABLE');
  });

  it('only Ignition: a trigger effect / a Quick effect of a monster is NOT_ACTIVATABLE, a Continuous one CONTINUOUS_NOT_ACTIVATABLE', () => {
    const state = on({
      myMonsters: [
        [0, 'SUM_HEAL'],
        [1, 'DES_DRAW'],
        [2, 'MON_QUICK'],
        [3, 'CONT_WALL'],
      ],
    });
    expectEngineError(() => apply(state, activate('m0-0', 'e1')), 'NOT_ACTIVATABLE');
    expectEngineError(() => apply(state, activate('m0-1', 'e1')), 'NOT_ACTIVATABLE');
    expectEngineError(() => apply(state, activate('m0-2', 'e1')), 'NOT_ACTIVATABLE');
    expectEngineError(() => apply(state, activate('m0-3', 'e1')), 'CONTINUOUS_NOT_ACTIVATABLE');
  });

  it('an unknown effect id: EFFECT_NOT_FOUND; a monster without effects: EFFECT_NOT_FOUND', () => {
    const state = on({
      myMonsters: [
        [0, 'IGN_PAY'],
        [1, 'M1'],
      ],
    });
    expectEngineError(() => apply(state, activate('m0-0', 'nope')), 'EFFECT_NOT_FOUND');
    expectEngineError(() => apply(state, activate('m0-1', 'e1')), 'EFFECT_NOT_FOUND');
  });

  it('a monster in the HAND still cannot activate: NOT_A_SPELL_TRAP', () => {
    const state = on({ hand: ['IGN_PAY'] });
    expectEngineError(() => apply(state, activate('h0', 'e1')), 'NOT_A_SPELL_TRAP');
  });

  it('Spell Speed 1: it cannot be chained to a link already on the chain (SPELL_SPEED_TOO_LOW)', () => {
    // Player 0 starts a chain with a Quick-Play; the opponent (a Set Trap keeps the window open) passes; player 0 still
    // holds a second Quick-Play, so the window waits for them — the monster's Ignition effect is not a response.
    const state = on({
      hand: ['QP_HEAL', 'QP_BURN'],
      myMonsters: [[0, 'IGN_PAY']],
      oppSpellTraps: [[0, 'TRAP']],
    });
    const chained = apply(apply(state, activate('h0', 'e1')).state, pass(1)).state;
    expect(chained.chainWindow).toMatchObject({ priorityPlayer: 0 });
    expectEngineError(() => apply(chained, activate('m0-0', 'e1')), 'SPELL_SPEED_TOO_LOW');
  });

  it('the opponent may answer the link: their Set Trap resolves first, then the monster effect', () => {
    const state = on({ myMonsters: [[0, 'IGN_PAY']], oppSpellTraps: [[0, 'TRAP_BURN']] });
    const waiting = apply(state, activate('m0-0', 'e1')).state;
    expect(waiting.chainWindow).toMatchObject({ priorityPlayer: 1 });
    expect(waiting.chainStack).toHaveLength(1);
    expect(waiting.chainStack[0]).toMatchObject({
      source: { zone: 'MonsterZone', zoneIndex: 0 },
      lpPaid: 500,
    });
    const { state: done, events } = apply(waiting, activate('os-0', 'e1', 1));
    expect(types(events).filter((t) => t === 'EffectResolved')).toHaveLength(2);
    expect(lp(done)).toEqual([7200, 7500]);
    expect(monsterAt(done)).toMatchObject({ instanceId: 'm0-0' });
  });

  it('a target is chosen at activation (SelectEffectTarget prompt), as for a Spell', () => {
    const state = on({
      myMonsters: [[0, 'IGN_KILL']],
      oppMonsters: [
        [0, 'M1'],
        [1, 'M2'],
      ],
    });
    const asked = apply(state, activate('m0-0', 'e1')).state;
    expect(asked.pendingPrompt).toMatchObject({
      kind: 'SelectEffectTarget',
      playerIndex: 0,
      payload: { cardInstanceId: 'm0-0', candidateInstanceIds: ['o0-0', 'o0-1'], count: 1 },
    });
    const done = apply(asked, answer(asked, ['o0-1']));
    expect(types(done.events)).toContain('MonsterDestroyed');
    expect(monsterAt(done.state, 1, 1)).toBeNull();
    expect(monsterAt(done.state)).toMatchObject({ instanceId: 'm0-0' });
  });

  it('no legal target: NO_VALID_TARGET', () => {
    const state = on({ myMonsters: [[0, 'IGN_KILL']] });
    expectEngineError(() => apply(state, activate('m0-0', 'e1')), 'NO_VALID_TARGET');
  });
});

describe('costs of a monster effect', () => {
  it('PayLP: needs MORE Life Points than the cost (INVALID_COST otherwise)', () => {
    const state = on({ myMonsters: [[0, 'IGN_PAY']], myLp: 500 });
    expectEngineError(() => apply(state, activate('m0-0', 'e1')), 'INVALID_COST');
  });

  it('Discard: the chosen hand card is discarded, then the effect resolves', () => {
    const state = on({ hand: ['M1', 'M2'], myMonsters: [[0, 'IGN_DISCARD']] });
    const { state: done, events } = apply(state, activate('m0-0', 'e1', 0, ['h1']));
    expect(types(events)).toEqual([
      'EffectActivated',
      'CardDiscarded',
      'ChainLinkAdded',
      'CardDrawn',
      'CardDrawn',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(done.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h1']);
    expect(done.players[0].hand).toHaveLength(3);
    expect(monsterAt(done)).toMatchObject({ instanceId: 'm0-0' });
  });

  it('Discard: no id / an id that is not in the hand: INVALID_COST', () => {
    const state = on({ hand: ['M1'], myMonsters: [[0, 'IGN_DISCARD']] });
    expectEngineError(() => apply(state, activate('m0-0', 'e1')), 'INVALID_COST');
    expectEngineError(() => apply(state, activate('m0-0', 'e1', 0, ['m0-0'])), 'INVALID_COST');
  });

  it('Tribute ANOTHER monster: it goes to the graveyard, the activating monster stays', () => {
    const state = on({
      myMonsters: [
        [0, 'IGN_TRIBUTE'],
        [1, 'M1'],
      ],
    });
    const { state: done, events } = apply(state, activate('m0-0', 'e1', 0, ['m0-1']));
    expect(types(events)).toContain('MonsterTributed');
    expect(lp(done)).toEqual([8500, 8000]);
    expect(monsterAt(done, 1)).toBeNull();
    expect(monsterAt(done)).toMatchObject({ instanceId: 'm0-0' });
  });

  it('Tribute ITSELF: not supported yet — INVALID_COST, and never listed', () => {
    const state = on({
      myMonsters: [
        [0, 'IGN_TRIBUTE'],
        [1, 'M1'],
      ],
    });
    expectEngineError(() => apply(state, activate('m0-0', 'e1', 0, ['m0-0'])), 'INVALID_COST');
    const listed = getLegalActions(state, 0, sampleCtx).filter((a) => a.type === 'ActivateEffect');
    expect(listed).toEqual([activate('m0-0', 'e1', 0, ['m0-1'])]);
  });
});

describe('oncePerTurn (G28 [DECISION]: counted per copy of the card)', () => {
  it('the second activation in the same turn is refused: ONCE_PER_TURN_USED', () => {
    const used = apply(on({ myMonsters: [[0, 'IGN_ONCE']] }), activate('m0-0', 'e1')).state;
    expect(lp(used)).toEqual([7500, 7500]);
    expectEngineError(() => apply(used, activate('m0-0', 'e1')), 'ONCE_PER_TURN_USED');
    expect(monsterAt(used)?.effectUsedTurns).toEqual({ e1: 3 });
  });

  it('still refused later in the same turn (Main Phase 2)', () => {
    const used = apply(on({ myMonsters: [[0, 'IGN_ONCE']] }), activate('m0-0', 'e1')).state;
    const main2 = apply(apply(used, endPhase()).state, endPhase()).state;
    expect(main2.phase).toBe('Main2');
    expectEngineError(() => apply(main2, activate('m0-0', 'e1')), 'ONCE_PER_TURN_USED');
  });

  it('two copies on the field: each one once', () => {
    const state = on({
      myMonsters: [
        [0, 'IGN_ONCE'],
        [1, 'IGN_ONCE'],
      ],
    });
    const first = apply(state, activate('m0-0', 'e1')).state;
    const second = apply(first, activate('m0-1', 'e1')).state;
    expect(lp(second)).toEqual([7000, 7000]);
    expectEngineError(() => apply(second, activate('m0-0', 'e1')), 'ONCE_PER_TURN_USED');
    expectEngineError(() => apply(second, activate('m0-1', 'e1')), 'ONCE_PER_TURN_USED');
  });

  it('usable again on the controller’s next turn', () => {
    const used = apply(on({ myMonsters: [[0, 'IGN_ONCE']] }), activate('m0-0', 'e1')).state;
    const later = nextOwnMain1(used);
    expect(later.turnCount).toBe(5);
    expect(lp(apply(later, activate('m0-0', 'e1')).state)).toEqual([7000, 7000]);
  });

  it('a copy that left the field and came back is a new copy: usable again the same turn', () => {
    // Used, then Tributed as the cost of a Spell, then Special Summoned back from the graveyard.
    const state = on({ hand: ['TRIBUTE_HEAL', 'SS_GY_DEF'], myMonsters: [[0, 'IGN_ONCE']] });
    const used = apply(state, activate('m0-0', 'e1')).state;
    const gone = apply(used, activate('h0', 'e1', 0, ['m0-0'])).state;
    expect(monsterAt(gone)).toBeNull();
    const back = apply(gone, activate('h1', 'e1')).state;
    expect(monsterAt(back)).toMatchObject({ instanceId: 'm0-0', position: 'DefenseUp' });
    expect(monsterAt(back)?.effectUsedTurns).toBeUndefined();
    expect(lp(apply(back, activate('m0-0', 'e1')).state)).toEqual([7500, 7000]);
  });

  it('refused before anything is paid, and never listed once used', () => {
    const used = apply(on({ myMonsters: [[0, 'IGN_ONCE']] }), activate('m0-0', 'e1')).state;
    expect(getLegalActions(used, 0, sampleCtx).filter((a) => a.type === 'ActivateEffect')).toEqual(
      [],
    );
  });
});

describe('a monster effect answered by the real SMP-212 (NegateActivation of a monster effect)', () => {
  const negated = () => {
    const state = on({ myMonsters: [[0, 'IGN_ONCE']], oppSpellTraps: [[0, 'SMP-212']] });
    const waiting = apply(state, activate('m0-0', 'e1')).state;
    expect(getLegalActions(waiting, 1, sampleCtx)).toContainEqual(activate('os-0', 'hush', 1));
    return apply(waiting, activate('os-0', 'hush', 1));
  };

  it('the activation is negated: no damage, the cost is not refunded (G23), the monster stays face-up on the field', () => {
    const { state, events } = negated();
    expect(types(events)).toContain('ChainLinkNegated');
    expect(types(events)).not.toContain('DamageDealt');
    expect(lp(state)).toEqual([7500, 8000]);
    expect(monsterAt(state)).toMatchObject({ instanceId: 'm0-0', position: 'Attack' });
    expect(state.players[0].graveyard).toEqual([]);
    expect(state.chainStack).toEqual([]);
  });

  it('[RULE] a negated activation still counts as this turn’s use', () => {
    const { state } = negated();
    expect(monsterAt(state)?.effectUsedTurns).toEqual({ e1: 3 });
    expectEngineError(() => apply(state, activate('m0-0', 'e1')), 'ONCE_PER_TURN_USED');
  });
});

describe('legal actions with the flag on', () => {
  it('lists the Ignition effects the engine accepts — and only in a Main Phase of the controller', () => {
    const setup: FixtureSetup = {
      hand: ['M1', 'M2'],
      myMonsters: [
        [0, 'IGN_PAY'],
        [1, 'IGN_DISCARD'],
        [2, 'SUM_HEAL'],
        [3, 'IGN_PAY', 'DefenseDown'],
      ],
      oppMonsters: [[0, 'IGN_PAY']],
    };
    const state = on(setup);
    expect(getLegalActions(state, 0, sampleCtx).filter((a) => a.type === 'ActivateEffect')).toEqual(
      [
        activate('m0-0', 'e1'),
        activate('m0-1', 'e1', 0, ['h0']),
        activate('m0-1', 'e1', 0, ['h1']),
      ],
    );
    expect(getLegalActions(state, 1, sampleCtx).filter((a) => a.type === 'ActivateEffect')).toEqual(
      [],
    );
    const inBattle = withMonsterEffects(battle(setup));
    expect(
      getLegalActions(inBattle, 0, sampleCtx).filter((a) => a.type === 'ActivateEffect'),
    ).toEqual([]);
  });

  it('Spells keep their place: hand and Set cards first, monsters after', () => {
    const state = on({
      hand: ['HEAL'],
      myMonsters: [[0, 'IGN_PAY']],
      mySpellTraps: [[0, 'DRAW']],
    });
    expect(getLegalActions(state, 0, sampleCtx).filter((a) => a.type === 'ActivateEffect')).toEqual(
      [activate('h0', 'e1'), activate('ms-0', 'e1'), activate('m0-0', 'e1')],
    );
  });
});
