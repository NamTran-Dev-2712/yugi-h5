import { describe, expect, it } from 'vitest';
import { applyAction } from '../apply-action.js';
import type { Action, ActivateEffectAction } from '../actions/types.js';
import type { GameEvent } from '../events/types.js';
import { getLegalActions } from '../legal-actions.js';
import type { GameState } from '../state/types.js';
import { deepFreeze } from '../testing/deep-freeze.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState } from '../testing/effect-fixtures.js';

/**
 * C11 contract — see docs/design/engine.md "Kích hoạt Trap/Spell".
 * [DECISION] Trap must be Set to activate; [RULE] not on the turn it was Set (`ruleset.trapSetTurnDelay`);
 * [RULE] normal Spell activates from hand in own Main Phase.
 * Task 3.4 [RULE] (owner-approved): an activated Set Trap flips face-up and STAYS in its zone until its link resolves,
 * then goes to the graveyard (`from: 'SpellTrapZone'`); destroyed mid-chain, its effect still resolves. The turn player
 * may activate Set cards in any phase; the other player only through an open chain window.
 * Fixture turn 1 = player 0's turn (`turnCount` 1); Set cards without a `setTurn` were Set long ago.
 */

const activate = (cardInstanceId: string, playerIndex: 0 | 1 = 0): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId: 'e1' },
});
const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const types = (events: readonly { type: string }[]) => events.map((e) => e.type);
const resolvedIds = (events: readonly GameEvent[]) =>
  events
    .filter((e): e is Extract<GameEvent, { type: 'EffectResolved' }> => e.type === 'EffectResolved')
    .map((e) => e.definitionId);

describe('trap activation (C11)', () => {
  it('trap in hand cannot be activated', () => {
    const state = fixtureState({ hand: ['TRAP'] });
    expectEngineError(() => applyAction(state, activate('h0'), fixtureCtx), 'TRAP_NOT_SET');
  });

  it('trap set this turn cannot be activated this turn', () => {
    // Set through the real action, then try to activate it in the same turn.
    const set = apply(fixtureState({ hand: ['TRAP'] }), {
      type: 'SetSpellTrap',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 2 },
    }).state;
    expectEngineError(() => apply(set, activate('h0')), 'TRAP_SET_THIS_TURN');
  });

  it('set trap can be activated from the next turn', () => {
    const before = fixtureState({ mySpellTraps: [[0, 'TRAP', 0]] });
    const { state, events } = apply(before, activate('ms-0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'LifePointsRecovered',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events).toContainEqual({
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'ms-0',
      definitionId: 'TRAP',
      from: 'SpellTrapZone',
    });
    expect(events.find((e) => e.type === 'ChainLinkAdded')).toMatchObject({ spellSpeed: 2 });
    expect(state.players[0].board.spellTrapZones[0]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['ms-0']);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints + 100);
    expect(state.chainStack).toEqual([]);
    expect(state.chainWindow).toBeNull();
    expect(state.version).toBe(before.version + 1);
  });

  it('normal spell can be activated from hand in Main Phase', () => {
    const state = fixtureState({ hand: ['DRAW'] });
    expect(() => applyAction(state, activate('h0'), fixtureCtx)).not.toThrow();
  });

  it('activating a trap in hand is rejected with TRAP_NOT_SET', () => {
    const state = fixtureState({ hand: ['TRAP'] });
    expectEngineError(() => applyAction(state, activate('h0'), fixtureCtx), 'TRAP_NOT_SET');
  });

  it('activating a trap set this turn is rejected with TRAP_SET_THIS_TURN', () => {
    const state = fixtureState({ mySpellTraps: [[0, 'TRAP', 1]] });
    expectEngineError(() => apply(state, activate('ms-0')), 'TRAP_SET_THIS_TURN');
  });

  it('trapSetTurnDelay=false lets a trap be activated the turn it was Set', () => {
    const s = fixtureState({ mySpellTraps: [[0, 'TRAP', 1]] });
    const relaxed: GameState = { ...s, ruleset: { ...s.ruleset, trapSetTurnDelay: false } };
    const { state } = apply(relaxed, activate('ms-0'));
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['ms-0']);
  });

  it('legalActions never lists Activate for a trap in hand, only Set', () => {
    const state = fixtureState({ hand: ['TRAP'] });
    const legal = getLegalActions(state, 0, fixtureCtx);
    expect(legal.some((a) => a.type === 'ActivateEffect')).toBe(false);
    expect(legal.some((a) => a.type === 'SetSpellTrap')).toBe(true);
  });

  it('legalActions lists a Set trap from an earlier turn, not one Set this turn', () => {
    const state = fixtureState({
      mySpellTraps: [
        [0, 'TRAP', 0],
        [1, 'TRAP', 1],
      ],
    });
    const ids = getLegalActions(state, 0, fixtureCtx)
      .filter((a): a is ActivateEffectAction => a.type === 'ActivateEffect')
      .map((a) => a.payload.cardInstanceId);
    expect(ids).toEqual(['ms-0']);
  });
});

