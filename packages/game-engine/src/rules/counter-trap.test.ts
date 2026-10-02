import { describe, expect, it } from 'vitest';
import { applyAction } from '../apply-action.js';
import type { Action, ActivateEffectAction } from '../actions/types.js';
import { getLegalActions } from '../legal-actions.js';
import type { GameState } from '../state/types.js';
import { deepFreeze } from '../testing/deep-freeze.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../testing/effect-fixtures.js';

/*
 * Task 4.4 — Counter Trap rules (Tier A, shared by every Counter Trap card; ADR 065).
 * - [RULE] a Counter Trap is Spell Speed 3 and is only ever activated IN RESPONSE: to a chain link or inside a reaction
 *   window (attack / Summon). It never starts a chain on its own, in any phase (`NOTHING_TO_RESPOND_TO`).
 * - [RULE] it answers a link of any Spell Speed; only Spell Speed 3 answers a Spell Speed 3 link.
 * - Everything else is the ordinary Set Trap rule (not from the hand, not on the turn it was Set).
 * Fixture: player 0 is the turn player (turn 1, Main Phase 1); `ms-<zone>` / `os-<zone>` are Set cards of player 0 / 1.
 */

const act = (cardInstanceId: string, playerIndex: 0 | 1 = 0): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId: 'e1' },
});
const pass = (playerIndex: 0 | 1): Action => ({ type: 'PassPriority', payload: { playerIndex } });
const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const types = (events: readonly { type: string }[]) => events.map((e) => e.type);
const lp = (state: GameState) => state.players.map((p) => p.lifePoints);
const graveIds = (state: GameState, player: 0 | 1) =>
  state.players[player].graveyard.map((c) => c.instanceId);
const activations = (state: GameState, seat: 0 | 1) =>
  getLegalActions(state, seat, fixtureCtx).filter((a) => a.type === 'ActivateEffect');
const battle = (setup: FixtureSetup): GameState => ({
  ...fixtureState({ phase: 'Battle', ...setup }),
  turnCount: 3,
});

describe('Counter Trap — only in response', () => {
  it.each(['Draw', 'Standby', 'Main1', 'Battle', 'Main2', 'End'] as const)(
    'never starts a chain (%s): NOTHING_TO_RESPOND_TO, and it is not a legal action',
    (phase) => {
      for (const card of ['COUNTER', 'NEG_ACT', 'NEG_ANY', 'NEG_SUM']) {
        const state = fixtureState({ phase, mySpellTraps: [[0, card]] });
        expectEngineError(() => apply(state, act('ms-0')), 'NOTHING_TO_RESPOND_TO');
        expect(activations(state, 0)).toEqual([]);
      }
    },
  );

  it('the rule reads the card (a Counter Trap), not the Spell Speed: an explicit Speed 3 Normal Trap may start a chain', () => {
    const { events } = apply(fixtureState({ mySpellTraps: [[0, 'TRAP_SPEED3']] }), act('ms-0'));
    expect(types(events)).toContain('EffectResolved');
  });

  it('still a Trap: not from the hand (C11), not on the turn it was Set — those are reported first', () => {
    const inHand = fixtureState({ hand: ['NEG_ACT'] });
    expectEngineError(() => apply(inHand, act('h0')), 'TRAP_NOT_SET');
    const setNow = fixtureState({ mySpellTraps: [[0, 'NEG_ACT', 1]] });
    expectEngineError(() => apply(setNow, act('ms-0')), 'TRAP_SET_THIS_TURN');
  });

  it('a Counter Trap Set this turn does not hold the window open: the Spell resolves at once', () => {
    const before = fixtureState({ hand: ['HEAL'], oppSpellTraps: [[0, 'NEG_ACT', 1]] });
    const { state, events } = apply(before, act('h0'));
    expect(types(events)).toContain('LifePointsRecovered');
    expect(state.chainWindow).toBeNull();
    expect(state.players[1].board.spellTrapZones[0]?.position).toBe('DefenseDown');
  });

  it('answers a Spell Speed 1 link: the window opens for its holder, who may activate it or pass', () => {
    const opened = apply(
      fixtureState({ hand: ['HEAL'], oppSpellTraps: [[0, 'NEG_ACT']] }),
      act('h0'),
    ).state;
    expect(opened.chainWindow).toEqual({ priorityPlayer: 1, passCount: 0 });
    expect(activations(opened, 1)).toEqual([act('os-0', 1)]);
    expect(getLegalActions(opened, 1, fixtureCtx)).toContainEqual(pass(1));
    expect(activations(opened, 0)).toEqual([]);
  });

  it('inside an attack reaction window (empty chain) a Counter Trap may be activated; the attack then goes on', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'COUNTER']] });
    const opened = apply(before, {
      type: 'DeclareAttack',
      payload: { playerIndex: 0, attackerInstanceId: 'm0-0' },
    }).state;
    expect(opened.chainWindow).toMatchObject({ priorityPlayer: 1, reactionTo: { kind: 'Attack' } });
    const { state, events } = apply(opened, act('os-0', 1));
    expect(events.filter((e) => e.type === 'ChainLinkAdded').map((e) => e.spellSpeed)).toEqual([3]);
    expect(lp(state)).toEqual([
      before.players[0].lifePoints,
      before.players[1].lifePoints + 50 - 2000,
    ]);
  });
});

