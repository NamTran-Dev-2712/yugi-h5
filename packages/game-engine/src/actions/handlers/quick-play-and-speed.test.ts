import type { CardDefinition, EffectDefinition } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import { spellSpeedOf } from '../../effects/spell-speed.js';
import type { GameEvent } from '../../events/types.js';
import { getLegalActions } from '../../legal-actions.js';
import type { GameState } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { FIXTURE_DEFS, fixtureCtx, fixtureState, inst } from '../../testing/effect-fixtures.js';
import type { Action, ActivateEffectAction } from '../types.js';

/*
 * Task 3.4 — Spell Speed from data + Quick-Play timing [RULE] (owner-approved 2026-09-27):
 * - Quick-Play from the hand: own turn only, any phase. On the opponent's turn it must have been Set, and not this turn.
 * - Speed: explicit `effect.spellSpeed` wins; otherwise Counter Trap 3, other Traps and Quick-Play 2, the rest 1.
 * - A chain link needs Speed ≥ 2 and ≥ the top link's speed (SPELL_SPEED_TOO_LOW).
 */

const activate = (cardInstanceId: string, playerIndex: 0 | 1 = 0): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId: 'e1' },
});
const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const linkSpeeds = (events: readonly GameEvent[]) =>
  events
    .filter((e): e is Extract<GameEvent, { type: 'ChainLinkAdded' }> => e.type === 'ChainLinkAdded')
    .map((e) => e.spellSpeed);

/** Gives player 1 a hand of the given definitions (instance ids x0, x1, ...). */
function withOppHand(state: GameState, defs: string[]): GameState {
  const hand = defs.map((d, i) => inst(`x${i}`, d, 1));
  return { ...state, players: [state.players[0], { ...state.players[1], hand }] };
}

describe('spellSpeedOf — defaults and override', () => {
  const effectOf = (def: CardDefinition): EffectDefinition => def.effects![0]!;
  it.each([
    ['Normal Spell', 'DRAW', 1],
    ['Quick-Play Spell', 'QP_HEAL', 2],
    ['Normal Trap', 'TRAP', 2],
    ['Continuous Trap', 'CONT_TRAP', 2],
    ['Counter Trap', 'COUNTER', 3],
    ['explicit spellSpeed on a Normal Trap', 'TRAP_SPEED3', 3],
  ])('%s → %s', (_name, id, speed) => {
    const def = FIXTURE_DEFS[id]!;
    expect(spellSpeedOf(def, effectOf(def))).toBe(speed);
  });

  it('an explicit spellSpeed can also lower the default', () => {
    const def = FIXTURE_DEFS['QP_HEAL']!;
    expect(spellSpeedOf(def, { ...effectOf(def), spellSpeed: 1 })).toBe(1);
  });
});

describe('Quick-Play from the hand', () => {
  it.each(['Draw', 'Standby', 'Main1', 'Battle', 'Main2', 'End'] as const)(
    'may be activated in any phase of your own turn (%s)',
    (phase) => {
      const { state, events } = apply(fixtureState({ phase, hand: ['QP_HEAL'] }), activate('h0'));
      expect(linkSpeeds(events)).toEqual([2]);
      expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h0']);
    },
  );

  it('a Normal Spell from the hand is still Main Phase only', () => {
    expectEngineError(
      () => apply(fixtureState({ phase: 'Battle', hand: ['DRAW'] }), activate('h0')),
      'WRONG_PHASE',
    );
  });

  it("cannot be activated from the hand on the opponent's turn, even with priority in a window", () => {
    // Player 1 holds a Set trap (so the window opens for them) and a Quick-Play in hand.
    const opened = apply(
      withOppHand(fixtureState({ hand: ['DRAW'], oppSpellTraps: [[0, 'TRAP']] }), ['QP_HEAL']),
      activate('h0'),
    ).state;
    expect(opened.chainWindow).toEqual({ priorityPlayer: 1, passCount: 0 });
    expectEngineError(() => apply(opened, activate('x0', 1)), 'NOT_TURN_PLAYER');
    const legal = getLegalActions(opened, 1, fixtureCtx);
    expect(legal).toContainEqual(activate('os-0', 1));
    expect(legal).not.toContainEqual(activate('x0', 1));
  });
});

