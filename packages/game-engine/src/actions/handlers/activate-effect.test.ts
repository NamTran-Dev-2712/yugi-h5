import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import type { ActivateEffectAction, ResolvePendingPromptAction } from '../types.js';
import type { GameState } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../../testing/effect-fixtures.js';

const activate = (
  cardInstanceId = 'h0',
  extra: Partial<ActivateEffectAction['payload']> = {},
): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex: 0, cardInstanceId, effectId: 'e1', ...extra },
});

const run = (setup: FixtureSetup, action: ActivateEffectAction = activate()) =>
  applyAction(deepFreeze(fixtureState(setup)), action, fixtureCtx);

const answer = (state: GameState, cardInstanceIds: string[]): ResolvePendingPromptAction => ({
  type: 'ResolvePendingPrompt',
  payload: { playerIndex: 0, promptId: state.pendingPrompt!.promptId, cardInstanceIds },
});

const types = (events: readonly { type: string }[]) => events.map((e) => e.type);

describe('ActivateEffect — Draw (Normal Spell from hand)', () => {
  it('draws, sends the spell to the graveyard and emits Activated → CardDrawn → Resolved → SentToGY', () => {
    const before = fixtureState({ hand: ['DRAW', 'M1'] });
    const { state, events } = applyAction(deepFreeze(before), activate(), fixtureCtx);
    const me = state.players[0];
    expect(me.hand.map((c) => c.instanceId)).toEqual(['h1', before.players[0].deck[0]!.instanceId]);
    expect(me.deck).toHaveLength(before.players[0].deck.length - 1);
    expect(me.graveyard).toEqual([
      { instanceId: 'h0', definitionId: 'DRAW', ownerIndex: 0, position: null },
    ]);
    expect(state.version).toBe(before.version + 1);
    expect(state.chainStack).toEqual(before.chainStack);
    expect(state.pendingPrompt).toBeNull();
    expect(types(events)).toEqual([
      'EffectActivated',
      'CardDrawn',
      'EffectResolved',
      'CardSentToGraveyard',
    ]);
    expect(events[0]).toEqual({
      type: 'EffectActivated',
      playerIndex: 0,
      instanceId: 'h0',
      definitionId: 'DRAW',
      effectId: 'e1',
    });
    expect(events[3]).toEqual({
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'h0',
      definitionId: 'DRAW',
      from: 'Hand',
    });
  });

  it('works in Main2 and does not use the Normal Summon', () => {
    const { state } = run({ hand: ['DRAW'], phase: 'Main2' });
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(false);
  });

  it('deck-out during Draw ends the duel; DuelEnded is the last event and the spell still goes to the graveyard', () => {
    const base = fixtureState({ hand: ['DRAW3'] });
    const thin = {
      ...base,
      players: [{ ...base.players[0], deck: base.players[0].deck.slice(0, 2) }, base.players[1]],
    } as GameState;
    const { state, events } = applyAction(deepFreeze(thin), activate(), fixtureCtx);
    expect(state.winnerIndex).toBe(1);
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h0']);
    expect(types(events).at(-1)).toBe('DuelEnded');
    expect(types(events)).toContain('DeckOut');
    expect(types(events)).toContain('EffectResolved');
  });
});

describe('ActivateEffect — Damage / Heal', () => {
  it('Damage hits the opponent and emits DamageDealt', () => {
    const { state, events } = run({ hand: ['BURN'] });
    expect(state.players[1].lifePoints).toBe(8000 - 500);
    expect(events).toContainEqual({ type: 'DamageDealt', playerIndex: 1, amount: 500 });
  });

  it('Heal raises own LP and emits LifePointsRecovered', () => {
    const { state, events } = run({ hand: ['HEAL'], myLp: 3000 });
    expect(state.players[0].lifePoints).toBe(3700);
    expect(events).toContainEqual({ type: 'LifePointsRecovered', playerIndex: 0, amount: 700 });
  });

  it('lethal Damage ends the duel, skips later operations, and puts DuelEnded last', () => {
    const { state, events } = run({ hand: ['BURN_ALL'], oppLp: 8000 });
    expect(state.players[1].lifePoints).toBe(0);
    expect(state.winnerIndex).toBe(0);
    expect(state.players[0].lifePoints).toBe(8000); // the Heal after the lethal Damage never ran
    expect(types(events)).not.toContain('LifePointsRecovered');
    expect(events.at(-1)).toEqual({ type: 'DuelEnded', winnerIndex: 0, reason: 'LP_ZERO' });
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h0']);
  });
});

