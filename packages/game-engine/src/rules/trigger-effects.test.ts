import { describe, expect, it } from 'vitest';
import { applyAction } from '../apply-action.js';
import type { Action, ActivateEffectAction } from '../actions/types.js';
import { getLegalActions } from '../legal-actions.js';
import type { GameState } from '../state/types.js';
import { deepFreeze } from '../testing/deep-freeze.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../testing/effect-fixtures.js';

/*
 * Task 3.5 — trigger effects OnSummon / OnDestroyed (optional / mandatory), put on the chain through the 3.3 chain.
 * - [RULE] OnSummon fires on a Normal Summon (Tribute Summon included), NOT on a Set (owner-approved 2026-09-27).
 * - [RULE] mandatory = activates by itself; optional = the owner is asked (`TriggerActivation` prompt).
 * - [RULE] simultaneous triggers: turn player's first, then the opponent's; [ASSUMED] G15 same player: event order.
 * - A trigger whose condition/cost/target cannot be met does not activate.
 * Fixture: player 0 is the turn player; `main`/`battle` bump turnCount to 3 so attacks are allowed.
 */

const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const types = (events: readonly { type: string }[]) => events.map((e) => e.type);
const main = (setup: FixtureSetup, phase: 'Main1' | 'Main2' = 'Main1'): GameState => ({
  ...fixtureState({ phase, ...setup }),
  turnCount: 3,
});
const battle = (setup: FixtureSetup): GameState => ({
  ...fixtureState({ phase: 'Battle', ...setup }),
  turnCount: 3,
});
const summon = (cardInstanceId: string, zoneIndex = 0, tributeInstanceIds?: string[]): Action => ({
  type: 'NormalSummon',
  payload: {
    playerIndex: 0,
    cardInstanceId,
    zoneIndex,
    ...(tributeInstanceIds ? { tributeInstanceIds } : {}),
  },
});
const setMonster = (cardInstanceId: string, zoneIndex = 0): Action => ({
  type: 'SetMonster',
  payload: { playerIndex: 0, cardInstanceId, zoneIndex },
});
const attack = (attackerInstanceId: string, targetInstanceId?: string): Action => ({
  type: 'DeclareAttack',
  payload: {
    playerIndex: 0,
    attackerInstanceId,
    ...(targetInstanceId ? { targetInstanceId } : {}),
  },
});
const activate = (
  cardInstanceId: string,
  playerIndex: 0 | 1 = 0,
  effectId = 'e1',
): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId },
});
const pass = (playerIndex: 0 | 1): Action => ({ type: 'PassPriority', payload: { playerIndex } });
const answer = (
  state: GameState,
  cardInstanceIds: string[] = [],
  extra: { decline?: boolean; playerIndex?: 0 | 1; promptId?: string } = {},
): Action => ({
  type: 'ResolvePendingPrompt',
  payload: {
    playerIndex: extra.playerIndex ?? state.pendingPrompt!.playerIndex,
    promptId: extra.promptId ?? state.pendingPrompt!.promptId,
    cardInstanceIds,
    ...(extra.decline !== undefined ? { decline: extra.decline } : {}),
  },
});

