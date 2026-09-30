import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import type { ActivateEffectAction, ResolvePendingPromptAction } from '../../actions/types.js';
import { getLegalActions } from '../../legal-actions.js';
import type { GameState } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../../testing/effect-fixtures.js';
import { targetCandidates } from '../targets.js';
import { applySpecialSummon } from './special-summon.js';

/* Task 4.2a — operation SpecialSummon: from your hand / graveyard, no Normal Summon right used. */

const activate = (
  cardInstanceId = 'h0',
  playerIndex: 0 | 1 = 0,
  effectId = 'e1',
): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId },
});

const run = (setup: FixtureSetup, action: ActivateEffectAction = activate()) =>
  applyAction(deepFreeze(fixtureState(setup)), action, fixtureCtx);

const answer = (state: GameState, cardInstanceIds: string[]): ResolvePendingPromptAction => ({
  type: 'ResolvePendingPrompt',
  payload: { playerIndex: 0, promptId: state.pendingPrompt!.promptId, cardInstanceIds },
});

const types = (events: readonly { type: string }[]) => events.map((e) => e.type);

describe('SpecialSummon — from the hand', () => {
  it('summons the only monster in the hand face-up in Attack Position, without using the Normal Summon', () => {
    const before = fixtureState({ hand: ['SS_HAND', 'M1'] });
    const { state, events } = applyAction(deepFreeze(before), activate(), fixtureCtx);
    const me = state.players[0];
    expect(me.hand).toEqual([]);
    expect(me.board.monsterZones[0]).toEqual({
      instanceId: 'h1',
      definitionId: 'M1',
      ownerIndex: 0,
      position: 'Attack',
      summonedTurn: before.turnCount,
    });
    expect(me.hasNormalSummonedThisTurn).toBe(false);
    expect(me.graveyard.map((c) => c.instanceId)).toEqual(['h0']);
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterSpecialSummoned',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events[2]).toEqual({
      type: 'MonsterSpecialSummoned',
      playerIndex: 0,
      instanceId: 'h1',
      definitionId: 'M1',
      zoneIndex: 0,
      from: 'Hand',
      position: 'Attack',
    });
  });

  it('the Normal Summon is still available afterwards', () => {
    const { state } = run({ hand: ['SS_HAND', 'M1', 'M2'] });
    expect(state.pendingPrompt?.kind).toBe('SelectEffectTarget');
    const summoned = applyAction(state, answer(state, ['h2']), fixtureCtx).state;
    const normal = applyAction(
      summoned,
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'h1', zoneIndex: 1 } },
      fixtureCtx,
    ).state;
    expect(normal.players[0].board.monsterZones.map((c) => c?.instanceId ?? null)).toEqual([
      'h2',
      'h1',
      null,
      null,
      null,
    ]);
  });

  it('asks which monster when several qualify (Spell/Trap cards and the activated card are not candidates)', () => {
    const { state, events } = run({ hand: ['SS_HAND', 'M1', 'DRAW', 'M2'] });
    expect(events).toEqual([]);
    expect(state.pendingPrompt).toMatchObject({
      kind: 'SelectEffectTarget',
      playerIndex: 0,
      payload: { candidateInstanceIds: ['h1', 'h3'], count: 1 },
    });
    const done = applyAction(state, answer(state, ['h3']), fixtureCtx).state;
    expect(done.players[0].board.monsterZones[0]?.instanceId).toBe('h3');
    expect(done.players[0].hand.map((c) => c.instanceId)).toEqual(['h1', 'h2']);
  });

  it('no monster in the hand → NO_VALID_TARGET', () => {
    expectEngineError(() => run({ hand: ['SS_HAND', 'DRAW'] }), 'NO_VALID_TARGET');
  });

  it('uses the lowest empty Monster Zone [ASSUMED]', () => {
    const { state } = run({
      hand: ['SS_HAND', 'M1'],
      myMonsters: [
        [0, 'M2'],
        [2, 'M2'],
      ],
    });
    expect(state.players[0].board.monsterZones[1]?.instanceId).toBe('h1');
  });

  it('five monsters on your field → NO_FREE_MONSTER_ZONE [RULE] (5 zones, no Extra Monster Zone)', () => {
    expectEngineError(
      () =>
        run({
          hand: ['SS_HAND', 'M1'],
          myMonsters: [
            [0, 'M2'],
            [1, 'M2'],
            [2, 'M2'],
            [3, 'M2'],
            [4, 'M2'],
          ],
        }),
      'NO_FREE_MONSTER_ZONE',
    );
  });

  it('a Special Summoned monster cannot change position the turn it was Summoned (summonedTurn)', () => {
    const { state } = run({ hand: ['SS_HAND', 'M1'] });
    expect(state.players[0].board.monsterZones[0]?.summonedTurn).toBe(state.turnCount);
    expectEngineError(
      () =>
        applyAction(
          state,
          {
            type: 'ChangePosition',
            payload: { playerIndex: 0, cardInstanceId: 'h1', toPosition: 'DefenseUp' },
          },
          fixtureCtx,
        ),
      'SUMMONED_THIS_TURN',
    );
  });
});

