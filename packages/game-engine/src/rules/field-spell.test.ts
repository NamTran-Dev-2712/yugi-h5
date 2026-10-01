import { describe, expect, it } from 'vitest';
import { applyAction } from '../apply-action.js';
import type { Action, ActivateEffectAction } from '../actions/types.js';
import { effectiveStats } from '../effects/continuous.js';
import { getLegalActions } from '../legal-actions.js';
import type { GameState } from '../state/types.js';
import { deepFreeze } from '../testing/deep-freeze.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../testing/effect-fixtures.js';

/**
 * Task 4.3 — Field Spell [RULE]: one Field Zone per player. Activated from the hand in your Main Phase, or Set first and
 * activated later (even on the turn it was Set: only Quick-Play Spells and Traps wait a turn). It stays face-up after it
 * resolves and its Continuous effects hold from then on; nothing "removes" them when it leaves (they are re-read).
 * [DECISION] 2026-10-01: each player has their own Field Spell; a new one replaces only your own, which is sent to the
 * graveyard ([ASSUMED] G20: not "destroyed"). `ruleset.fieldSpellReplace: false` ⇒ `FIELD_ZONE_OCCUPIED` instead.
 * A "destroy 1 Spell/Trap" effect can hit a Field Spell [RULE].
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
const pass = (playerIndex: 0 | 1): Action => ({ type: 'PassPriority', payload: { playerIndex } });
const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const types = (events: readonly { type: string }[]) => events.map((e) => e.type);
const atk = (state: GameState, player: 0 | 1, zone = 0) =>
  effectiveStats(state, state.players[player].board.monsterZones[zone]!, fixtureCtx).atk;
const field = (state: GameState, player: 0 | 1 = 0) => state.players[player].board.fieldZone;
const graveIds = (state: GameState, player: 0 | 1 = 0) =>
  state.players[player].graveyard.map((c) => c.instanceId);

/** Both players control a Warrior (M1, 1000 ATK). */
const warriors = (setup: FixtureSetup = {}): GameState =>
  fixtureState({ myMonsters: [[0, 'M1']], oppMonsters: [[0, 'M1']], ...setup });

describe('Field Spell — Set', () => {
  it('goes face-down into the Field Zone (not a Spell/Trap Zone), stamps the turn, leaves the hand', () => {
    const before = fixtureState({ hand: ['FLD_WARRIOR', 'M1'] });
    const { state, events } = apply(before, set('h0'));
    expect(field(state)).toEqual({
      instanceId: 'h0',
      definitionId: 'FLD_WARRIOR',
      ownerIndex: 0,
      position: 'DefenseDown',
      setTurn: before.turnCount,
    });
    expect(state.players[0].board.spellTrapZones.every((c) => c === null)).toBe(true);
    expect(state.players[0].hand.map((c) => c.instanceId)).toEqual(['h1']);
    expect(state.version).toBe(before.version + 1);
    expect(events).toEqual([{ type: 'FieldSpellSet', playerIndex: 0, instanceId: 'h0' }]);
  });

  it('the event never carries a definitionId (the card is face-down)', () => {
    const { events } = apply(fixtureState({ hand: ['FLD_WARRIOR'] }), set('h0'));
    expect(JSON.stringify(events)).not.toContain('FLD_WARRIOR');
  });

  it('the Field Zone has one slot: only zoneIndex 0 is accepted', () => {
    const state = fixtureState({ hand: ['FLD_WARRIOR'] });
    for (const zoneIndex of [1, 2, 3, 4])
      expectEngineError(() => apply(state, set('h0', zoneIndex)), 'INVALID_ZONE');
  });

  it('a full Spell/Trap row does not block it, and a Set Field Spell gives no bonus', () => {
    const state = warriors({
      hand: ['FLD_WARRIOR'],
      mySpellTraps: [0, 1, 2, 3, 4].map((z) => [z, 'TRAP_PLAIN'] as [number, string]),
    });
    const next = apply(state, set('h0')).state;
    expect(field(next)?.position).toBe('DefenseDown');
    expect(atk(next, 0)).toBe(1000);
  });

  it('legalActions offers exactly one Set for a Field Spell in the hand, plus its activation', () => {
    const state = fixtureState({ hand: ['FLD_WARRIOR'] });
    const legal = getLegalActions(state, 0, fixtureCtx);
    expect(legal.filter((a) => a.type === 'SetSpellTrap')).toEqual([set('h0', 0)]);
    expect(legal.filter((a) => a.type === 'ActivateEffect')).toEqual([act('h0')]);
  });
});