describe('Counter Trap — Spell Speed 3 on the chain', () => {
  it('3 links: Spell → Trap (Speed 2) → Counter Trap; the Counter Trap negates only the Trap, the Spell resolves', () => {
    const before = fixtureState({
      hand: ['HEAL'],
      mySpellTraps: [[0, 'NEG_ACT']],
      oppSpellTraps: [[0, 'TRAP_BURN']],
    });
    const link1 = apply(before, act('h0')).state;
    const link2 = apply(link1, act('os-0', 1)).state;
    expect(link2.chainWindow).toEqual({ priorityPlayer: 0, passCount: 0 });
    expect(link2.chainStack.map((l) => l.spellSpeed)).toEqual([1, 2]);

    const { state, events } = apply(link2, act('ms-0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'LifePointsPaid',
      'ChainLinkAdded',
      'ChainLinkNegated',
      'CardSentToGraveyard', // the negated Trap
      'EffectResolved', // the Counter Trap
      'CardSentToGraveyard',
      'LifePointsRecovered', // link 1 still resolves
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events.find((e) => e.type === 'ChainLinkAdded')).toMatchObject({
      chainIndex: 3,
      spellSpeed: 3,
    });
    expect(events.find((e) => e.type === 'ChainResolved')).toEqual({
      type: 'ChainResolved',
      linkCount: 3,
    });
    // TRAP_BURN (300 to player 0) never resolved; HEAL (+700) did; the cost (1000) stays paid.
    expect(lp(state)).toEqual([8000 - 1000 + 700, 8000]);
    expect(graveIds(state, 1)).toEqual(['os-0']);
    expect(graveIds(state, 0)).toEqual(['ms-0', 'h0']);
    expect(state.chainStack).toEqual([]);
    expect(state.chainWindow).toBeNull();
    expect(state.version).toBe(link2.version + 1);
  });

  it('a Counter Trap answers a Counter Trap: the second one negates the first, whose cost is not refunded', () => {
    const before = fixtureState({
      hand: ['HEAL'],
      mySpellTraps: [[0, 'NEG_ACT']],
      oppSpellTraps: [[0, 'NEG_ACT']],
    });
    const link2 = apply(apply(before, act('h0')).state, act('os-0', 1)).state;
    expect(link2.chainWindow).toEqual({ priorityPlayer: 0, passCount: 0 });
    expect(lp(link2)).toEqual([8000, 7000]);

    const { state, events } = apply(link2, act('ms-0'));
    expect(events.filter((e) => e.type === 'ChainLinkNegated')).toEqual([
      {
        type: 'ChainLinkNegated',
        linkId: link2.chainStack[1]!.linkId,
        playerIndex: 1,
        instanceId: 'os-0',
        definitionId: 'NEG_ACT',
        effectId: 'e1',
        byInstanceId: 'ms-0',
      },
    ]);
    // Player 1's Counter Trap was negated, so the Spell it wanted to negate resolves.
    expect(events.filter((e) => e.type === 'EffectResolved').map((e) => e.instanceId)).toEqual([
      'ms-0',
      'h0',
    ]);
    expect(lp(state)).toEqual([8000 - 1000 + 700, 7000]);
    expect(graveIds(state, 1)).toEqual(['os-0']);
  });

  it('SPELL_SPEED_TOO_LOW: a Speed 2 negation cannot answer a Counter Trap', () => {
    const before = fixtureState({
      hand: ['HEAL'],
      mySpellTraps: [
        [0, 'NEG_ACT'],
        [1, 'NEG_ACT_S2'],
      ],
      oppSpellTraps: [[0, 'NEG_ACT']],
    });
    const link2 = apply(apply(before, act('h0')).state, act('os-0', 1)).state;
    expectEngineError(() => apply(link2, act('ms-1')), 'SPELL_SPEED_TOO_LOW');
    expect(activations(link2, 0)).toEqual([act('ms-0')]);
  });

  it('with only a Speed 2 card against a Counter Trap nobody can answer: the chain resolves at once', () => {
    const before = fixtureState({
      hand: ['HEAL'],
      mySpellTraps: [[1, 'NEG_ACT_S2']],
      oppSpellTraps: [[0, 'NEG_ACT']],
    });
    const { state, events } = apply(apply(before, act('h0')).state, act('os-0', 1));
    expect(state.chainWindow).toBeNull();
    expect(types(events)).not.toContain('LifePointsRecovered');
    expect(state.players[0].board.spellTrapZones[1]?.position).toBe('DefenseDown');
  });

  it('after the chain the turn goes on: EndPhase is accepted, the turn can end', () => {
    const before = fixtureState({ hand: ['HEAL'], oppSpellTraps: [[0, 'NEG_ACT']] });
    let state = apply(apply(before, act('h0')).state, act('os-0', 1)).state;
    expect(state.chainWindow).toBeNull();
    expect(state.pendingPrompt).toBeNull();
    const endPhase: Action = { type: 'EndPhase', payload: { playerIndex: 0 } };
    for (let i = 0; i < 4; i++) state = apply(state, endPhase).state;
    expect(state.turnPlayerIndex).toBe(1);
    expect(state.turnCount).toBe(before.turnCount + 1);
  });

  it('the holder may pass instead: the chain resolves untouched and the Counter Trap stays Set', () => {
    const before = fixtureState({ hand: ['HEAL'], oppSpellTraps: [[0, 'NEG_ACT']] });
    const { state, events } = apply(apply(before, act('h0')).state, pass(1));
    expect(types(events)).toEqual([
      'LifePointsRecovered',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([8700, 8000]);
    expect(state.players[1].board.spellTrapZones[0]?.position).toBe('DefenseDown');
  });
});