describe('ActivateEffect — Destroy and targets', () => {
  it('a single legal target is chosen automatically (no prompt)', () => {
    const { state, events } = run({ hand: ['KILL'], oppMonsters: [[1, 'M1']] });
    expect(state.pendingPrompt).toBeNull();
    expect(state.players[1].board.monsterZones[1]).toBeNull();
    expect(state.players[1].graveyard).toEqual([
      { instanceId: 'o0-1', definitionId: 'M1', ownerIndex: 1, position: null },
    ]);
    expect(events).toContainEqual({
      type: 'MonsterDestroyed',
      ownerIndex: 1,
      instanceId: 'o0-1',
      definitionId: 'M1',
      zoneIndex: 1,
    });
  });

  it('several candidates open a SelectEffectTarget prompt without changing anything else', () => {
    const before = fixtureState({
      hand: ['KILL'],
      oppMonsters: [
        [0, 'M1'],
        [3, 'M2'],
      ],
    });
    const { state, events } = applyAction(deepFreeze(before), activate(), fixtureCtx);
    expect(events).toEqual([]);
    expect(state.version).toBe(before.version + 1);
    expect(state.pendingPrompt).toEqual({
      promptId: `effect-${before.turnCount}-${before.version}`,
      playerIndex: 0,
      kind: 'SelectEffectTarget',
      payload: {
        cardInstanceId: 'h0',
        effectId: 'e1',
        costInstanceIds: [],
        candidateInstanceIds: ['o0-0', 'o0-3'],
        count: 1,
      },
    });
    expect({ ...state, pendingPrompt: null, version: before.version }).toEqual(before);
  });

  it('answering the prompt destroys the chosen card and finishes the activation', () => {
    const opened = run({
      hand: ['KILL'],
      oppMonsters: [
        [0, 'M1'],
        [3, 'M2'],
      ],
    }).state;
    const { state, events } = applyAction(deepFreeze(opened), answer(opened, ['o0-3']), fixtureCtx);
    expect(state.pendingPrompt).toBeNull();
    expect(state.players[1].board.monsterZones[3]).toBeNull();
    expect(state.players[1].board.monsterZones[0]).not.toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h0']);
    expect(state.players[0].hand).toEqual([]);
    expect(state.version).toBe(opened.version + 1);
    expect(types(events)).toEqual([
      'EffectActivated',
      'MonsterDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
    ]);
  });

  it('rejects a bad prompt answer without changing the prompt', () => {
    const opened = run({
      hand: ['KILL'],
      oppMonsters: [
        [0, 'M1'],
        [3, 'M2'],
      ],
    }).state;
    for (const ids of [[], ['o0-0', 'o0-3'], ['nope'], ['h0'], ['o0-0', 'o0-0']]) {
      expectEngineError(
        () => applyAction(deepFreeze(opened), answer(opened, ids), fixtureCtx),
        'INVALID_EFFECT_TARGET',
      );
    }
  });

  it('while the prompt is open everything except the answer (and Surrender) is rejected', () => {
    const opened = run({
      hand: ['KILL', 'DRAW'],
      oppMonsters: [
        [0, 'M1'],
        [3, 'M2'],
      ],
    }).state;
    expectEngineError(() => applyAction(opened, activate('h1'), fixtureCtx), 'PENDING_PROMPT');
    expectEngineError(
      () => applyAction(opened, { type: 'EndPhase', payload: { playerIndex: 0 } }, fixtureCtx),
      'PENDING_PROMPT',
    );
    expectEngineError(
      () =>
        applyAction(
          opened,
          {
            type: 'ResolvePendingPrompt',
            payload: { playerIndex: 0, promptId: 'other', cardInstanceIds: ['o0-0'] },
          },
          fixtureCtx,
        ),
      'PROMPT_MISMATCH',
    );
    const surrendered = applyAction(
      opened,
      { type: 'Surrender', payload: { playerIndex: 0 } },
      fixtureCtx,
    );
    expect(surrendered.state.winnerIndex).toBe(1);
  });

  it('a filter narrows candidates; face-down cards are never matched by a filter', () => {
    const one = run({
      hand: ['KILL_DRAGON'],
      oppMonsters: [
        [0, 'M1'],
        [1, 'M2'],
        [2, 'M2', 'DefenseDown'],
      ],
    });
    expect(one.state.pendingPrompt).toBeNull(); // only the face-up Dragon matches
    expect(one.state.players[1].board.monsterZones[1]).toBeNull();
    expect(one.state.players[1].board.monsterZones[2]).not.toBeNull();
  });

  it('without a filter a face-down monster is a legal target', () => {
    const { state } = run({ hand: ['KILL'], oppMonsters: [[2, 'M1', 'DefenseDown']] });
    expect(state.players[1].board.monsterZones[2]).toBeNull();
  });

  it('no candidate → NO_VALID_TARGET', () => {
    expectEngineError(() => run({ hand: ['KILL'] }), 'NO_VALID_TARGET');
    expectEngineError(
      () => run({ hand: ['KILL_DRAGON'], oppMonsters: [[0, 'M1']] }),
      'NO_VALID_TARGET',
    );
  });

  it('destroys a Spell/Trap on the field with SpellTrapDestroyed', () => {
    const { state, events } = run({ hand: ['KILL_ST'], oppSpellTraps: [[4, 'TRAP']] });
    expect(state.players[1].board.spellTrapZones[4]).toBeNull();
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toEqual(['TRAP']);
    expect(events).toContainEqual({
      type: 'SpellTrapDestroyed',
      ownerIndex: 1,
      instanceId: 'os-4',
      definitionId: 'TRAP',
      zoneIndex: 4,
    });
  });

  it('a Destroy effect with no Card target is malformed → NOT_ACTIVATABLE', () => {
    expectEngineError(() => run({ hand: ['KILL_DEADLY'] }), 'NOT_ACTIVATABLE');
  });
});

