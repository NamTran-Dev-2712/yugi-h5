import { describe, expect, it } from 'vitest';
import { applyAction } from '../apply-action.js';
import type { Action, ActivateEffectAction } from '../actions/types.js';
import type { GameState } from '../state/types.js';
import { deepFreeze } from '../testing/deep-freeze.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../testing/effect-fixtures.js';

/*
 * Task 4.4c (ADR 067) — the Summon reaction window comes BEFORE the "when Summoned / flipped" triggers [RULE]: after a
 * Normal / Tribute / Flip Summon the opponent first gets the Summon window (only if they can activate something
 * [ASSUMED]); the monster's OnSummon / OnFlip triggers are only collected once that window closed without the Summon
 * being negated. The Summon event still owed its triggers rides on the window (`chainWindow.summonEvent`).
 * Fixture: player 0 Summons `h0` into zone 3 on turn 3; player 1 holds the Set cards `os-<zone>`.
 */

const act = (cardInstanceId: string, playerIndex: 0 | 1 = 1): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId: 'e1' },
});
const pass = (playerIndex: 0 | 1): Action => ({ type: 'PassPriority', payload: { playerIndex } });
const summon = (extra: object = {}, type: 'NormalSummon' | 'SetMonster' = 'NormalSummon'): Action =>
  ({ type, payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 3, ...extra } }) as Action;
const flip = (cardInstanceId: string): Action => ({
  type: 'FlipSummon',
  payload: { playerIndex: 0, cardInstanceId },
});
const answer = (state: GameState, cardInstanceIds: string[] = [], decline?: boolean): Action => ({
  type: 'ResolvePendingPrompt',
  payload: {
    playerIndex: state.pendingPrompt!.playerIndex,
    promptId: state.pendingPrompt!.promptId,
    cardInstanceIds,
    ...(decline ? { decline } : {}),
  },
});
const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const types = (events: readonly { type: string }[]) => events.map((e) => e.type);
const main = (setup: FixtureSetup): GameState => ({ ...fixtureState(setup), turnCount: 3 });
const graveIds = (state: GameState, player: 0 | 1 = 0) =>
  state.players[player].graveyard.map((c) => c.instanceId);
const activatedBy = (events: readonly { type: string }[], instanceId: string) =>
  events.filter(
    (e) => e.type === 'EffectActivated' && (e as { instanceId?: string }).instanceId === instanceId,
  ).length;