describe('Set Quick-Play', () => {
  it('cannot be activated the turn it was Set (SPELL_SET_THIS_TURN), whatever trapSetTurnDelay says', () => {
    const s = fixtureState({ mySpellTraps: [[0, 'QP_HEAL', 1]] });
    expectEngineError(() => apply(s, activate('ms-0')), 'SPELL_SET_THIS_TURN');
    const relaxed: GameState = { ...s, ruleset: { ...s.ruleset, trapSetTurnDelay: false } };
    expectEngineError(() => apply(relaxed, activate('ms-0')), 'SPELL_SET_THIS_TURN');
  });

  it('Set through the real action → SPELL_SET_THIS_TURN in the same turn', () => {
    const set = apply(fixtureState({ hand: ['QP_HEAL'] }), {
      type: 'SetSpellTrap',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 4 },
    }).state;
    expectEngineError(() => apply(set, activate('h0')), 'SPELL_SET_THIS_TURN');
  });

  it('Set on an earlier turn: activatable by the turn player in any phase', () => {
    const { state, events } = apply(
      fixtureState({ phase: 'End', mySpellTraps: [[2, 'QP_HEAL', 0]] }),
      activate('ms-2'),
    );
    expect(linkSpeeds(events)).toEqual([2]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'CardSentToGraveyard',
        instanceId: 'ms-2',
        from: 'SpellTrapZone',
      }),
    );
    expect(state.players[0].board.spellTrapZones[2]).toBeNull();
  });

  it("the opponent's Set Quick-Play answers my chain on my turn", () => {
    const before = fixtureState({ hand: ['DRAW'], oppSpellTraps: [[1, 'QP_BURN']] });
    const opened = apply(before, activate('h0')).state;
    expect(opened.chainWindow).toEqual({ priorityPlayer: 1, passCount: 0 });
    const { state, events } = apply(opened, activate('os-1', 1));
    expect(linkSpeeds(events)).toEqual([2]);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints - 200);
    expect(state.chainWindow).toBeNull();
  });
});

describe('Spell Speed enforcement', () => {
  it('a Counter Trap (Speed 3) may start a chain', () => {
    const { events } = apply(fixtureState({ mySpellTraps: [[0, 'COUNTER']] }), activate('ms-0'));
    expect(linkSpeeds(events)).toEqual([3]);
  });

  it('a Counter Trap answers a Speed 2 link; nothing below Speed 3 may answer it', () => {
    // Me: Normal Spell + Set Counter Trap. Opponent: Set Normal Trap (Speed 2) and another one.
    const opened = apply(
      fixtureState({
        hand: ['DRAW'],
        mySpellTraps: [[0, 'COUNTER']],
        oppSpellTraps: [
          [0, 'TRAP_BURN'],
          [1, 'TRAP'],
        ],
      }),
      activate('h0'),
    ).state;
    const answered = apply(opened, activate('os-0', 1)).state;
    expect(answered.chainWindow).toEqual({ priorityPlayer: 0, passCount: 0 });

    const { state, events } = apply(answered, activate('ms-0'));
    expect(linkSpeeds(events)).toEqual([3]);
    // The opponent's remaining Speed 2 trap cannot answer Speed 3 → auto-pass, the chain resolves at once.
    expect(state.chainWindow).toBeNull();
    expect(state.players[1].board.spellTrapZones[1]?.position).toBe('DefenseDown');
  });

  it('SPELL_SPEED_TOO_LOW: Speed 2 cannot answer a Speed 3 link', () => {
    const base = fixtureState({ mySpellTraps: [[0, 'COUNTER']], oppSpellTraps: [[1, 'TRAP']] });
    // Build "Counter Trap on the chain, opponent holds priority" by hand (auto-pass would never leave it open).
    const counterLink = {
      linkId: 'link-1-0',
      playerIndex: 0 as const,
      card: { ...base.players[0].board.spellTrapZones[0]!, position: 'Attack' as const },
      effectId: 'e1',
      spellSpeed: 3 as const,
      costInstanceIds: [],
      lpPaid: 0,
      targetInstanceIds: [],
      source: { zone: 'SpellTrapZone' as const, zoneIndex: 0 },
    };
    const state: GameState = {
      ...base,
      chainStack: [counterLink],
      chainWindow: { priorityPlayer: 1, passCount: 0 },
    };
    expectEngineError(() => apply(state, activate('os-1', 1)), 'SPELL_SPEED_TOO_LOW');
  });

  it('a Counter Trap answers another Counter Trap (window opens for its owner)', () => {
    const opened = apply(
      fixtureState({ mySpellTraps: [[0, 'COUNTER']], oppSpellTraps: [[0, 'COUNTER']] }),
      activate('ms-0'),
    ).state;
    expect(opened.chainWindow).toEqual({ priorityPlayer: 1, passCount: 0 });
    const { events } = apply(opened, activate('os-0', 1));
    expect(linkSpeeds(events)).toEqual([3]);
  });

  it('an explicit spellSpeed 3 on a Normal Trap is honoured on the chain', () => {
    const { events } = apply(
      fixtureState({ mySpellTraps: [[0, 'TRAP_SPEED3']] }),
      activate('ms-0'),
    );
    expect(linkSpeeds(events)).toEqual([3]);
  });
});