describe('ActivateEffect — costs', () => {
  it('PayLP pays first, then resolves', () => {
    const { state, events } = run({ hand: ['PAY_BURN'], myLp: 2000 });
    expect(state.players[0].lifePoints).toBe(1500);
    expect(state.players[1].lifePoints).toBe(7000);
    expect(types(events)).toEqual([
      'EffectActivated',
      'LifePointsPaid',
      'DamageDealt',
      'EffectResolved',
      'CardSentToGraveyard',
    ]);
    expect(events[1]).toEqual({ type: 'LifePointsPaid', playerIndex: 0, amount: 500 });
  });

  it('PayLP needs strictly more LP than the cost', () => {
    expectEngineError(() => run({ hand: ['PAY_BURN'], myLp: 500 }), 'INVALID_COST');
    expectEngineError(() => run({ hand: ['PAY_BURN'], myLp: 100 }), 'INVALID_COST');
  });

  it('Discard cost sends the chosen hand card to the graveyard (CardDiscarded) before the effect', () => {
    const { state, events } = run(
      { hand: ['DISCARD_DRAW', 'M1'] },
      activate('h0', { costInstanceIds: ['h1'] }),
    );
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h1', 'h0']);
    expect(state.players[0].hand).toHaveLength(2); // drew 2
    expect(types(events)).toEqual([
      'EffectActivated',
      'CardDiscarded',
      'CardDrawn',
      'CardDrawn',
      'EffectResolved',
      'CardSentToGraveyard',
    ]);
  });

  it('Discard cost validation: count, the spell itself, not in hand, duplicates, filter, extras', () => {
    const setup = { hand: ['DISCARD_DRAW', 'M1', 'DRAW'] };
    const bad = (ids: string[]) =>
      expectEngineError(() => run(setup, activate('h0', { costInstanceIds: ids })), 'INVALID_COST');
    bad([]);
    bad(['h0']);
    bad(['nope']);
    bad(['h1', 'h2']);
    bad(['m0-0']);
    // Filtered cost: a Spell cannot pay a "Monster" discard.
    expectEngineError(
      () => run({ hand: ['DISCARD_MONSTER', 'DRAW'] }, activate('h0', { costInstanceIds: ['h1'] })),
      'INVALID_COST',
    );
    run({ hand: ['DISCARD_MONSTER', 'M1'] }, activate('h0', { costInstanceIds: ['h1'] }));
  });

  it('Tribute cost sends an own monster to the graveyard (MonsterTributed) and frees its zone', () => {
    const { state, events } = run(
      { hand: ['TRIBUTE_HEAL'], myMonsters: [[2, 'M1']], myLp: 1000 },
      activate('h0', { costInstanceIds: ['m0-2'] }),
    );
    expect(state.players[0].board.monsterZones[2]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['m0-2', 'h0']);
    expect(state.players[0].lifePoints).toBe(1500);
    expect(events[1]).toEqual({
      type: 'MonsterTributed',
      ownerIndex: 0,
      instanceId: 'm0-2',
      definitionId: 'M1',
      zoneIndex: 2,
    });
  });

  it('Tribute cost rejects a missing, opposing or wrong-count monster', () => {
    const setup = {
      hand: ['TRIBUTE_HEAL'],
      myMonsters: [[2, 'M1'] as [number, string]],
      oppMonsters: [[0, 'M1'] as [number, string]],
    };
    const bad = (ids: string[] | undefined) =>
      expectEngineError(
        () => run(setup, activate('h0', ids ? { costInstanceIds: ids } : {})),
        'INVALID_COST',
      );
    bad(undefined);
    bad([]);
    bad(['o0-0']);
    bad(['nope']);
    bad(['m0-2', 'm0-2']);
  });
});

