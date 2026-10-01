import { describe, expect, it } from 'vitest';
import { applyAction } from '../apply-action.js';
import type { Action, ActivateEffectAction } from '../actions/types.js';
import { effectiveStats } from '../effects/continuous.js';
import { getLegalActions } from '../legal-actions.js';
import type { CardInstance, GameState } from '../state/types.js';
import { deepFreeze } from '../testing/deep-freeze.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../testing/effect-fixtures.js';

/**
 * Task 4.3 — activating a Continuous Spell / Continuous Trap CARD [RULE]. The card goes on the chain like any other
 * activation (Spell: Speed 1, your Main Phase, from the hand or Set; Trap: Speed 2, Set first, not on the turn it was
 * Set per `ruleset.trapSetTurnDelay`); once its link resolved it STAYS face-up in its Spell/Trap Zone and its Continuous
 * effects hold. A face-up card is never activated again. Which cards stay is read from the sub type (ADR 063).
 * [DECISION] 2026-10-01: destroyed while its link waits ⇒ like an Equip (4.2c): what the activation does still
 * resolves (3.4), the card is not sent to the graveyard twice, the Continuous effect never applies.
 */

const act = (
  cardInstanceId: string,
  effectId = 'e1',
  playerIndex: 0 | 1 = 0,
): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId },
});
const set = (cardInstanceId: string, zoneIndex = 0): Action => ({
  type: 'SetSpellTrap',
  payload: { playerIndex: 0, cardInstanceId, zoneIndex },
});
const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const types = (events: readonly { type: string }[]) => events.map((e) => e.type);
const stats = (state: GameState, player: 0 | 1, zone = 0) =>
  effectiveStats(state, state.players[player].board.monsterZones[zone]!, fixtureCtx);
const backrow = (state: GameState, player: 0 | 1 = 0) => state.players[player].board.spellTrapZones;
const graveIds = (state: GameState, player: 0 | 1 = 0) =>
  state.players[player].graveyard.map((c) => c.instanceId);
const both = (setup: FixtureSetup = {}): GameState =>
  fixtureState({ myMonsters: [[0, 'M1']], oppMonsters: [[0, 'M1']], ...setup });
/** The same state with player 1's Spell/Trap Zone `zone` turned face-up (as if activated earlier). */
const oppFaceUp = (state: GameState, zone: number): GameState => ({
  ...state,
  players: [
    state.players[0],
    {
      ...state.players[1],
      board: {
        ...state.players[1].board,
        spellTrapZones: state.players[1].board.spellTrapZones.map((c, i) =>
          i === zone && c ? ({ ...c, position: 'Attack' } as CardInstance) : c,
        ) as unknown as GameState['players'][1]['board']['spellTrapZones'],
      },
    },
  ],
});

