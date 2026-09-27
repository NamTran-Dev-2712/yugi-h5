import { describe, expect, it } from 'vitest';
import { applyAction } from '../apply-action.js';
import type { Action, ActivateEffectAction, PassPriorityAction } from '../actions/types.js';
import type { GameEvent } from '../events/types.js';
import type { GameState } from '../state/types.js';
import { deepFreeze } from '../testing/deep-freeze.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../testing/effect-fixtures.js';

/*
 * Task 3.3 — chain stack. [RULE]: every activation becomes a chain link (cost + target at activation), the opponent
 * of the activator gets priority first, two consecutive passes resolve the WHOLE chain LIFO, then the window closes.
 * [ASSUMED]: a player with no legal activation passes automatically, so a window only stays open for a player who
 * can respond. Multi-link chains use test-only Quick-Play Spells (Speed 2) from `effect-fixtures.ts`.
 */

const activate = (
  cardInstanceId: string,
  extra: Partial<ActivateEffectAction['payload']> = {},
  playerIndex: 0 | 1 = 0,
): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId: 'e1', ...extra },
});

const pass = (playerIndex: 0 | 1): PassPriorityAction => ({
  type: 'PassPriority',
  payload: { playerIndex },
});

const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);

/** Applies actions in order, collecting every event. */
function play(setup: FixtureSetup | GameState, actions: Action[]) {
  let state = 'players' in setup ? setup : fixtureState(setup);
  const perStep: GameEvent[][] = [];
  for (const action of actions) {
    const out = apply(state, action);
    state = out.state;
    perStep.push(out.events);
  }
  return { state, perStep, events: perStep.flat() };
}

const types = (events: readonly { type: string }[]) => events.map((e) => e.type);

/** Types of the events tied to a card (resolution markers) — keeps LIFO assertions readable. */
const resolved = (events: readonly GameEvent[]) =>
  events
    .filter(
      (e): e is Extract<GameEvent, { type: 'EffectResolved' | 'ChainLinkFizzled' }> =>
        e.type === 'EffectResolved' || e.type === 'ChainLinkFizzled',
    )
    .map((e) => `${e.type}:${e.definitionId}`);

describe('Chain — single link, nobody can respond', () => {
  it('resolves in the same call and leaves no chain behind', () => {
    const before = fixtureState({ hand: ['DRAW', 'M1'] });
    const { state, events } = apply(before, activate('h0'));
    expect(state.chainStack).toEqual([]);
    expect(state.chainWindow).toBeNull();
    expect(state.version).toBe(before.version + 1);
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'CardDrawn',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events[1]).toEqual({
      type: 'ChainLinkAdded',
      linkId: `link-${before.turnCount}-${before.version}`,
      chainIndex: 1,
      playerIndex: 0,
      instanceId: 'h0',
      definitionId: 'DRAW',
      effectId: 'e1',
      spellSpeed: 1,
      targetInstanceIds: [],
    });
    expect(events.at(-1)).toEqual({ type: 'ChainResolved', linkCount: 1 });
  });

  it('a Quick-Play can start a chain on its own (Speed 2 on an empty chain)', () => {
    const { state, events } = apply(
      fixtureState({ hand: ['QP_HEAL'], myLp: 1000 }),
      activate('h0'),
    );
    expect(state.players[0].lifePoints).toBe(1300);
    expect(events.find((e) => e.type === 'ChainLinkAdded')).toMatchObject({ spellSpeed: 2 });
    expect(state.chainWindow).toBeNull();
  });
});