describe('ActivateEffect — conditions', () => {
  it('ZoneCount', () => {
    expectEngineError(() => run({ hand: ['NEEDS_MONSTER'] }), 'CONDITION_NOT_MET');
    run({ hand: ['NEEDS_MONSTER'], myMonsters: [[0, 'M1']] });
  });
  it('PhaseIs', () => {
    expectEngineError(() => run({ hand: ['MAIN2_ONLY'], phase: 'Main1' }), 'CONDITION_NOT_MET');
    run({ hand: ['MAIN2_ONLY'], phase: 'Main2' });
  });
});

describe('ActivateEffect — multi-card costs, targets and sides', () => {
  it('a count-2 target opens a prompt when 3 are available and rejects duplicates / wrong sizes', () => {
    const opened = run({
      hand: ['KILL2'],
      oppMonsters: [
        [0, 'M1'],
        [1, 'M1'],
        [2, 'M1'],
      ],
    }).state;
    expect((opened.pendingPrompt!.payload as { count: number }).count).toBe(2);
    for (const ids of [['o0-0', 'o0-0'], ['o0-0'], ['o0-0', 'o0-1', 'o0-2']]) {
      expectEngineError(
        () => applyAction(deepFreeze(opened), answer(opened, ids), fixtureCtx),
        'INVALID_EFFECT_TARGET',
      );
    }
    const { state } = applyAction(opened, answer(opened, ['o0-2', 'o0-0']), fixtureCtx);
    expect(state.players[1].board.monsterZones.map((c) => c?.instanceId ?? null)).toEqual([
      null,
      'o0-1',
      null,
      null,
      null,
    ]);
  });

  it('a count-2 target with exactly 2 candidates is chosen automatically', () => {
    const { state } = run({
      hand: ['KILL2'],
      oppMonsters: [
        [0, 'M1'],
        [4, 'M1'],
      ],
    });
    expect(state.pendingPrompt).toBeNull();
    expect(state.players[1].board.monsterZones.every((c) => c === null)).toBe(true);
  });

  it('a Discard cost of 2 needs 2 distinct ids', () => {
    const setup = { hand: ['DISCARD2', 'M1', 'DRAW'] };
    const bad = (ids: string[]) =>
      expectEngineError(() => run(setup, activate('h0', { costInstanceIds: ids })), 'INVALID_COST');
    bad(['h1', 'h1']);
    bad(['h1']);
    const { state } = run(setup, activate('h0', { costInstanceIds: ['h1', 'h2'] }));
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h1', 'h2', 'h0']);
  });

  it('a level filter on a cost only accepts monsters', () => {
    expectEngineError(
      () => run({ hand: ['DISCARD_LV', 'DRAW'] }, activate('h0', { costInstanceIds: ['h1'] })),
      'INVALID_COST',
    );
    run({ hand: ['DISCARD_LV', 'M1'] }, activate('h0', { costInstanceIds: ['h1'] }));
  });

  it('Draw with target "opponent" makes the opponent draw', () => {
    const before = fixtureState({ hand: ['DRAW_OPP'] });
    const { state, events } = applyAction(deepFreeze(before), activate(), fixtureCtx);
    expect(state.players[1].hand).toHaveLength(before.players[1].hand.length + 2);
    expect(state.players[0].hand).toHaveLength(0);
    expect(events.filter((e) => e.type === 'CardDrawn' && e.playerIndex === 1)).toHaveLength(2);
  });
});

