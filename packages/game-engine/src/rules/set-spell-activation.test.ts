import { describe, expect, it } from 'vitest';
import { applyAction } from '../apply-action.js';
import type { Action, ActivateEffectAction } from '../actions/types.js';
import { getLegalActions } from '../legal-actions.js';
import type { GameState } from '../state/types.js';
import { deepFreeze } from '../testing/deep-freeze.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState } from '../testing/effect-fixtures.js';

/**
 * Task 4.3 — a Normal Spell that was Set is activated from its Spell/Trap Zone [RULE]: your own turn, Main Phase, Spell
 * Speed 1 (never a response). It flips face-up, resolves, and goes to the graveyard. [DECISION] 2026-10-01 (standard
 * rule, against the task brief): it may be activated on the very turn it was Set — only Quick-Play Spells
 * (`SPELL_SET_THIS_TURN`) and Traps wait a turn. A Set Equip Spell stays `NOT_ACTIVATABLE` (backlog).
 */

const act = (cardInstanceId: string, playerIndex: 0 | 1 = 0): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId: 'e1' },
});
const set = (cardInstanceId: string, zoneIndex = 0): Action => ({
  type: 'SetSpellTrap',
  payload: { playerIndex: 0, cardInstanceId, zoneIndex },
});
const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const types = (events: readonly { type: string }[]) => events.map((e) => e.type);

describe('a Set Normal Spell', () => {
  it('is activated on the turn it was Set: flips, resolves, goes to the graveyard from its zone', () => {
    const setNow = apply(fixtureState({ hand: ['DRAW'] }), set('h0', 2)).state;
    const { state, events } = apply(setNow, act('h0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'CardDrawn',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events).toContainEqual({
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'h0',
      definitionId: 'DRAW',
      from: 'SpellTrapZone',
    });
    expect(state.players[0].board.spellTrapZones[2]).toBeNull();
    expect(state.players[0].graveyard).toEqual([
      { instanceId: 'h0', definitionId: 'DRAW', ownerIndex: 0, position: null },
    ]);
    expect(state.players[0].hand).toHaveLength(1);
    expect(state.version).toBe(setNow.version + 1);
  });

  it('is activated on a later turn too, in Main Phase 2', () => {
    const before = fixtureState({ mySpellTraps: [[1, 'HEAL', 0]], phase: 'Main2' });
    const { state } = apply(before, act('ms-1'));
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints + 700);
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['ms-1']);
  });

  it('while its link waits it sits face-up in its zone (source: that zone)', () => {
    const waiting = apply(
      fixtureState({ mySpellTraps: [[4, 'HEAL']], oppSpellTraps: [[0, 'TRAP']] }),
      act('ms-4'),
    ).state;
    expect(waiting.chainStack[0]).toMatchObject({
      source: { zone: 'SpellTrapZone', zoneIndex: 4 },
      spellSpeed: 1,
    });
    expect(waiting.players[0].board.spellTrapZones[4]).toMatchObject({ position: 'Attack' });
  });

  it('only in a Main Phase: WRONG_PHASE in the Battle Phase', () => {
    const state = fixtureState({ mySpellTraps: [[0, 'DRAW']], phase: 'Battle' });
    expectEngineError(() => apply(state, act('ms-0')), 'WRONG_PHASE');
  });

  it("only on its controller's turn: NOT_TURN_PLAYER, even while they hold priority in a window", () => {
    const theirs = fixtureState({ oppSpellTraps: [[0, 'DRAW']] });
    expectEngineError(() => apply(theirs, act('os-0', 1)), 'NOT_TURN_PLAYER');
    const window: GameState = {
      ...theirs,
      chainWindow: { priorityPlayer: 1, passCount: 0, reactionTo: { kind: 'Summon' } },
    };
    expectEngineError(() => apply(window, act('os-0', 1)), 'NOT_TURN_PLAYER');
  });

  it('never keeps a chain window open for the opponent (it is not a response)', () => {
    const { state } = apply(
      fixtureState({ hand: ['HEAL'], oppSpellTraps: [[0, 'DRAW']] }),
      act('h0'),
    );
    expect(state.chainWindow).toBeNull();
    expect(state.chainStack).toEqual([]);
  });

  it('cannot be chained to anything, not even by the turn player: SPELL_SPEED_TOO_LOW', () => {
    const opened = apply(
      fixtureState({
        hand: ['HEAL', 'QP_HEAL'],
        mySpellTraps: [[0, 'DRAW']],
        oppSpellTraps: [[0, 'TRAP']],
      }),
      act('h0'),
    ).state;
    const backToMe = apply(opened, act('os-0', 1)).state;
    expect(backToMe.chainWindow).toMatchObject({ priorityPlayer: 0 });
    expectEngineError(() => apply(backToMe, act('ms-0')), 'SPELL_SPEED_TOO_LOW');
  });

  it('with a target to choose: stays face-down while the prompt is open, then flips and resolves', () => {
    const before = fixtureState({
      mySpellTraps: [[0, 'KILL']],
      oppMonsters: [
        [0, 'M1'],
        [1, 'M1'],
      ],
    });
    const prompted = apply(before, act('ms-0')).state;
    expect(prompted.pendingPrompt?.kind).toBe('SelectEffectTarget');
    expect(prompted.players[0].board.spellTrapZones[0]?.position).toBe('DefenseDown');
    const { state } = apply(prompted, {
      type: 'ResolvePendingPrompt',
      payload: {
        playerIndex: 0,
        promptId: prompted.pendingPrompt!.promptId,
        cardInstanceIds: ['o0-1'],
      },
    });
    expect(state.players[1].board.monsterZones[1]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['ms-0']);
  });

  it('shows up in legalActions', () => {
    const state = fixtureState({ mySpellTraps: [[0, 'DRAW']] });
    expect(getLegalActions(state, 0, fixtureCtx)).toContainEqual(act('ms-0'));
    expect(getLegalActions({ ...state, phase: 'Battle' }, 0, fixtureCtx)).not.toContainEqual(
      act('ms-0'),
    );
  });
});

describe('Set cards that still wait or still cannot be activated', () => {
  it('a Quick-Play Spell Set this turn: SPELL_SET_THIS_TURN (unchanged)', () => {
    const setNow = apply(fixtureState({ hand: ['QP_HEAL'] }), set('h0')).state;
    expectEngineError(() => apply(setNow, act('h0')), 'SPELL_SET_THIS_TURN');
  });

  it('a Set Equip Spell: NOT_ACTIVATABLE (backlog)', () => {
    const state = fixtureState({ mySpellTraps: [[0, 'EQ_POWER']], myMonsters: [[0, 'M1']] });
    expectEngineError(() => apply(state, act('ms-0')), 'NOT_ACTIVATABLE');
  });
});