describe('Field Spell — activation', () => {
  it('from the hand: lands face-up in the Field Zone, stays after resolving, the bonus applies to both sides at once', () => {
    const before = warriors({ hand: ['FLD_WARRIOR'] });
    const { state, events } = apply(before, act('h0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(field(state)).toEqual({
      instanceId: 'h0',
      definitionId: 'FLD_WARRIOR',
      ownerIndex: 0,
      position: 'Attack',
    });
    expect(state.players[0].hand).toEqual([]);
    expect(graveIds(state)).toEqual([]);
    expect(state.players[0].board.spellTrapZones.every((c) => c === null)).toBe(true);
    expect(state.chainStack).toEqual([]);
    expect(state.version).toBe(before.version + 1);
    expect([atk(state, 0), atk(state, 1)]).toEqual([1500, 1500]);
  });

  it('while its link waits, the card is already face-up in the Field Zone and the link says so', () => {
    const waiting = apply(
      warriors({ hand: ['FLD_WARRIOR'], oppSpellTraps: [[0, 'TRAP']] }),
      act('h0'),
    ).state;
    expect(waiting.chainStack).toHaveLength(1);
    expect(waiting.chainStack[0]).toMatchObject({
      card: { instanceId: 'h0', definitionId: 'FLD_WARRIOR', position: null },
      source: { zone: 'FieldZone' },
      spellSpeed: 1,
    });
    expect(field(waiting)).toMatchObject({ instanceId: 'h0', position: 'Attack' });
    const { state, events } = apply(waiting, pass(1));
    expect(types(events)).toEqual(['EffectResolved', 'ChainResolved']);
    expect(field(state)).toMatchObject({ instanceId: 'h0', position: 'Attack' });
  });

  it('a Set Field Spell is activated from the Field Zone — even on the turn it was Set [RULE]', () => {
    const setNow = apply(warriors({ hand: ['FLD_WARRIOR'] }), set('h0')).state;
    const { state, events } = apply(setNow, act('h0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(field(state)).toMatchObject({ instanceId: 'h0', position: 'Attack' });
    expect(atk(state, 0)).toBe(1500);
    // Set on an earlier turn: the same, in Main Phase 2.
    const later = apply(warriors({ myField: ['FLD_WARRIOR'], phase: 'Main2' }), act('mf')).state;
    expect(field(later)).toMatchObject({ instanceId: 'mf', position: 'Attack' });
    expect(graveIds(later)).toEqual([]);
  });

  it('legalActions lists the activation of a Set Field Spell (Main Phase only)', () => {
    const state = fixtureState({ myField: ['FLD_WARRIOR'] });
    expect(getLegalActions(state, 0, fixtureCtx)).toContainEqual(act('mf'));
    expect(getLegalActions({ ...state, phase: 'Battle' }, 0, fixtureCtx)).not.toContainEqual(
      act('mf'),
    );
  });

  it('only in your own Main Phase: WRONG_PHASE in the Battle Phase, NOT_TURN_PLAYER for the other player', () => {
    for (const setup of [
      { hand: ['FLD_WARRIOR'] },
      { myField: ['FLD_WARRIOR'] },
    ] as FixtureSetup[]) {
      const id = setup.hand ? 'h0' : 'mf';
      expectEngineError(
        () => apply(fixtureState({ ...setup, phase: 'Battle' }), act(id)),
        'WRONG_PHASE',
      );
    }
    const theirs = fixtureState({ oppField: ['FLD_WARRIOR'] });
    expectEngineError(() => apply(theirs, act('of', 'e1', 1)), 'NOT_TURN_PLAYER');
    // Even while they hold priority in a window: a Field Spell is Spell Speed 1 and only the turn player's.
    const window: GameState = {
      ...theirs,
      chainWindow: { priorityPlayer: 1, passCount: 0, reactionTo: { kind: 'Summon' } },
    };
    expectEngineError(() => apply(window, act('of', 'e1', 1)), 'NOT_TURN_PLAYER');
  });

  it('a Set Field Spell of the opponent does not hold a reaction window open', () => {
    const { state } = apply(fixtureState({ hand: ['M1'], oppField: ['FLD_WARRIOR'] }), {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 0 },
    });
    expect(state.chainWindow).toBeNull();
  });

  it('a face-up Field Spell is never activated again; its Continuous effect is never activated at all', () => {
    const faceUp = fixtureState({ myField: ['FLD_WARRIOR', 'Attack'] });
    expectEngineError(() => apply(faceUp, act('mf')), 'NOT_ACTIVATABLE');
    expectEngineError(() => apply(faceUp, act('mf', 'e2')), 'CONTINUOUS_NOT_ACTIVATABLE');
    expectEngineError(
      () => apply(fixtureState({ hand: ['FLD_WARRIOR'] }), act('h0', 'e2')),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
    expect(getLegalActions(faceUp, 0, fixtureCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );
  });

  it('each player has their own Field Spell: both hold, and mine does not touch theirs', () => {
    const before = warriors({ hand: ['FLD_WARRIOR'], oppField: ['FLD_WEAK', 'Attack'] });
    expect(atk(before, 0)).toBe(600);
    const { state } = apply(before, act('h0'));
    expect(field(state, 1)).toMatchObject({ instanceId: 'of', position: 'Attack' });
    expect(graveIds(state, 1)).toEqual([]);
    expect([atk(state, 0), atk(state, 1)]).toEqual([1100, 1500]);
  });
});

describe('Field Spell — replacing your own', () => {
  it('activating a new one from the hand sends the old one to the graveyard; its bonus is gone, the new one holds', () => {
    const before = warriors({ hand: ['FLD_WEAK'], myField: ['FLD_WARRIOR', 'Attack'] });
    expect([atk(before, 0), atk(before, 1)]).toEqual([1500, 1500]);
    const { state, events } = apply(before, act('h0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'CardSentToGraveyard',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(events[1]).toEqual({
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'mf',
      definitionId: 'FLD_WARRIOR',
      from: 'FieldZone',
    });
    expect(field(state)).toMatchObject({ instanceId: 'h0', position: 'Attack' });
    expect(state.players[0].graveyard).toEqual([
      { instanceId: 'mf', definitionId: 'FLD_WARRIOR', ownerIndex: 0, position: null },
    ]);
    expect([atk(state, 0), atk(state, 1)]).toEqual([1000, 600]);
  });

  it('a Set (face-down) old one is replaced too; Setting a new one replaces as well', () => {
    const overSet = apply(
      fixtureState({ hand: ['FLD_WEAK'], myField: ['FLD_WARRIOR'] }),
      act('h0'),
    );
    expect(field(overSet.state)?.instanceId).toBe('h0');
    expect(graveIds(overSet.state)).toEqual(['mf']);

    const { state, events } = apply(
      fixtureState({ hand: ['FLD_WEAK'], myField: ['FLD_WARRIOR', 'Attack'] }),
      set('h0'),
    );
    expect(events).toEqual([
      {
        type: 'CardSentToGraveyard',
        ownerIndex: 0,
        instanceId: 'mf',
        definitionId: 'FLD_WARRIOR',
        from: 'FieldZone',
      },
      { type: 'FieldSpellSet', playerIndex: 0, instanceId: 'h0' },
    ]);
    expect(field(state)).toMatchObject({ instanceId: 'h0', position: 'DefenseDown' });
    expect(graveIds(state)).toEqual(['mf']);
  });

  it('activating the Set card itself replaces nothing', () => {
    const { state, events } = apply(fixtureState({ myField: ['FLD_WARRIOR'] }), act('mf'));
    expect(types(events)).not.toContain('CardSentToGraveyard');
    expect(graveIds(state)).toEqual([]);
  });

  it('ruleset.fieldSpellReplace false: an occupied Field Zone rejects FIELD_ZONE_OCCUPIED (an empty one is fine)', () => {
    const noReplace = (s: GameState): GameState => ({
      ...s,
      ruleset: { ...s.ruleset, fieldSpellReplace: false },
    });
    const occupied = noReplace(
      fixtureState({ hand: ['FLD_WEAK'], myField: ['FLD_WARRIOR', 'Attack'] }),
    );
    expectEngineError(() => apply(occupied, act('h0')), 'FIELD_ZONE_OCCUPIED');
    expectEngineError(() => apply(occupied, set('h0')), 'FIELD_ZONE_OCCUPIED');
    const empty = noReplace(fixtureState({ hand: ['FLD_WEAK'] }));
    expect(field(apply(empty, act('h0')).state)?.instanceId).toBe('h0');
    expect(field(apply(empty, set('h0')).state)?.instanceId).toBe('h0');
    // The Set card in the zone is still activated (it replaces nothing).
    const own = noReplace(fixtureState({ myField: ['FLD_WARRIOR'] }));
    expect(field(apply(own, act('mf')).state)?.position).toBe('Attack');
  });
});

describe('Field Spell — leaving the field', () => {
  it('"destroy 1 Spell/Trap" can target it: FieldSpellDestroyed, owner\'s graveyard, the bonus stops', () => {
    const before = warriors({ hand: ['KILL_ST'], oppField: ['FLD_WARRIOR', 'Attack'] });
    expect(atk(before, 0)).toBe(1500);
    const { state, events } = apply(before, act('h0'));
    expect(events).toContainEqual({
      type: 'FieldSpellDestroyed',
      ownerIndex: 1,
      instanceId: 'of',
      definitionId: 'FLD_WARRIOR',
    });
    expect(types(events)).not.toContain('SpellTrapDestroyed');
    expect(field(state, 1)).toBeNull();
    expect(state.players[1].graveyard).toEqual([
      { instanceId: 'of', definitionId: 'FLD_WARRIOR', ownerIndex: 1, position: null },
    ]);
    expect([atk(state, 0), atk(state, 1)]).toEqual([1000, 1000]);
  });

  it('a face-down Field Spell is a legal target next to the Spell/Trap Zone cards (prompt lists both)', () => {
    const prompted = apply(
      fixtureState({
        hand: ['KILL_ST'],
        oppField: ['FLD_WARRIOR'],
        oppSpellTraps: [[2, 'TRAP_PLAIN']],
      }),
      act('h0'),
    ).state;
    expect(prompted.pendingPrompt?.payload).toMatchObject({ candidateInstanceIds: ['os-2', 'of'] });
  });

  it('a destroyed Field Spell fires its OnDestroyed trigger', () => {
    const before = fixtureState({ hand: ['KILL_ST'], oppField: ['FLD_DES', 'Attack'] });
    const { state, events } = apply(before, act('h0'));
    expect(types(events)).toContain('FieldSpellDestroyed');
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints + 600);
  });

  it('destroyed while its link waits: the link still resolves, the card is not sent again, no bonus ever applies', () => {
    const waiting = apply(
      warriors({ hand: ['FLD_WARRIOR'], oppSpellTraps: [[0, 'QP_KILL_ST']] }),
      act('h0'),
    ).state;
    const { state, events } = apply(waiting, act('os-0', 'e1', 1));
    expect(types(events)).toContain('FieldSpellDestroyed');
    expect(events.filter((e) => e.type === 'EffectResolved').map((e) => e.definitionId)).toEqual([
      'QP_KILL_ST',
      'FLD_WARRIOR',
    ]);
    expect(events.filter((e) => e.type === 'CardSentToGraveyard' && e.instanceId === 'h0')).toEqual(
      [],
    );
    expect(field(state)).toBeNull();
    expect(graveIds(state)).toEqual(['h0']);
    expect([atk(state, 0), atk(state, 1)]).toEqual([1000, 1000]);
  });
});