describe('ActivateEffect — validation', () => {
  it('turn / phase / duel state / prompt / location', () => {
    const base = { hand: ['DRAW'] };
    expectEngineError(
      () => run(base, { ...activate(), payload: { ...activate().payload, playerIndex: 1 } }),
      'NOT_TURN_PLAYER',
    );
    for (const phase of ['Draw', 'Standby', 'Battle', 'End'] as const) {
      expectEngineError(() => run({ ...base, phase }), 'WRONG_PHASE');
    }
    expectEngineError(() => run(base, activate('nope')), 'CARD_NOT_IN_HAND');
    const s = fixtureState(base);
    expectEngineError(
      () => applyAction({ ...s, winnerIndex: 0 }, activate(), fixtureCtx),
      'DUEL_ENDED',
    );
    expectEngineError(
      () =>
        applyAction(
          {
            ...s,
            pendingPrompt: {
              promptId: 'p',
              playerIndex: 0,
              kind: 'DiscardToHandLimit',
              payload: { count: 1 },
            },
          },
          activate(),
          fixtureCtx,
        ),
      'PENDING_PROMPT',
    );
    expectEngineError(() => applyAction(s, activate(), undefined as never), 'NO_CARD_RESOLVER');
  });

  it('card kind / subtype / effect / trigger', () => {
    expectEngineError(() => run({ hand: ['M1'] }), 'NOT_A_SPELL_TRAP');
    expectEngineError(() => run({ hand: ['TRAP'] }), 'TRAP_NOT_SET');
    expectEngineError(() => run({ hand: ['CONT'] }), 'NOT_ACTIVATABLE');
    expectEngineError(() => run({ hand: ['ODD_TRIGGER'] }), 'NOT_ACTIVATABLE');
    expectEngineError(() => run({ hand: ['NO_EFFECT'] }), 'EFFECT_NOT_FOUND');
    expectEngineError(
      () => run({ hand: ['DRAW'] }, activate('h0', { effectId: 'nope' })),
      'EFFECT_NOT_FOUND',
    );
  });

  it('a Spell already Set on the field cannot be activated yet (3.4): it is not in the hand', () => {
    const s = fixtureState({ hand: ['DRAW'] });
    const set = applyAction(
      s,
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 0 } },
      fixtureCtx,
    ).state;
    expectEngineError(() => applyAction(set, activate('h0'), fixtureCtx), 'CARD_NOT_IN_HAND');
  });

  it('is deterministic and never mutates its input', () => {
    const state = deepFreeze(fixtureState({ hand: ['DRAW'] }));
    const a = applyAction(state, activate(), fixtureCtx);
    const b = applyAction(state, activate(), fixtureCtx);
    expect(a).toEqual(b);
  });
});