describe('Chain — response window', () => {
  it('stays open for the activator when they can still respond (opponent auto-passed)', () => {
    const before = fixtureState({ hand: ['DRAW', 'QP_HEAL'] });
    const { state, events } = apply(before, activate('h0'));
    expect(types(events)).toEqual(['EffectActivated', 'ChainLinkAdded']);
    expect(state.chainWindow).toEqual({ priorityPlayer: 0, passCount: 1 });
    expect(state.chainStack).toHaveLength(1);
    expect(state.chainStack[0]).toMatchObject({
      playerIndex: 0,
      effectId: 'e1',
      spellSpeed: 1,
      card: { instanceId: 'h0', definitionId: 'DRAW', ownerIndex: 0, position: null },
      targetInstanceIds: [],
    });
    // The Spell left the hand and is not in the graveyard yet: it lives in its chain link.
    expect(state.players[0].hand.map((c) => c.instanceId)).toEqual(['h1']);
    expect(state.players[0].graveyard).toEqual([]);
    // Operations have not run.
    expect(state.players[0].deck).toEqual(before.players[0].deck);
    expect(state.version).toBe(before.version + 1);
  });

  it('pass by the holder after the auto-pass = two consecutive passes → the chain resolves', () => {
    const opened = apply(fixtureState({ hand: ['DRAW', 'QP_HEAL'] }), activate('h0')).state;
    const { state, events } = apply(opened, pass(0));
    expect(types(events)).toEqual([
      'CardDrawn',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(state.chainStack).toEqual([]);
    expect(state.chainWindow).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h0']);
    expect(state.players[0].hand.map((c) => c.instanceId)).toContain('h1');
    expect(state.version).toBe(opened.version + 1);
  });

  it('2 links: Normal Spell then Quick-Play resolve LIFO', () => {
    const { state, events, perStep } = play({ hand: ['BURN', 'QP_HEAL'], myLp: 1000 }, [
      activate('h0'),
      activate('h1'),
    ]);
    expect(types(perStep[1]!)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'LifePointsRecovered',
      'EffectResolved',
      'CardSentToGraveyard',
      'DamageDealt',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(resolved(events)).toEqual(['EffectResolved:QP_HEAL', 'EffectResolved:BURN']);
    expect(events.filter((e) => e.type === 'ChainLinkAdded')).toMatchObject([
      { chainIndex: 1, definitionId: 'BURN', spellSpeed: 1 },
      { chainIndex: 2, definitionId: 'QP_HEAL', spellSpeed: 2 },
    ]);
    expect(events.at(-1)).toEqual({ type: 'ChainResolved', linkCount: 2 });
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h1', 'h0']);
    expect(state.players[0].lifePoints).toBe(1300);
    expect(state.players[1].lifePoints).toBe(fixtureState().players[1].lifePoints - 500);
    expect(state.chainWindow).toBeNull();
  });

  it('3 links resolve LIFO; the window stays open while the holder has another response', () => {
    const { state, events, perStep } = play({ hand: ['DRAW', 'QP_HEAL', 'QP_BURN'] }, [
      activate('h0'),
      activate('h1'),
      activate('h2'),
    ]);
    expect(perStep[1]!.map((e) => e.type)).toEqual(['EffectActivated', 'ChainLinkAdded']);
    expect(resolved(events)).toEqual([
      'EffectResolved:QP_BURN',
      'EffectResolved:QP_HEAL',
      'EffectResolved:DRAW',
    ]);
    expect(events.at(-1)).toEqual({ type: 'ChainResolved', linkCount: 3 });
    expect(state.chainStack).toEqual([]);
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h2', 'h1', 'h0']);
  });

  it('after a new link the opponent gets priority first; their pass hands it back', () => {
    const opened = apply(fixtureState({ hand: ['DRAW', 'QP_HEAL'] }), activate('h0')).state;
    // Hand-crafted: the opponent holds priority right after the link (as if they could respond).
    const oppHolds: GameState = { ...opened, chainWindow: { priorityPlayer: 1, passCount: 0 } };
    const afterOpp = apply(oppHolds, pass(1));
    expect(afterOpp.events).toEqual([]);
    expect(afterOpp.state.chainWindow).toEqual({ priorityPlayer: 0, passCount: 1 });
    expect(afterOpp.state.chainStack).toHaveLength(1);
    const done = apply(afterOpp.state, pass(0));
    expect(done.state.chainStack).toEqual([]);
    expect(types(done.events).at(-1)).toBe('ChainResolved');
  });

  it('after a manual pass, a new holder who cannot respond auto-passes (chain resolves in that call)', () => {
    const opened = apply(fixtureState({ hand: ['DRAW', 'QP_HEAL'] }), activate('h0')).state;
    // Hand-crafted: player 0 holds priority with no pass yet (as after a link by player 1).
    const firstPass: GameState = { ...opened, chainWindow: { priorityPlayer: 0, passCount: 0 } };
    const { state, events } = apply(firstPass, pass(0));
    // Player 1 has nothing to respond with → auto-pass = second consecutive pass → resolve.
    expect(state.chainWindow).toBeNull();
    expect(state.chainStack).toEqual([]);
    expect(types(events).at(-1)).toBe('ChainResolved');
  });

  it('a pass after an activation does not count the older pass (consecutive passes only)', () => {
    // P0 holds with passCount 1; activating a link resets the count.
    const opened = apply(
      fixtureState({ hand: ['DRAW', 'QP_HEAL', 'QP_BURN'] }),
      activate('h0'),
    ).state;
    const second = apply(opened, activate('h1')).state;
    expect(second.chainWindow).toEqual({ priorityPlayer: 0, passCount: 1 });
    expect(second.chainStack).toHaveLength(2);
  });

  it('a target prompt can open while the window is open; answering adds the link', () => {
    const opened = apply(
      fixtureState({
        hand: ['HEAL', 'QP_KILL'],
        oppMonsters: [
          [0, 'M1'],
          [2, 'M1'],
        ],
      }),
      activate('h0'),
    ).state;
    const prompted = apply(opened, activate('h1'));
    expect(prompted.events).toEqual([]);
    expect(prompted.state.pendingPrompt?.kind).toBe('SelectEffectTarget');
    expect(prompted.state.chainStack).toHaveLength(1);
    expectEngineError(() => apply(prompted.state, pass(0)), 'PENDING_PROMPT');
    const answered = apply(prompted.state, {
      type: 'ResolvePendingPrompt',
      payload: {
        playerIndex: 0,
        promptId: prompted.state.pendingPrompt!.promptId,
        cardInstanceIds: ['o0-2'],
      },
    });
    expect(answered.state.pendingPrompt).toBeNull();
    expect(resolved(answered.events)).toEqual(['EffectResolved:QP_KILL', 'EffectResolved:HEAL']);
    expect(answered.state.players[1].board.monsterZones[2]).toBeNull();
    expect(answered.state.players[1].board.monsterZones[0]).not.toBeNull();
  });
});

describe('Chain — cost and targets are fixed at activation', () => {
  it('cost is paid when the link is added, before anything resolves', () => {
    const before = fixtureState({ hand: ['DISCARD_DRAW', 'QP_HEAL', 'M1'] });
    const { state, events } = apply(before, activate('h0', { costInstanceIds: ['h2'] }));
    expect(types(events)).toEqual(['EffectActivated', 'CardDiscarded', 'ChainLinkAdded']);
    expect(state.chainWindow).not.toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h2']);
    expect(state.players[0].deck).toEqual(before.players[0].deck);
    expect(state.chainStack[0]).toMatchObject({ costInstanceIds: ['h2'], lpPaid: 0 });
  });

  it('PayLP is paid at activation and recorded on the link', () => {
    const { state, events } = apply(
      fixtureState({ hand: ['DRAW', 'QP_PAY', 'QP_HEAL'], myLp: 2000 }),
      activate('h0'),
    );
    expect(types(events)).toEqual(['EffectActivated', 'ChainLinkAdded']);
    const second = apply(state, activate('h1'));
    expect(types(second.events)).toEqual(['EffectActivated', 'LifePointsPaid', 'ChainLinkAdded']);
    expect(second.state.players[0].lifePoints).toBe(1600);
    expect(second.state.chainStack[1]).toMatchObject({ lpPaid: 400, costInstanceIds: [] });
  });

  it('targets are chosen at activation and recorded on the link', () => {
    const { events, state } = apply(
      fixtureState({ hand: ['KILL', 'QP_HEAL'], oppMonsters: [[1, 'M1']] }),
      activate('h0'),
    );
    expect(events.find((e) => e.type === 'ChainLinkAdded')).toMatchObject({
      targetInstanceIds: ['o0-1'],
    });
    expect(state.chainStack[0]).toMatchObject({ targetInstanceIds: ['o0-1'] });
    // Not destroyed yet.
    expect(state.players[1].board.monsterZones[1]).not.toBeNull();
  });

  it('a link whose only target is gone at resolution has no effect (ChainLinkFizzled, no throw)', () => {
    const { state, events } = play({ hand: ['KILL', 'QP_KILL'], oppMonsters: [[1, 'M1']] }, [
      activate('h0'),
      activate('h1'),
    ]);
    expect(resolved(events)).toEqual(['EffectResolved:QP_KILL', 'ChainLinkFizzled:KILL']);
    const fizzled = events.find((e) => e.type === 'ChainLinkFizzled');
    expect(fizzled).toMatchObject({
      playerIndex: 0,
      instanceId: 'h0',
      definitionId: 'KILL',
      effectId: 'e1',
      reason: 'TARGET_GONE',
    });
    expect(events.filter((e) => e.type === 'MonsterDestroyed')).toHaveLength(1);
    // The fizzled Spell still goes to the graveyard.
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h1', 'h0']);
    expect(types(events).at(-1)).toBe('ChainResolved');
  });

  it('a link that keeps some of its targets applies to the remaining ones', () => {
    const opened = play(
      {
        hand: ['KILL2', 'QP_KILL'],
        oppMonsters: [
          [1, 'M1'],
          [3, 'M1'],
        ],
      },
      [activate('h0'), activate('h1')],
    ).state;
    expect(opened.pendingPrompt?.kind).toBe('SelectEffectTarget');
    const { state, events } = apply(opened, {
      type: 'ResolvePendingPrompt',
      payload: {
        playerIndex: 0,
        promptId: opened.pendingPrompt!.promptId,
        cardInstanceIds: ['o0-1'],
      },
    });
    expect(resolved(events)).toEqual(['EffectResolved:QP_KILL', 'EffectResolved:KILL2']);
    expect(
      events
        .filter((e) => e.type === 'MonsterDestroyed')
        .map((e) => 'instanceId' in e && e.instanceId),
    ).toEqual(['o0-1', 'o0-3']);
    expect(state.players[1].board.monsterZones.every((c) => c === null)).toBe(true);
  });
});

describe('Chain — duel ends mid-chain', () => {
  it('stops resolving, sends the unresolved Spells to the graveyard, DuelEnded is last', () => {
    const { state, events } = play({ hand: ['BURN', 'QP_BURN'], oppLp: 200 }, [
      activate('h0'),
      activate('h1'),
    ]);
    expect(state.winnerIndex).toBe(0);
    expect(resolved(events)).toEqual(['EffectResolved:QP_BURN']);
    expect(events.filter((e) => e.type === 'DamageDealt')).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: 'DuelEnded', winnerIndex: 0, reason: 'LP_ZERO' });
    expect(types(events)).not.toContain('ChainResolved');
    expect(state.chainStack).toEqual([]);
    expect(state.chainWindow).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId).sort()).toEqual(['h0', 'h1']);
    const toGy = events.filter((e) => e.type === 'CardSentToGraveyard');
    expect(toGy.map((e) => 'instanceId' in e && e.instanceId)).toEqual(['h1', 'h0']);
  });
});