describe('Set trap — timing and location', () => {
  it.each(['Draw', 'Standby', 'Main1', 'Battle', 'Main2', 'End'] as const)(
    'the turn player may activate a Set trap in %s',
    (phase) => {
      const { state } = apply(
        fixtureState({ phase, mySpellTraps: [[3, 'TRAP']] }),
        activate('ms-3'),
      );
      expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['ms-3']);
    },
  );

  it('the other player cannot activate a Set trap outside a chain window', () => {
    const state = fixtureState({ oppSpellTraps: [[0, 'TRAP']] });
    expectEngineError(() => apply(state, activate('os-0', 1)), 'NOT_TURN_PLAYER');
    expect(getLegalActions(state, 1, fixtureCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );
  });

  it('a Set card of the other player is not yours to activate', () => {
    const state = fixtureState({ oppSpellTraps: [[0, 'TRAP']] });
    expectEngineError(() => apply(state, activate('os-0', 0)), 'CARD_NOT_IN_HAND');
  });

  it("the opponent's Set trap answers my Normal Spell: flips face-up in place, resolves LIFO", () => {
    const before = fixtureState({ hand: ['DRAW'], oppSpellTraps: [[0, 'TRAP_BURN']] });
    const opened = apply(before, activate('h0'));
    // The opponent can respond, so the window stays open for them.
    expect(opened.state.chainWindow).toEqual({ priorityPlayer: 1, passCount: 0 });
    expect(opened.state.players[1].board.spellTrapZones[0]?.position).toBe('DefenseDown');
    expect(getLegalActions(opened.state, 1, fixtureCtx)).toContainEqual(activate('os-0', 1));

    // Player 0 has nothing left to respond with: both auto-pass and the chain resolves in this call.
    const { state, events } = apply(opened.state, activate('os-0', 1));
    const resolvedOrder = events
      .filter(
        (e): e is Extract<GameEvent, { type: 'EffectResolved' }> => e.type === 'EffectResolved',
      )
      .map((e) => e.definitionId);
    expect(resolvedOrder).toEqual(['TRAP_BURN', 'DRAW']);
    expect(events).toContainEqual({
      type: 'CardSentToGraveyard',
      ownerIndex: 1,
      instanceId: 'os-0',
      definitionId: 'TRAP_BURN',
      from: 'SpellTrapZone',
    });
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints - 300);
    expect(state.players[1].board.spellTrapZones[0]).toBeNull();
    expect(state.players[1].graveyard.map((c) => c.instanceId)).toEqual(['os-0']);
    expect(state.chainWindow).toBeNull();
  });

  it('while its link waits, the activated trap sits face-up in its zone (and cannot be activated again)', () => {
    // Player 0 keeps a Quick-Play in hand, so the window stays open after the trap is chained.
    const opened = apply(
      fixtureState({ hand: ['DRAW', 'QP_HEAL'], oppSpellTraps: [[0, 'TRAP_BURN']] }),
      activate('h0'),
    ).state;
    const chained = apply(opened, activate('os-0', 1)).state;
    expect(chained.chainWindow).toEqual({ priorityPlayer: 0, passCount: 0 });
    expect(chained.chainStack).toHaveLength(2);
    const faceUp = chained.players[1].board.spellTrapZones[0];
    expect(faceUp).toMatchObject({ instanceId: 'os-0', position: 'Attack' });
    expect(chained.chainStack[1]).toMatchObject({
      card: { instanceId: 'os-0', definitionId: 'TRAP_BURN' },
      source: { zone: 'SpellTrapZone', zoneIndex: 0 },
      spellSpeed: 2,
    });
    const theirTurnToAct: GameState = {
      ...chained,
      chainWindow: { priorityPlayer: 1, passCount: 0 },
    };
    expectEngineError(() => apply(theirTurnToAct, activate('os-0', 1)), 'NOT_ACTIVATABLE');
  });

  it('a trap destroyed while on the chain still resolves, and is not sent to the graveyard twice', () => {
    const opened = apply(
      fixtureState({ hand: ['DRAW', 'QP_KILL_ST'], oppSpellTraps: [[0, 'TRAP_BURN']] }),
      activate('h0'),
    ).state;
    const chained = apply(opened, activate('os-0', 1)).state;
    const { state, events } = apply(chained, activate('h1'));
    expect(types(events)).toContain('SpellTrapDestroyed');
    expect(resolvedIds(events)).toEqual(['QP_KILL_ST', 'TRAP_BURN', 'DRAW']);
    expect(
      events.filter((e) => e.type === 'CardSentToGraveyard' && e.instanceId === 'os-0'),
    ).toEqual([]);
    expect(state.players[1].graveyard.map((c) => c.instanceId)).toEqual(['os-0']);
    expect(state.players[0].lifePoints).toBe(opened.players[0].lifePoints - 300);
  });

  it('a Set trap with a Card target opens the target prompt, then flips and resolves', () => {
    const before = fixtureState({
      mySpellTraps: [[0, 'TRAP_KILL_ST']],
      oppSpellTraps: [
        [1, 'TRAP_PLAIN'],
        [2, 'TRAP_PLAIN'],
      ],
    });
    const prompted = apply(before, activate('ms-0')).state;
    expect(prompted.pendingPrompt?.kind).toBe('SelectEffectTarget');
    expect(prompted.players[0].board.spellTrapZones[0]?.position).toBe('DefenseDown');
    const { state } = apply(prompted, {
      type: 'ResolvePendingPrompt',
      payload: {
        playerIndex: 0,
        promptId: prompted.pendingPrompt!.promptId,
        cardInstanceIds: ['os-2'],
      },
    });
    expect(state.players[1].board.spellTrapZones[2]).toBeNull();
    expect(state.players[1].board.spellTrapZones[1]).not.toBeNull();
    expect(state.players[0].board.spellTrapZones[0]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['ms-0']);
  });

  // Task 4.3: a Continuous Trap and a Set Normal Spell left this list (rules/continuous-activation.test.ts,
  // rules/set-spell-activation.test.ts).
  it.each([
    ['a Trap whose effect is not a Quick trigger', 'TRAP_IGNITION'],
    ['a Trap with no effect', 'TRAP_PLAIN'],
  ])('%s is not activatable from the field', (_name, def) => {
    const state = fixtureState({ mySpellTraps: [[0, def]] });
    expectEngineError(
      () => apply(state, activate('ms-0')),
      def === 'TRAP_PLAIN' ? 'EFFECT_NOT_FOUND' : 'NOT_ACTIVATABLE',
    );
  });
});