describe('Summon window before the OnSummon trigger — Normal Summon', () => {
  it('the window opens first: no trigger on the chain, the window carries the Summon event', () => {
    const before = main({ hand: ['SUM_BURN'], oppSpellTraps: [[0, 'NEG_SUM']] });
    const { state, events } = apply(before, summon());
    expect(types(events)).toEqual(['NormalSummoned']);
    expect(state.chainStack).toEqual([]);
    expect(state.pendingPrompt).toBeNull();
    expect(state.chainWindow).toEqual({
      priorityPlayer: 1,
      passCount: 0,
      reactionTo: { kind: 'Summon' },
      summoned: { playerIndex: 0, instanceId: 'h0' },
      summonEvent: {
        type: 'NormalSummoned',
        playerIndex: 0,
        instanceId: 'h0',
        definitionId: 'SUM_BURN',
        zoneIndex: 3,
      },
    });
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
    expect(state.version).toBe(before.version + 1);
  });

  it('negated: the monster goes to the graveyard, its trigger never happens, the Normal Summon stays used', () => {
    const before = main({ hand: ['SUM_BURN', 'M1'], oppSpellTraps: [[0, 'NEG_SUM']] });
    const opened = apply(before, summon()).state;
    const { state, events } = apply(opened, act('os-0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'SummonNegated',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(activatedBy(events, 'h0')).toBe(0);
    expect(graveIds(state)).toEqual(['h0']);
    expect(state.players[0].board.monsterZones[3]).toBeNull();
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
    expect(state.chainWindow).toBeNull();
    expect(state.chainStack).toEqual([]);
    expect(state.pendingPrompt).toBeNull();
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(true);
    expectEngineError(
      () =>
        apply(state, {
          type: 'NormalSummon',
          payload: { playerIndex: 0, cardInstanceId: 'h1', zoneIndex: 0 },
        }),
      'NORMAL_SUMMON_USED',
    );
  });

  it('the opponent passes: the trigger goes on the chain and resolves, same outcome as with no card to respond', () => {
    const direct = apply(main({ hand: ['SUM_BURN'] }), summon());
    expect(types(direct.events)).toEqual([
      'NormalSummoned',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);

    const before = main({ hand: ['SUM_BURN'], oppSpellTraps: [[0, 'NEG_SUM']] });
    const opened = apply(before, summon()).state;
    const { state, events } = apply(opened, pass(1));
    // NEG_SUM cannot answer the trigger link (it only answers the Summon itself): the chain resolves at once.
    expect(types(events)).toEqual(types(direct.events).slice(1));
    expect(state.players[1].lifePoints).toBe(direct.state.players[1].lifePoints);
    expect(state.players[0].board.monsterZones[3]?.instanceId).toBe('h0');
    expect(state.chainWindow).toBeNull();
    expect(state.version).toBe(opened.version + 1);
  });

  it('two windows in a row for the same opponent: pass the Summon, then answer the trigger link', () => {
    const before = main({ hand: ['SUM_BURN'], oppSpellTraps: [[0, 'TRAP_BURN']] });
    const opened = apply(before, summon()).state;
    expect(opened.chainWindow).toMatchObject({ reactionTo: { kind: 'Summon' } });

    const second = apply(opened, pass(1));
    expect(types(second.events)).toEqual(['EffectActivated', 'ChainLinkAdded']);
    expect(second.state.chainStack).toHaveLength(1);
    // A plain chain window: the trigger link is what they respond to now (nothing left of the Summon window).
    expect(second.state.chainWindow).toEqual({ priorityPlayer: 1, passCount: 0 });

    const answered = apply(second.state, act('os-0'));
    expect(types(answered.events).filter((t) => t === 'DamageDealt')).toHaveLength(2);
    expect(answered.state.players[0].lifePoints).toBe(before.players[0].lifePoints - 300);
    expect(answered.state.players[1].lifePoints).toBe(before.players[1].lifePoints - 300);
    expect(answered.state.chainWindow).toBeNull();

    const passedTwice = apply(second.state, pass(1));
    expect(types(passedTwice.events)).toEqual(['DamageDealt', 'EffectResolved', 'ChainResolved']);
    expect(passedTwice.state.players[0].lifePoints).toBe(before.players[0].lifePoints);
    expect(passedTwice.state.players[1].lifePoints).toBe(before.players[1].lifePoints - 300);
  });

  it('a card that does not negate, activated in the Summon window: the trigger follows once that chain resolved', () => {
    const before = main({ hand: ['SUM_BURN'], oppSpellTraps: [[0, 'TRAP_BURN']] });
    const opened = apply(before, summon()).state;
    const { state, events } = apply(opened, act('os-0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(events[6]).toMatchObject({ instanceId: 'h0' });
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 300);
    expect(state.chainWindow).toBeNull();
  });

  it('[ASSUMED] G25: the monster destroyed inside the Summon window never gets its trigger', () => {
    const before = main({ hand: ['SUM_BURN'], oppSpellTraps: [[0, 'TRAP_KILL_MON']] });
    const opened = apply(before, summon()).state;
    const { state, events } = apply(opened, act('os-0'));
    expect(types(events)).toContain('MonsterDestroyed');
    expect(activatedBy(events, 'h0')).toBe(0);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
    expect(state.chainWindow).toBeNull();
    expect(state.pendingPrompt).toBeNull();
  });

  it('the Summon comes first in trigger order: its link is added before a trigger fired by the window’s own chain', () => {
    // P1 destroys P0's DES_BURN (OnDestroyed, mandatory) inside the Summon window. Both triggers are P0's: the Summon
    // happened first, so SUM_BURN is link 1 and DES_BURN link 2 (G15: the order of the events).
    const before = main({
      hand: ['SUM_BURN'],
      myMonsters: [[0, 'DES_BURN']],
      oppSpellTraps: [[0, 'TRAP_KILL_MON']],
    });
    const opened = apply(before, summon()).state;
    const asked = apply(opened, act('os-0')).state;
    expect(asked.pendingPrompt?.kind).toBe('SelectEffectTarget');
    const { state, events } = apply(asked, answer(asked, ['m0-0']));
    const links = events.flatMap((e) =>
      e.type === 'ChainLinkAdded' ? [(e as { instanceId: string }).instanceId] : [],
    );
    expect(links).toEqual(['os-0', 'h0', 'm0-0']);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 700);
    expect(state.chainWindow).toBeNull();
  });

  it('the negation is itself negated: the monster stays and its trigger then happens', () => {
    const before = main({
      hand: ['SUM_BURN'],
      mySpellTraps: [[0, 'NEG_ANY']],
      oppSpellTraps: [[0, 'NEG_SUM']],
    });
    const link1 = apply(apply(before, summon()).state, act('os-0')).state;
    expect(link1.chainWindow?.summonEvent).toMatchObject({ instanceId: 'h0' });
    const { state, events } = apply(link1, act('ms-0', 0));
    expect(types(events)).not.toContain('SummonNegated');
    expect(activatedBy(events, 'h0')).toBe(1);
    expect(types(events).indexOf('ChainResolved')).toBeLessThan(
      events.findIndex(
        (e) => e.type === 'EffectActivated' && (e as { instanceId: string }).instanceId === 'h0',
      ),
    );
    expect(state.players[0].board.monsterZones[3]?.instanceId).toBe('h0');
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 300);
  });

  it('nobody to respond: no window, no extra prompt — the trigger resolves in the Summon step as before', () => {
    const before = main({ hand: ['SUM_BURN'], oppSpellTraps: [[0, 'TRAP_PLAIN']] });
    const { state, events } = apply(before, summon());
    expect(types(events)).toEqual([
      'NormalSummoned',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.chainWindow).toBeNull();
    expect(state.pendingPrompt).toBeNull();
  });

  it('a Set is not a Summon: its window carries no Summon event', () => {
    const before = main({ hand: ['SUM_BURN'], oppSpellTraps: [[0, 'TRAP_BURN']] });
    const { state } = apply(before, summon({}, 'SetMonster'));
    expect(state.chainWindow).toEqual({
      priorityPlayer: 1,
      passCount: 0,
      reactionTo: { kind: 'Summon' },
    });
    const closed = apply(state, pass(1));
    expect(closed.events).toEqual([]);
  });

  it('the waiting state is plain JSON: a round trip through JSON.stringify plays on identically', () => {
    const before = main({ hand: ['SUM_BURN'], oppSpellTraps: [[0, 'NEG_SUM']] });
    const opened = apply(before, summon()).state;
    const copy = JSON.parse(JSON.stringify(opened)) as GameState;
    expect(copy).toEqual(opened);
    expect(apply(copy, pass(1))).toEqual(apply(opened, pass(1)));
    expect(apply(copy, act('os-0'))).toEqual(apply(opened, act('os-0')));
  });
});

describe('Summon window before the trigger — optional / targeting triggers keep their prompt', () => {
  it('optional: no prompt while the window is open; after the pass the owner is asked as before', () => {
    const before = main({ hand: ['SUM_HEAL'], oppSpellTraps: [[0, 'NEG_SUM']] });
    const opened = apply(before, summon()).state;
    expect(opened.pendingPrompt).toBeNull();
    expect(opened.chainWindow?.priorityPlayer).toBe(1);

    const asked = apply(opened, pass(1));
    expect(asked.events).toEqual([]);
    expect(asked.state.chainWindow).toBeNull();
    expect(asked.state.pendingPrompt).toMatchObject({ playerIndex: 0, kind: 'TriggerActivation' });
    expect(asked.state.pendingPrompt?.payload).toMatchObject({
      optional: true,
      trigger: { instanceId: 'h0', effectId: 'e1' },
      // Nothing is left to do "afterward": the Summon window already happened.
      afterward: null,
    });

    const accepted = apply(asked.state, answer(asked.state));
    expect(types(accepted.events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'LifePointsRecovered',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(accepted.state.players[0].lifePoints).toBe(before.players[0].lifePoints + 500);
  });

  it('optional, declined after the window: nothing happens and the Summon window does not open a second time', () => {
    const before = main({ hand: ['SUM_HEAL'], oppSpellTraps: [[0, 'TRAP_BURN']] });
    const asked = apply(apply(before, summon()).state, pass(1)).state;
    const { state, events } = apply(asked, answer(asked, [], true));
    expect(events).toEqual([]);
    expect(state.chainWindow).toBeNull();
    expect(state.pendingPrompt).toBeNull();
    expect(() => apply(state, { type: 'EndPhase', payload: { playerIndex: 0 } })).not.toThrow();
  });

  it('optional, negated: the owner is never asked', () => {
    const before = main({ hand: ['SUM_HEAL'], oppSpellTraps: [[0, 'NEG_SUM']] });
    const { state } = apply(apply(before, summon()).state, act('os-0'));
    expect(state.pendingPrompt).toBeNull();
    expect(graveIds(state)).toEqual(['h0']);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints);
  });

  it('mandatory with a target to choose: the target prompt comes after the window', () => {
    const before = main({
      hand: ['SUM_KILL'],
      oppMonsters: [
        [1, 'M1'],
        [3, 'M2'],
      ],
      oppSpellTraps: [[0, 'NEG_SUM']],
    });
    const opened = apply(before, summon()).state;
    expect(opened.pendingPrompt).toBeNull();
    const asked = apply(opened, pass(1)).state;
    expect(asked.pendingPrompt).toMatchObject({ playerIndex: 0, kind: 'TriggerActivation' });
    expect(asked.pendingPrompt?.payload).toMatchObject({
      optional: false,
      candidateInstanceIds: ['o0-1', 'o0-3'],
    });
    const done = apply(asked, answer(asked, ['o0-3']));
    expect(types(done.events)).toContain('MonsterDestroyed');
    expect(done.state.players[1].board.monsterZones[3]).toBeNull();
  });
});

describe('Summon window before the trigger — Flip Summon and Tribute Summon', () => {
  it('Flip Summon: the window carries the FlipSummoned event; negated ⇒ no OnFlip effect', () => {
    const before = main({
      myMonsters: [[2, 'FLIP_BURN', 'DefenseDown']],
      oppSpellTraps: [[0, 'NEG_SUM']],
    });
    const opened = apply(before, flip('m0-2'));
    expect(types(opened.events)).toEqual(['FlipSummoned']);
    expect(opened.state.chainStack).toEqual([]);
    expect(opened.state.chainWindow).toEqual({
      priorityPlayer: 1,
      passCount: 0,
      reactionTo: { kind: 'Summon' },
      summoned: { playerIndex: 0, instanceId: 'm0-2' },
      summonEvent: {
        type: 'FlipSummoned',
        playerIndex: 0,
        instanceId: 'm0-2',
        definitionId: 'FLIP_BURN',
        zoneIndex: 2,
      },
    });

    const { state, events } = apply(opened.state, act('os-0'));
    expect(types(events)).toContain('SummonNegated');
    expect(activatedBy(events, 'm0-2')).toBe(0);
    expect(types(events)).not.toContain('DamageDealt');
    expect(graveIds(state)).toEqual(['m0-2']);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
  });

  it('Flip Summon, the opponent passes: the OnFlip effect happens', () => {
    const before = main({
      myMonsters: [[2, 'FLIP_BURN', 'DefenseDown']],
      oppSpellTraps: [[0, 'NEG_SUM']],
    });
    const { state, events } = apply(apply(before, flip('m0-2')).state, pass(1));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 400);
  });

  it('Tribute Summon negated: Tribute and monster both in the graveyard, no trigger, nothing drawn', () => {
    const before = main({
      hand: ['SUM_DRAW_L5'],
      myMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'NEG_SUM']],
    });
    const opened = apply(before, summon({ tributeInstanceIds: ['m0-0'] }));
    expect(types(opened.events)).toEqual(['MonsterTributed', 'NormalSummoned']);
    expect(opened.state.chainStack).toEqual([]);
    const { state, events } = apply(opened.state, act('os-0'));
    expect(types(events)).not.toContain('CardDrawn');
    expect(activatedBy(events, 'h0')).toBe(0);
    expect(graveIds(state)).toEqual(['m0-0', 'h0']);
    expect(state.players[0].hand).toEqual([]);
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(true);
  });

  it('Tribute Summon, the opponent passes: the trigger draws', () => {
    const before = main({
      hand: ['SUM_DRAW_L5'],
      myMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'NEG_SUM']],
    });
    const opened = apply(before, summon({ tributeInstanceIds: ['m0-0'] })).state;
    const { state, events } = apply(opened, pass(1));
    expect(types(events)).toContain('CardDrawn');
    expect(state.players[0].hand).toHaveLength(1);
  });
});