describe('PassPriority — guards', () => {
  const openWindow = () => apply(fixtureState({ hand: ['DRAW', 'QP_HEAL'] }), activate('h0')).state;

  it('rejects when no window is open', () => {
    expectEngineError(() => apply(fixtureState({ hand: ['DRAW'] }), pass(0)), 'NO_CHAIN_WINDOW');
  });

  it('rejects the player who does not hold priority', () => {
    expectEngineError(() => apply(openWindow(), pass(1)), 'NOT_PRIORITY_HOLDER');
  });

  it('rejects after the duel ended (DUEL_ENDED first)', () => {
    const ended: GameState = { ...openWindow(), winnerIndex: 1 };
    expectEngineError(() => apply(ended, pass(0)), 'DUEL_ENDED');
    expectEngineError(() => apply({ ...fixtureState(), winnerIndex: 1 }, pass(0)), 'DUEL_ENDED');
  });

  it('rejects an activation by the player without priority', () => {
    const opened = openWindow();
    const oppHolds: GameState = { ...opened, chainWindow: { priorityPlayer: 1, passCount: 0 } };
    expectEngineError(() => apply(oppHolds, activate('h1')), 'NOT_PRIORITY_HOLDER');
  });

  it('a Speed 1 Normal Spell cannot be chained', () => {
    const opened = apply(fixtureState({ hand: ['DRAW', 'QP_HEAL', 'HEAL'] }), activate('h0')).state;
    expectEngineError(() => apply(opened, activate('h2')), 'SPELL_SPEED_TOO_LOW');
  });

  it('a Quick-Play whose effect is not a Quick trigger is not activatable', () => {
    expectEngineError(
      () => apply(fixtureState({ hand: ['QP_IGNITION'] }), activate('h0')),
      'NOT_ACTIVATABLE',
    );
  });

  it('Quick-Play from the hand is only for the turn player', () => {
    const s = fixtureState({ hand: ['QP_HEAL'] });
    const oppHasQp: GameState = {
      ...s,
      players: [
        s.players[0],
        { ...s.players[1], hand: [{ ...s.players[0].hand[0]!, instanceId: 'x0', ownerIndex: 1 }] },
      ],
    };
    expectEngineError(() => apply(oppHasQp, activate('x0', {}, 1)), 'NOT_TURN_PLAYER');
  });
});

