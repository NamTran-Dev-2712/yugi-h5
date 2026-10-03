import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import type { Action, ActivateEffectAction } from '../../actions/types.js';
import type { GameState } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../../testing/effect-fixtures.js';

/*
 * Task 4.4 — operation `NegateSummon` (ADR 065). Owner decision 2026-10-02: Normal Summon (Tribute Summon included) and
 * Flip Summon only [RULE] — a Set is not a Summon, and a Special Summon made by a resolving effect is stopped by
 * negating that effect's activation instead. It is activated in the Summon reaction window (task 3.4c), as the FIRST
 * link [ASSUMED]; the window remembers which monster was Summoned (`chainWindow.summoned`).
 * Convention [ASSUMED] G23: the monster is SENT to its owner's graveyard (`SummonNegated`), not "destroyed" — no
 * `MonsterDestroyed`, no OnDestroyed trigger; the Normal Summon of the turn and the Tributes stay spent.
 * Fixture: player 0 Summons on turn 3; player 1 holds the Set cards `os-<zone>`.
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
const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const types = (events: readonly { type: string }[]) => events.map((e) => e.type);
const main = (setup: FixtureSetup): GameState => ({ ...fixtureState(setup), turnCount: 3 });
const graveIds = (state: GameState, player: 0 | 1 = 0) =>
  state.players[player].graveyard.map((c) => c.instanceId);

describe('NegateSummon — Normal Summon', () => {
  it('the window names the Summoned monster; negated: the monster goes to the graveyard', () => {
    const before = main({ hand: ['M1'], oppSpellTraps: [[0, 'NEG_SUM']] });
    const opened = apply(before, summon());
    expect(types(opened.events)).toEqual(['NormalSummoned']);
    expect(opened.state.chainWindow).toEqual({
      priorityPlayer: 1,
      passCount: 0,
      reactionTo: { kind: 'Summon' },
      summoned: { playerIndex: 0, instanceId: 'h0' },
      // Task 4.4c: the Summon event still owed its triggers (collected once the window closes un-negated).
      summonEvent: {
        type: 'NormalSummoned',
        playerIndex: 0,
        instanceId: 'h0',
        definitionId: 'M1',
        zoneIndex: 3,
      },
    });

    const { state, events } = apply(opened.state, act('os-0'));
    expect(events).toEqual([
      {
        type: 'EffectActivated',
        playerIndex: 1,
        instanceId: 'os-0',
        definitionId: 'NEG_SUM',
        effectId: 'e1',
      },
      expect.objectContaining({ type: 'ChainLinkAdded', spellSpeed: 3, chainIndex: 1 }),
      { type: 'SummonNegated', playerIndex: 0, instanceId: 'h0', definitionId: 'M1', zoneIndex: 3 },
      expect.objectContaining({ type: 'EffectResolved', instanceId: 'os-0' }),
      expect.objectContaining({ type: 'CardSentToGraveyard', instanceId: 'os-0' }),
      { type: 'ChainResolved', linkCount: 1 },
    ]);
    expect(state.players[0].board.monsterZones.every((c) => c === null)).toBe(true);
    expect(state.players[0].graveyard).toEqual([
      { instanceId: 'h0', definitionId: 'M1', ownerIndex: 0, position: null },
    ]);
    expect(state.chainWindow).toBeNull();
    expect(state.version).toBe(opened.state.version + 1);
  });

  it('the Normal Summon of the turn stays used', () => {
    const before = main({ hand: ['M1', 'M1'], oppSpellTraps: [[0, 'NEG_SUM']] });
    const after = apply(apply(before, summon()).state, act('os-0')).state;
    expect(after.players[0].hasNormalSummonedThisTurn).toBe(true);
    expectEngineError(
      () =>
        apply(after, {
          type: 'NormalSummon',
          payload: { playerIndex: 0, cardInstanceId: 'h1', zoneIndex: 0 },
        }),
      'NORMAL_SUMMON_USED',
    );
  });

  it('a Tribute Summon: the Tribute stays in the graveyard, the Summoned monster joins it', () => {
    const before = main({
      hand: ['BIG_L5'],
      myMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'NEG_SUM']],
    });
    const opened = apply(before, summon({ tributeInstanceIds: ['m0-0'] })).state;
    expect(opened.chainWindow?.summoned).toEqual({ playerIndex: 0, instanceId: 'h0' });
    const { state } = apply(opened, act('os-0'));
    expect(graveIds(state)).toEqual(['m0-0', 'h0']);
    expect(state.players[0].board.monsterZones.every((c) => c === null)).toBe(true);
  });

  it('the holder may pass: the monster stays', () => {
    const before = main({ hand: ['M1'], oppSpellTraps: [[0, 'NEG_SUM']] });
    const { state, events } = apply(apply(before, summon()).state, pass(1));
    expect(events).toEqual([]);
    expect(state.players[0].board.monsterZones[3]?.instanceId).toBe('h0');
    expect(state.chainWindow).toBeNull();
  });

  it('"sent", not "destroyed": no MonsterDestroyed, an OnDestroyed effect does not fire', () => {
    const before = main({ hand: ['DES_BURN'], oppSpellTraps: [[0, 'NEG_SUM']] });
    const { state, events } = apply(apply(before, summon()).state, act('os-0'));
    expect(types(events)).toContain('SummonNegated');
    expect(types(events)).not.toContain('MonsterDestroyed');
    expect(types(events)).not.toContain('DamageDealt');
    expect(state.chainStack).toEqual([]);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
  });
});

describe('NegateSummon — what counts as a Summon', () => {
  it('a Set is not a Summon: NEG_SUM alone opens no window; with another Set card it is still refused', () => {
    const alone = apply(
      main({ hand: ['M1'], oppSpellTraps: [[0, 'NEG_SUM']] }),
      summon({}, 'SetMonster'),
    ).state;
    expect(alone.chainWindow).toBeNull();

    const opened = apply(
      main({
        hand: ['M1'],
        oppSpellTraps: [
          [0, 'NEG_SUM'],
          [1, 'TRAP_BURN'],
        ],
      }),
      summon({}, 'SetMonster'),
    ).state;
    expect(opened.chainWindow).toEqual({
      priorityPlayer: 1,
      passCount: 0,
      reactionTo: { kind: 'Summon' },
    });
    expectEngineError(() => apply(opened, act('os-0')), 'NOTHING_TO_NEGATE');
  });

  it('a Flip Summon is negated the same way', () => {
    const before = main({
      myMonsters: [[2, 'M1', 'DefenseDown']],
      oppSpellTraps: [[0, 'NEG_SUM']],
    });
    const opened = apply(before, flip('m0-2'));
    expect(types(opened.events)).toEqual(['FlipSummoned']);
    expect(opened.state.chainWindow?.summoned).toEqual({ playerIndex: 0, instanceId: 'm0-2' });
    const { state, events } = apply(opened.state, act('os-0'));
    expect(events).toContainEqual({
      type: 'SummonNegated',
      playerIndex: 0,
      instanceId: 'm0-2',
      definitionId: 'M1',
      zoneIndex: 2,
    });
    expect(state.players[0].board.monsterZones[2]).toBeNull();
    expect(graveIds(state)).toEqual(['m0-2']);
  });

  it('a monster with an optional OnSummon trigger: the window comes before the prompt (task 4.4c) and names the monster', () => {
    const before = main({ hand: ['SUM_HEAL'], oppSpellTraps: [[0, 'NEG_SUM']] });
    const opened = apply(before, summon()).state;
    expect(opened.pendingPrompt).toBeNull();
    expect(opened.chainWindow?.summoned).toEqual({ playerIndex: 0, instanceId: 'h0' });
    const { state } = apply(opened, act('os-0'));
    expect(graveIds(state)).toEqual(['h0']);
    expect(state.pendingPrompt).toBeNull();
  });

  it('task 4.4c: a monster with a mandatory OnSummon trigger is negated too — the trigger never happens', () => {
    const before = main({ hand: ['SUM_BURN'], oppSpellTraps: [[0, 'NEG_SUM']] });
    const opened = apply(before, summon());
    expect(types(opened.events)).toEqual(['NormalSummoned']);
    const { state, events } = apply(opened.state, act('os-0'));
    expect(types(events)).toContain('SummonNegated');
    expect(types(events)).not.toContain('DamageDealt');
    expect(state.chainWindow).toBeNull();
    expect(graveIds(state)).toEqual(['h0']);
  });

  it('it must answer the Summon directly (first link): after another card it is refused', () => {
    const before = main({
      hand: ['M1'],
      mySpellTraps: [[0, 'TRAP']],
      oppSpellTraps: [
        [0, 'NEG_SUM'],
        [1, 'TRAP_BURN'],
        [2, 'TRAP'], // keeps the window open for player 1 after player 0 passes
      ],
    });
    const opened = apply(before, summon()).state;
    const link1 = apply(opened, act('os-1')).state;
    const back = apply(link1, pass(0)).state;
    expect(back.chainWindow).toMatchObject({ priorityPlayer: 1, passCount: 1 });
    expectEngineError(() => apply(back, act('os-0')), 'NOTHING_TO_NEGATE');
  });

  it('a Counter Trap answers it: the negation is negated and the monster stays', () => {
    const before = main({
      hand: ['M1'],
      mySpellTraps: [[0, 'NEG_ANY']],
      oppSpellTraps: [[0, 'NEG_SUM']],
    });
    const link1 = apply(apply(before, summon()).state, act('os-0')).state;
    expect(link1.chainWindow?.priorityPlayer).toBe(0);
    const { state, events } = apply(link1, act('ms-0', 0));
    expect(types(events)).toContain('ChainLinkNegated');
    expect(types(events)).not.toContain('SummonNegated');
    expect(state.players[0].board.monsterZones[3]?.instanceId).toBe('h0');
    expect(graveIds(state, 1)).toEqual(['os-0']);
  });
});