describe('Continuous Spell — activating the card', () => {
  it('from the hand: placed face-up in the lowest empty Spell/Trap Zone, stays after resolving, the bonus holds', () => {
    const before = both({ hand: ['CS_BUFF'], mySpellTraps: [[0, 'TRAP_PLAIN']] });
    const { state, events } = apply(before, act('h0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(backrow(state)[1]).toEqual({
      instanceId: 'h0',
      definitionId: 'CS_BUFF',
      ownerIndex: 0,
      position: 'Attack',
    });
    expect(state.players[0].hand).toEqual([]);
    expect(graveIds(state)).toEqual([]);
    expect(state.chainStack).toEqual([]);
    expect(state.chainWindow).toBeNull();
    expect(state.version).toBe(before.version + 1);
    expect([stats(state, 0).atk, stats(state, 1).atk]).toEqual([1300, 1000]);
  });

  it('while its link waits the card is already face-up in its zone (source: that zone)', () => {
    const waiting = apply(
      both({ hand: ['CS_BUFF'], oppSpellTraps: [[0, 'TRAP']] }),
      act('h0'),
    ).state;
    expect(waiting.chainStack[0]).toMatchObject({
      card: { instanceId: 'h0' },
      source: { zone: 'SpellTrapZone', zoneIndex: 0 },
      spellSpeed: 1,
    });
    expect(backrow(waiting)[0]).toMatchObject({ instanceId: 'h0', position: 'Attack' });
  });

  it('what the activation does resolves first, then the card stays', () => {
    const before = both({ hand: ['CS_HEAL_BUFF'] });
    const { state, events } = apply(before, act('h0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'LifePointsRecovered',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints + 500);
    expect(backrow(state)[0]).toMatchObject({ instanceId: 'h0', position: 'Attack' });
    expect(stats(state, 0).def).toBe(1200);
  });

  it('needs an empty Spell/Trap Zone: NO_FREE_SPELL_TRAP_ZONE', () => {
    const full = fixtureState({
      hand: ['CS_BUFF'],
      mySpellTraps: [0, 1, 2, 3, 4].map((z) => [z, 'TRAP_PLAIN'] as [number, string]),
    });
    expectEngineError(() => apply(full, act('h0')), 'NO_FREE_SPELL_TRAP_ZONE');
  });

  it('Set first, then activated in place — even on the turn it was Set [RULE]', () => {
    const setNow = apply(both({ hand: ['CS_BUFF'] }), set('h0', 3)).state;
    expect(stats(setNow, 0).atk).toBe(1000);
    const { state, events } = apply(setNow, act('h0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(backrow(state)[3]).toMatchObject({ instanceId: 'h0', position: 'Attack' });
    expect(backrow(state).filter((c) => c !== null)).toHaveLength(1);
    expect(graveIds(state)).toEqual([]);
    expect(stats(state, 0).atk).toBe(1300);
  });

  it('Spell Speed 1: Main Phase of your own turn only, from the hand or Set', () => {
    for (const setup of [
      { hand: ['CS_BUFF'] },
      { mySpellTraps: [[0, 'CS_BUFF']] },
    ] as FixtureSetup[]) {
      const id = setup.hand ? 'h0' : 'ms-0';
      expectEngineError(
        () => apply(fixtureState({ ...setup, phase: 'Battle' }), act(id)),
        'WRONG_PHASE',
      );
      expect(apply(fixtureState({ ...setup, phase: 'Main2' }), act(id)).state.chainStack).toEqual(
        [],
      );
    }
    const theirs = fixtureState({ oppSpellTraps: [[0, 'CS_BUFF']] });
    expectEngineError(() => apply(theirs, act('os-0', 'e1', 1)), 'NOT_TURN_PLAYER');
    const window: GameState = {
      ...theirs,
      chainWindow: { priorityPlayer: 1, passCount: 0, reactionTo: { kind: 'Summon' } },
    };
    expectEngineError(() => apply(window, act('os-0', 'e1', 1)), 'NOT_TURN_PLAYER');
  });

  it('a face-up Continuous Spell is never activated again; its Continuous effect is never activated at all', () => {
    const state = apply(fixtureState({ hand: ['CS_BUFF'] }), act('h0')).state;
    expectEngineError(() => apply(state, act('h0')), 'NOT_ACTIVATABLE');
    expectEngineError(() => apply(state, act('h0', 'e2')), 'CONTINUOUS_NOT_ACTIVATABLE');
    expect(getLegalActions(state, 0, fixtureCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );
  });

  it('a Continuous Spell without any Continuous effect still stays (the sub type decides, not the effects)', () => {
    const before = fixtureState({ hand: ['CONT'] });
    const { state, events } = apply(before, act('h0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'CardDrawn',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(backrow(state)[0]).toMatchObject({ instanceId: 'h0', position: 'Attack' });
  });

  it('a Normal Spell still goes to the graveyard after it resolves (nothing stays)', () => {
    const { state, events } = apply(fixtureState({ hand: ['HEAL'] }), act('h0'));
    expect(types(events)).toContain('CardSentToGraveyard');
    expect(graveIds(state)).toEqual(['h0']);
    expect(backrow(state).every((c) => c === null)).toBe(true);
  });
});

describe('Continuous Trap — activating the card', () => {
  it('cannot be activated from the hand (C11), nor on the turn it was Set (trapSetTurnDelay)', () => {
    expectEngineError(() => apply(fixtureState({ hand: ['CT_WEAK'] }), act('h0')), 'TRAP_NOT_SET');
    const setNow = apply(fixtureState({ hand: ['CT_WEAK'] }), set('h0')).state;
    expectEngineError(() => apply(setNow, act('h0')), 'TRAP_SET_THIS_TURN');
    const noDelay: GameState = {
      ...setNow,
      ruleset: { ...setNow.ruleset, trapSetTurnDelay: false },
    };
    expect(backrow(apply(noDelay, act('h0')).state)[0]?.position).toBe('Attack');
  });

  it('Set on an earlier turn: flips face-up in any phase, stays after resolving, the penalty holds', () => {
    const before = both({ mySpellTraps: [[2, 'CT_WEAK', 0]], phase: 'Battle' });
    const { state, events } = apply(before, act('ms-2'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(backrow(state)[2]).toMatchObject({ instanceId: 'ms-2', position: 'Attack' });
    expect(graveIds(state)).toEqual([]);
    expect([stats(state, 0).atk, stats(state, 1).atk]).toEqual([1000, 700]);
  });

  it('the opponent chains it (Spell Speed 2) to my Spell; both resolve, the Trap stays face-up', () => {
    const opened = apply(
      both({ hand: ['HEAL'], oppSpellTraps: [[0, 'CT_BURN_WEAK']] }),
      act('h0'),
    ).state;
    expect(opened.chainWindow).toMatchObject({ priorityPlayer: 1 });
    const { state, events } = apply(opened, act('os-0', 'e1', 1));
    expect(events.filter((e) => e.type === 'EffectResolved').map((e) => e.definitionId)).toEqual([
      'CT_BURN_WEAK',
      'HEAL',
    ]);
    expect(backrow(state, 1)[0]).toMatchObject({ instanceId: 'os-0', position: 'Attack' });
    expect(graveIds(state, 1)).toEqual([]);
    expect(graveIds(state, 0)).toEqual(['h0']);
    expect(state.players[0].lifePoints).toBe(opened.players[0].lifePoints - 200 + 700);
    expect(stats(state, 0).atk).toBe(700);
  });

  it('a face-up Continuous Trap is never activated again and holds no window open', () => {
    const base = both({ hand: ['HEAL'], oppSpellTraps: [[0, 'CT_WEAK']] });
    const faceUp = oppFaceUp(base, 0);
    expect(stats(faceUp, 0).atk).toBe(700);
    const { state } = apply(faceUp, act('h0'));
    expect(state.chainWindow).toBeNull();
    const window: GameState = { ...faceUp, chainWindow: { priorityPlayer: 1, passCount: 0 } };
    expectEngineError(() => apply(window, act('os-0', 'e1', 1)), 'NOT_ACTIVATABLE');
  });
});

describe('Continuous Spell/Trap — leaving the field', () => {
  it('destroyed later: SpellTrapDestroyed, graveyard, the effect stops with the next read', () => {
    const faceUp = oppFaceUp(both({ hand: ['KILL_ST'], oppSpellTraps: [[1, 'CT_WEAK']] }), 1);
    expect(stats(faceUp, 0).atk).toBe(700);
    const { state, events } = apply(faceUp, act('h0'));
    expect(types(events)).toContain('SpellTrapDestroyed');
    expect(backrow(state, 1)[1]).toBeNull();
    expect(graveIds(state, 1)).toEqual(['os-1']);
    expect(stats(state, 0).atk).toBe(1000);
  });

  it('destroyed while its link waits: the activation still resolves, the card is not sent twice, no bonus', () => {
    const before = both({ hand: ['CS_HEAL_BUFF'], oppSpellTraps: [[0, 'QP_KILL_ST']] });
    const waiting = apply(before, act('h0')).state;
    const { state, events } = apply(waiting, act('os-0', 'e1', 1));
    expect(types(events)).toContain('SpellTrapDestroyed');
    expect(events.filter((e) => e.type === 'EffectResolved').map((e) => e.definitionId)).toEqual([
      'QP_KILL_ST',
      'CS_HEAL_BUFF',
    ]);
    expect(events.filter((e) => e.type === 'CardSentToGraveyard' && e.instanceId === 'h0')).toEqual(
      [],
    );
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints + 500);
    expect(backrow(state).every((c) => c === null)).toBe(true);
    expect(graveIds(state)).toEqual(['h0']);
    expect(stats(state, 0).def).toBe(1000);
  });
});