describe('Chain window blocks other actions', () => {
  const opened = () =>
    apply(
      fixtureState({ hand: ['DRAW', 'QP_HEAL', 'M1'], myMonsters: [[0, 'M1']] }),
      activate('h0'),
    ).state;

  it.each<[string, Action]>([
    ['EndPhase', { type: 'EndPhase', payload: { playerIndex: 0 } }],
    ['Draw', { type: 'Draw', payload: { playerIndex: 0, count: 1 } }],
    [
      'DeclareAttack',
      { type: 'DeclareAttack', payload: { playerIndex: 0, attackerInstanceId: 'm0-0' } },
    ],
    [
      'NormalSummon',
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'h2', zoneIndex: 1 } },
    ],
    [
      'SetMonster',
      { type: 'SetMonster', payload: { playerIndex: 0, cardInstanceId: 'h2', zoneIndex: 1 } },
    ],
    [
      'ChangePosition',
      {
        type: 'ChangePosition',
        payload: { playerIndex: 0, cardInstanceId: 'm0-0', toPosition: 'DefenseUp' },
      },
    ],
    [
      'SetSpellTrap',
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'h1', zoneIndex: 0 } },
    ],
  ])('%s → CHAIN_WINDOW_OPEN', (_name, action) => {
    expectEngineError(() => apply(opened(), action), 'CHAIN_WINDOW_OPEN');
  });

  it('Surrender is still legal with a window open (ADR 1.9)', () => {
    const { state, events } = apply(opened(), { type: 'Surrender', payload: { playerIndex: 1 } });
    expect(state.winnerIndex).toBe(0);
    expect(events).toEqual([{ type: 'DuelEnded', winnerIndex: 0, reason: 'SURRENDER' }]);
  });
});

describe('Chain — determinism', () => {
  it('replaying the same actions gives the same state and events (JSON round-trip safe)', () => {
    const actions: Action[] = [activate('h0'), activate('h1'), pass(0)];
    const setup = { hand: ['DRAW', 'QP_HEAL', 'QP_BURN'] };
    const a = play(setup, actions);
    const b = play(setup, actions);
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
    expect(JSON.parse(JSON.stringify(a.state))).toEqual(a.state);
  });
});