describe('SpecialSummon — from the graveyard', () => {
  it('summons in face-up Defense Position when the operation says so, out of the graveyard', () => {
    const { state, events } = run({ hand: ['SS_GY_DEF'], myGraveyard: ['M1'] });
    const me = state.players[0];
    expect(me.board.monsterZones[0]).toMatchObject({
      instanceId: 'g0',
      definitionId: 'M1',
      position: 'DefenseUp',
    });
    expect(me.graveyard.map((c) => c.instanceId)).toEqual(['h0']);
    expect(events.find((e) => e.type === 'MonsterSpecialSummoned')).toMatchObject({
      instanceId: 'g0',
      from: 'Graveyard',
      position: 'DefenseUp',
    });
  });

  it('two targets go to the two lowest empty zones, in target order', () => {
    const { state, events } = run({
      hand: ['SS_GY2'],
      myGraveyard: ['M1', 'DRAW', 'M2'],
      myMonsters: [[0, 'M1']],
    });
    const zones = state.players[0].board.monsterZones.map((c) => c?.instanceId ?? null);
    expect(zones).toEqual(['m0-0', 'g0', 'g2', null, null]);
    expect(events.filter((e) => e.type === 'MonsterSpecialSummoned')).toHaveLength(2);
  });

  it('needs as many empty zones as targets at activation → NO_FREE_MONSTER_ZONE', () => {
    expectEngineError(
      () =>
        run({
          hand: ['SS_GY2'],
          myGraveyard: ['M1', 'M2'],
          myMonsters: [
            [0, 'M2'],
            [1, 'M2'],
            [2, 'M2'],
            [3, 'M2'],
          ],
        }),
      'NO_FREE_MONSTER_ZONE',
    );
  });

  it('a target that left the graveyard before its link resolves → the link fizzles', () => {
    // I Special Summon g0 (link 1); the opponent answers with a Trap; I chain a Quick-Play that Summons g0 first.
    const setup: FixtureSetup = {
      hand: ['SS_GY_DEF', 'QP_SS_GY'],
      myGraveyard: ['M1'],
      oppSpellTraps: [[0, 'TRAP_BURN']],
    };
    const first = run(setup).state;
    expect(first.chainWindow?.priorityPlayer).toBe(1);
    const trap = applyAction(first, activate('os-0', 1), fixtureCtx).state;
    expect(trap.chainWindow?.priorityPlayer).toBe(0);
    const { state, events } = applyAction(trap, activate('h1'), fixtureCtx);
    expect(state.players[0].board.monsterZones[0]).toMatchObject({
      instanceId: 'g0',
      position: 'Attack',
    });
    expect(events.filter((e) => e.type === 'MonsterSpecialSummoned')).toHaveLength(1);
    expect(events.find((e) => e.type === 'ChainLinkFizzled')).toMatchObject({
      instanceId: 'h0',
      reason: 'TARGET_GONE',
    });
  });
});