describe('OnSummon — mandatory', () => {
  it('goes on the chain by itself and resolves (nobody can respond); the monster stays on the field', () => {
    const before = main({ hand: ['SUM_DRAW'] });
    const { state, events } = apply(before, summon('h0'));
    expect(types(events)).toEqual([
      'NormalSummoned',
      'EffectActivated',
      'ChainLinkAdded',
      'CardDrawn',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(events[1]).toEqual({
      type: 'EffectActivated',
      playerIndex: 0,
      instanceId: 'h0',
      definitionId: 'SUM_DRAW',
      effectId: 'e1',
    });
    expect(events[2]).toMatchObject({ chainIndex: 1, playerIndex: 0, spellSpeed: 1 });
    expect(state.players[0].board.monsterZones[0]).toMatchObject({
      instanceId: 'h0',
      position: 'Attack',
    });
    expect(state.players[0].hand).toHaveLength(1);
    expect(state.players[0].graveyard).toEqual([]);
    expect(state.chainStack).toEqual([]);
    expect(state.chainWindow).toBeNull();
    expect(state.pendingPrompt).toBeNull();
    expect(state.version).toBe(before.version + 1);
  });

  it('the opponent may respond to the trigger link (a Set Trap), then the chain resolves LIFO', () => {
    const before = main({ hand: ['SUM_DRAW'], oppSpellTraps: [[0, 'TRAP_BURN']] });
    // Task 4.4c: the Summon reaction window comes first; the trigger goes on the chain once the opponent let it close.
    const summoned = apply(before, summon('h0'));
    expect(types(summoned.events)).toEqual(['NormalSummoned']);
    expect(summoned.state.chainStack).toEqual([]);
    expect(summoned.state.chainWindow).toMatchObject({ reactionTo: { kind: 'Summon' } });
    const opened = apply(summoned.state, pass(1));
    expect(types(opened.events)).toEqual(['EffectActivated', 'ChainLinkAdded']);
    expect(opened.state.chainStack).toHaveLength(1);
    expect(opened.state.chainStack[0]!.source).toEqual({ zone: 'MonsterZone', zoneIndex: 0 });
    // A chain window (not an empty reaction window): the opponent holds priority.
    expect(opened.state.chainWindow).toEqual({ priorityPlayer: 1, passCount: 0 });

    const { state, events } = apply(opened.state, activate('os-0', 1));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'CardSentToGraveyard',
      'CardDrawn',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints - 300);
    expect(state.players[0].board.monsterZones[0]?.instanceId).toBe('h0');
    expect(state.chainWindow).toBeNull();
  });

  it('a Tribute Summon fires it too', () => {
    const before = main({ hand: ['SUM_DRAW_L5'], myMonsters: [[0, 'M1']] });
    const { events } = apply(before, summon('h0', 0, ['m0-0']));
    expect(types(events)).toEqual([
      'MonsterTributed',
      'NormalSummoned',
      'EffectActivated',
      'ChainLinkAdded',
      'CardDrawn',
      'EffectResolved',
      'ChainResolved',
    ]);
  });

  it('a Set is not a Summon: no trigger, nothing revealed', () => {
    const before = main({ hand: ['SUM_DRAW'] });
    const { state, events } = apply(before, setMonster('h0'));
    expect(types(events)).toEqual(['MonsterSet']);
    expect(state.players[0].hand).toHaveLength(0);
    expect(state.chainWindow).toBeNull();
    expect(state.pendingPrompt).toBeNull();
  });

  it('with exactly `count` target candidates it targets them by itself (destroy)', () => {
    const before = main({ hand: ['SUM_KILL'], oppMonsters: [[2, 'M1']] });
    const { state, events } = apply(before, summon('h0'));
    expect(types(events)).toEqual([
      'NormalSummoned',
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterDestroyed',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(events[2]).toMatchObject({ targetInstanceIds: ['o0-2'] });
    expect(state.players[1].board.monsterZones[2]).toBeNull();
  });

  it('with more candidates than `count` it asks for the target (no decline for a mandatory trigger)', () => {
    const before = main({
      hand: ['SUM_KILL'],
      oppMonsters: [
        [1, 'M1'],
        [3, 'M2'],
      ],
    });
    const { state, events } = apply(before, summon('h0'));
    expect(types(events)).toEqual(['NormalSummoned']);
    expect(state.pendingPrompt).toMatchObject({ playerIndex: 0, kind: 'TriggerActivation' });
    expect(state.chainStack).toEqual([]);

    const legal = getLegalActions(state, 0, fixtureCtx);
    expect(legal.filter((a) => a.type === 'ResolvePendingPrompt')).toEqual([
      answer(state, ['o0-1']),
      answer(state, ['o0-3']),
    ]);
    expectEngineError(
      () => apply(state, answer(state, [], { decline: true })),
      'INVALID_TRIGGER_ANSWER',
    );
    expectEngineError(() => apply(state, answer(state, ['h0'])), 'INVALID_TRIGGER_ANSWER');
    expectEngineError(
      () => apply(state, answer(state, ['o0-1', 'o0-3'])),
      'INVALID_TRIGGER_ANSWER',
    );

    const done = apply(state, answer(state, ['o0-3']));
    expect(types(done.events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterDestroyed',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(done.state.players[1].board.monsterZones[3]).toBeNull();
    expect(done.state.players[1].board.monsterZones[1]).not.toBeNull();
    expect(done.state.pendingPrompt).toBeNull();
    expect(done.state.version).toBe(state.version + 1);
  });

  it('does not activate without a legal target, or when its condition does not hold', () => {
    const noTarget = apply(main({ hand: ['SUM_KILL'] }), summon('h0'));
    expect(types(noTarget.events)).toEqual(['NormalSummoned']);
    expect(noTarget.state.pendingPrompt).toBeNull();

    const wrongPhase = apply(main({ hand: ['SUM_MAIN2'] }, 'Main1'), summon('h0'));
    expect(types(wrongPhase.events)).toEqual(['NormalSummoned']);
    const rightPhase = apply(main({ hand: ['SUM_MAIN2'] }, 'Main2'), summon('h0'));
    expect(types(rightPhase.events)).toContain('LifePointsRecovered');
  });
});

describe('OnSummon — optional', () => {
  it('asks the owner; nothing is on the chain yet and only the prompt answers (+ Surrender) are legal', () => {
    const before = main({ hand: ['SUM_HEAL'] });
    const { state, events } = apply(before, summon('h0'));
    expect(types(events)).toEqual(['NormalSummoned']);
    expect(state.pendingPrompt).toMatchObject({
      playerIndex: 0,
      kind: 'TriggerActivation',
      promptId: `trigger-3-${before.version}`,
    });
    expect(state.chainStack).toEqual([]);
    expect(state.chainWindow).toBeNull();
    expect(state.version).toBe(before.version + 1);

    expect(getLegalActions(state, 0, fixtureCtx)).toEqual([
      answer(state, [], { decline: true }),
      answer(state, []),
      { type: 'Surrender', payload: { playerIndex: 0 } },
    ]);
    expect(getLegalActions(state, 1, fixtureCtx)).toEqual([
      { type: 'Surrender', payload: { playerIndex: 1 } },
    ]);
    expectEngineError(
      () => apply(state, { type: 'EndPhase', payload: { playerIndex: 0 } }),
      'PENDING_PROMPT',
    );
  });

  it('accepted: goes on the chain and resolves', () => {
    const before = main({ hand: ['SUM_HEAL'] });
    const asked = apply(before, summon('h0')).state;
    const { state, events } = apply(asked, answer(asked));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'LifePointsRecovered',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints + 500);
    expect(state.pendingPrompt).toBeNull();
    expect(state.version).toBe(asked.version + 1);
  });

  it('declined: nothing happens (no events, no LP change)', () => {
    const before = main({ hand: ['SUM_HEAL'] });
    const asked = apply(before, summon('h0')).state;
    const { state, events } = apply(asked, answer(asked, [], { decline: true }));
    expect(events).toEqual([]);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints);
    expect(state.pendingPrompt).toBeNull();
    expect(state.chainWindow).toBeNull();
    expect(state.version).toBe(asked.version + 1);
  });

  it('with an opponent able to respond: the Summon reaction window opens BEFORE the prompt (task 4.4c); declined afterwards, it does not open again', () => {
    const before = main({ hand: ['SUM_HEAL'], oppSpellTraps: [[0, 'TRAP_BURN']] });
    const opened = apply(before, summon('h0')).state;
    expect(opened.pendingPrompt).toBeNull();
    // Task 4.4: the window names the Summoned monster (what a NegateSummon would negate); task 4.4c: and carries the
    // Summon event whose triggers are still to be collected.
    expect(opened.chainWindow).toEqual({
      priorityPlayer: 1,
      passCount: 0,
      reactionTo: { kind: 'Summon' },
      summoned: { playerIndex: 0, instanceId: 'h0' },
      summonEvent: {
        type: 'NormalSummoned',
        playerIndex: 0,
        instanceId: 'h0',
        definitionId: 'SUM_HEAL',
        zoneIndex: 0,
      },
    });
    const asked = apply(opened, pass(1)).state;
    expect(asked.pendingPrompt?.kind).toBe('TriggerActivation');
    expect(asked.chainWindow).toBeNull();
    const { state } = apply(asked, answer(asked, [], { decline: true }));
    expect(state.chainWindow).toBeNull();
    expect(state.pendingPrompt).toBeNull();
  });

  it('accepted with an opponent able to respond: a plain chain window (the link is what they respond to)', () => {
    const before = main({ hand: ['SUM_HEAL'], oppSpellTraps: [[0, 'TRAP_BURN']] });
    const asked = apply(apply(before, summon('h0')).state, pass(1)).state;
    const { state } = apply(asked, answer(asked));
    expect(state.chainStack).toHaveLength(1);
    expect(state.chainWindow).toEqual({ priorityPlayer: 1, passCount: 0 });
  });

  it('rejects bad answers', () => {
    const asked = apply(main({ hand: ['SUM_HEAL'] }), summon('h0')).state;
    expectEngineError(
      () => apply(asked, answer(asked, ['h0'], { decline: true })),
      'INVALID_TRIGGER_ANSWER',
    );
    expectEngineError(() => apply(asked, answer(asked, ['h0'])), 'INVALID_TRIGGER_ANSWER');
    expectEngineError(() => apply(asked, answer(asked, [], { promptId: 'x' })), 'PROMPT_MISMATCH');
    expectEngineError(() => apply(asked, answer(asked, [], { playerIndex: 1 })), 'PROMPT_MISMATCH');
  });

  it('a PayLP cost is paid on activation; with too few LP it is not even asked', () => {
    const before = main({ hand: ['SUM_PAY'] });
    const asked = apply(before, summon('h0')).state;
    const { state, events } = apply(asked, answer(asked));
    expect(types(events)).toEqual([
      'EffectActivated',
      'LifePointsPaid',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.chainStack).toEqual([]);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints - 1000);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 1500);

    const poor = apply(main({ hand: ['SUM_PAY'], myLp: 1000 }), summon('h0'));
    expect(types(poor.events)).toEqual(['NormalSummoned']);
    expect(poor.state.pendingPrompt).toBeNull();
  });
});

describe('OnDestroyed', () => {
  it('fires after a battle destroys the monster: a new chain from the graveyard, card not moved again', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppMonsters: [[2, 'DES_BURN']] });
    const { state, events } = apply(before, attack('m0-0', 'o0-2'));
    expect(types(events)).toEqual([
      'AttackDeclared',
      'MonsterDestroyed',
      'DamageDealt',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(events[3]).toMatchObject({
      playerIndex: 1,
      instanceId: 'o0-2',
      definitionId: 'DES_BURN',
    });
    expect(events[4]).toMatchObject({ playerIndex: 1, chainIndex: 1 });
    expect(events[5]).toEqual({ type: 'DamageDealt', playerIndex: 0, amount: 400 });
    expect(state.players[1].graveyard.map((c) => c.instanceId)).toEqual(['o0-2']);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints - 400);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 1000);
  });

  it('both monsters destroyed: the turn player’s trigger is link 1, the opponent’s link 2 (resolves first)', () => {
    const before = battle({ myMonsters: [[0, 'DES_BURN']], oppMonsters: [[1, 'DES_BURN']] });
    const { state, events } = apply(before, attack('m0-0', 'o0-1'));
    const links = events.filter((e) => e.type === 'ChainLinkAdded');
    expect(links.map((l) => [l.playerIndex, l.instanceId])).toEqual([
      [0, 'm0-0'],
      [1, 'o0-1'],
    ]);
    const damage = events.filter((e) => e.type === 'DamageDealt');
    expect(damage).toEqual([
      { type: 'DamageDealt', playerIndex: 0, amount: 400 },
      { type: 'DamageDealt', playerIndex: 1, amount: 400 },
    ]);
    expect(state.chainStack).toEqual([]);
  });

  it('optional in battle: the destroyed monster’s owner (not the turn player) is asked', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppMonsters: [[2, 'DES_DRAW']] });
    const { state } = apply(before, attack('m0-0', 'o0-2'));
    expect(state.pendingPrompt).toMatchObject({ playerIndex: 1, kind: 'TriggerActivation' });
    expect(getLegalActions(state, 0, fixtureCtx)).toEqual([
      { type: 'Surrender', payload: { playerIndex: 0 } },
    ]);
    const done = apply(state, answer(state));
    expect(types(done.events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'CardDrawn',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(done.state.players[1].hand).toHaveLength(before.players[1].hand.length + 1);
  });

  it('after a reaction window closes, the battle destruction fires it (and the Trap holder may still chain)', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[2, 'DES_BURN']],
      oppSpellTraps: [[0, 'TRAP_BURN']],
    });
    const opened = apply(before, attack('m0-0', 'o0-2')).state;
    expect(opened.chainWindow?.reactionTo?.kind).toBe('Attack');
    const afterPass = apply(opened, pass(1));
    expect(types(afterPass.events)).toEqual([
      'MonsterDestroyed',
      'DamageDealt',
      'EffectActivated',
      'ChainLinkAdded',
    ]);
    // Player 0 auto-passed; player 1 can still respond with the Set Trap.
    expect(afterPass.state.chainWindow).toEqual({ priorityPlayer: 1, passCount: 1 });
    const resolved = apply(afterPass.state, pass(1));
    expect(types(resolved.events)).toEqual(['DamageDealt', 'EffectResolved', 'ChainResolved']);
    expect(resolved.state.chainWindow).toBeNull();
  });

  it('a Destroy operation fires it after the WHOLE chain resolved (a new chain)', () => {
    const before = main({ hand: ['KILL'], oppMonsters: [[2, 'DES_BURN']] });
    const { state, events } = apply(before, activate('h0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints - 400);
  });

  it('a Set Trap destroyed by an effect fires its own OnDestroyed', () => {
    const before = main({ hand: ['KILL_ST'], oppSpellTraps: [[1, 'TRAP_DES_HEAL']] });
    const { state, events } = apply(before, activate('h0'));
    expect(types(events)).toContain('SpellTrapDestroyed');
    expect(events.filter((e) => e.type === 'LifePointsRecovered')).toEqual([
      { type: 'LifePointsRecovered', playerIndex: 1, amount: 600 },
    ]);
    expect(state.players[1].graveyard.map((c) => c.instanceId)).toEqual(['os-1']);
  });

  it('a face-up Trap destroyed while its link waits: its link still resolves, then its OnDestroyed fires', () => {
    const before = main({ hand: ['HEAL', 'QP_KILL_ST'], oppSpellTraps: [[0, 'TRAP_BURN_DES']] });
    const s1 = apply(before, activate('h0')).state; // link 1 (Normal Spell), player 1 may respond
    const s2 = apply(s1, activate('os-0', 1)).state; // link 2: the Trap, face-up in its zone
    const { state, events } = apply(s2, activate('h1')); // link 3: destroys the face-up Trap
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'SpellTrapDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
      'DamageDealt', // link 2 still resolves
      'EffectResolved',
      'LifePointsRecovered', // link 1
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
      'EffectActivated', // the Trap's OnDestroyed (e2), from the graveyard
      'ChainLinkAdded',
      'LifePointsRecovered',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(events[11]).toMatchObject({ playerIndex: 1, instanceId: 'os-0', effectId: 'e2' });
    expect(state.players[1].graveyard.filter((c) => c.instanceId === 'os-0')).toHaveLength(1);
  });

  it('a trigger queued behind a prompt still goes on the chain once the prompt is answered', () => {
    // Turn player's optional DES_DRAW is asked first; the opponent's mandatory DES_BURN waits behind it.
    const before = battle({ myMonsters: [[0, 'DES_DRAW']], oppMonsters: [[1, 'DES_BURN']] });
    const asked = apply(before, attack('m0-0', 'o0-1')).state;
    expect(asked.pendingPrompt).toMatchObject({ playerIndex: 0, kind: 'TriggerActivation' });
    expect(asked.chainStack).toEqual([]);
    const { state, events } = apply(asked, answer(asked));
    expect(
      events.filter((e) => e.type === 'ChainLinkAdded').map((e) => [e.playerIndex, e.instanceId]),
    ).toEqual([
      [0, 'm0-0'],
      [1, 'o0-1'],
    ]);
    // Link 2 (player 1's burn) resolves first, then link 1 (player 0's draw).
    expect(types(events).slice(-6)).toEqual([
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'CardDrawn',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.chainStack).toEqual([]);
  });

  it('a prompt behind a mandatory link keeps the chain waiting (no auto-pass over the prompt)', () => {
    // Turn player's mandatory DES_BURN is link 1; the opponent's optional DES_DRAW asks while that link waits.
    const before = battle({ myMonsters: [[0, 'DES_BURN']], oppMonsters: [[1, 'DES_DRAW']] });
    const { state, events } = apply(before, attack('m0-0', 'o0-1'));
    expect(types(events).slice(-2)).toEqual(['EffectActivated', 'ChainLinkAdded']);
    expect(state.chainStack).toHaveLength(1);
    expect(state.pendingPrompt).toMatchObject({ playerIndex: 1, kind: 'TriggerActivation' });
    expect(getLegalActions(state, 1, fixtureCtx).map((a) => a.type)).toEqual([
      'ResolvePendingPrompt',
      'ResolvePendingPrompt',
      'Surrender',
    ]);

    const declined = apply(state, answer(state, [], { decline: true }));
    expect(types(declined.events)).toEqual(['DamageDealt', 'EffectResolved', 'ChainResolved']);
    expect(declined.state.chainStack).toEqual([]);
  });

  it('`decline` only answers a TriggerActivation prompt', () => {
    const asked = apply(
      main({
        hand: ['KILL'],
        oppMonsters: [
          [1, 'M1'],
          [3, 'M2'],
        ],
      }),
      activate('h0'),
    ).state;
    expect(asked.pendingPrompt?.kind).toBe('SelectEffectTarget');
    expectEngineError(
      () => apply(asked, answer(asked, ['o0-1'], { decline: true })),
      'INVALID_TRIGGER_ANSWER',
    );
    expect(apply(asked, answer(asked, ['o0-1'])).state.pendingPrompt).toBeNull();
  });

  it('no trigger once the duel is over', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppMonsters: [[2, 'DES_BURN']], oppLp: 500 });
    const { state, events } = apply(before, attack('m0-0', 'o0-2'));
    expect(types(events)).toEqual([
      'AttackDeclared',
      'MonsterDestroyed',
      'DamageDealt',
      'DuelEnded',
    ]);
    expect(state.chainStack).toEqual([]);
  });
});