describe('SpecialSummon — triggers and legal actions', () => {
  it('fires the Summoned monster’s OnSummon [RULE]: a new chain after the first one', () => {
    const before = fixtureState({ hand: ['SS_HAND', 'SUM_BURN'] });
    const { state, events } = applyAction(deepFreeze(before), activate(), fixtureCtx);
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterSpecialSummoned',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 300);
    expect(state.chainWindow).toBeNull();
  });

  it('a trigger that Special Summons needs a free zone too: none → it does not activate; one → it does', () => {
    const tributeSummon = {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 0, tributeInstanceIds: ['m0-0'] },
    } as const;
    const others: FixtureSetup['myMonsters'] = [
      [1, 'M2'],
      [2, 'M2'],
      [3, 'M2'],
    ];
    const full = applyAction(
      fixtureState({
        hand: ['SUM_REVIVE_L5'],
        myMonsters: [[0, 'M1'], ...others!, [4, 'M2']],
      }),
      tributeSummon,
      fixtureCtx,
    );
    expect(types(full.events)).toEqual(['MonsterTributed', 'NormalSummoned']);
    const room = applyAction(
      fixtureState({ hand: ['SUM_REVIVE_L5'], myMonsters: [[0, 'M1'], ...others!] }),
      tributeSummon,
      fixtureCtx,
    );
    // The Tributed M1 comes back into the lowest empty zone (4).
    expect(room.state.players[0].board.monsterZones[4]?.instanceId).toBe('m0-0');
    expect(types(room.events)).toContain('MonsterSpecialSummoned');
  });

  it('the opponent’s hand and any deck are never target zones (hidden information)', () => {
    const state = fixtureState({ hand: ['M1'] });
    const card = { kind: 'Card', count: 1, filter: { kind: 'Monster' } } as const;
    expectEngineError(
      () => targetCandidates(state, 0, { ...card, zone: 'Hand', side: 'opponent' }, fixtureCtx),
      'NOT_ACTIVATABLE',
    );
    expectEngineError(
      () => targetCandidates(state, 0, { ...card, zone: 'Deck', side: 'self' }, fixtureCtx),
      'NOT_ACTIVATABLE',
    );
    expect(targetCandidates(state, 0, { ...card, zone: 'Hand', side: 'self' }, fixtureCtx)).toEqual(
      ['h0'],
    );
    expect(
      targetCandidates(state, 1, { ...card, zone: 'Graveyard', side: 'opponent' }, fixtureCtx),
    ).toEqual([]);
  });

  it('legalActions list the activation only while a zone is free', () => {
    const free = fixtureState({ hand: ['SS_HAND', 'M1'] });
    const isSs = (a: { type: string; payload: unknown }) =>
      a.type === 'ActivateEffect' &&
      (a.payload as { cardInstanceId: string }).cardInstanceId === 'h0';
    expect(getLegalActions(free, 0, fixtureCtx).some(isSs)).toBe(true);
    const full = fixtureState({
      hand: ['SS_HAND', 'M1'],
      myMonsters: [
        [0, 'M2'],
        [1, 'M2'],
        [2, 'M2'],
        [3, 'M2'],
        [4, 'M2'],
      ],
    });
    expect(getLegalActions(full, 0, fixtureCtx).some(isSs)).toBe(false);
  });
});

describe('applySpecialSummon (handler)', () => {
  it('summons only as many targets as there are empty zones at resolution [ASSUMED], skips cards that moved', () => {
    const state = fixtureState({
      myGraveyard: ['M1', 'M2'],
      myMonsters: [
        [0, 'M1'],
        [1, 'M1'],
        [2, 'M1'],
        [3, 'M1'],
      ],
    });
    const out = applySpecialSummon(
      state,
      { kind: 'SpecialSummon' },
      { controller: 0, targetInstanceIds: ['nowhere', 'g1', 'g0'] },
    );
    expect(out.state.players[0].board.monsterZones[4]?.instanceId).toBe('g1');
    expect(out.state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['g0']);
    expect(types(out.events)).toEqual(['MonsterSpecialSummoned']);
    expect(out.state.version).toBe(state.version);
  });
});
