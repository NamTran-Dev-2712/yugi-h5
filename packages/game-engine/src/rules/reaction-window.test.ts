import { describe, expect, it } from 'vitest';
import { applyAction } from '../apply-action.js';
import type { Action, ActivateEffectAction } from '../actions/types.js';
import type { GameEvent } from '../events/types.js';
import { getLegalActions } from '../legal-actions.js';
import type { GameState } from '../state/types.js';
import { deepFreeze } from '../testing/deep-freeze.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../testing/effect-fixtures.js';

/*
 * Task 3.4c — reaction window after DeclareAttack / NormalSummon / SetMonster ([REF] video #3/#4 R1–R5, reusing the
 * 3.3 chain window). Owner-approved 2026-09-27:
 * - [ASSUMED] the window opens only for the OPPONENT and only when they have a legal activation; otherwise nothing changes.
 * - [ASSUMED] with an empty chain, one pass by the opponent closes it (the attack then goes on to damage).
 * - [ASSUMED] attacker or attack target gone after the window → the attack stops (no replay).
 * - [DECISION] SetMonster opens the window too (brief), Normal/Tribute Summon per [REF] R2.
 * Fixture: player 0 is the turn player; turnCount is bumped to 3 so attacks are allowed.
 */

const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const types = (events: readonly { type: string }[]) => events.map((e) => e.type);
const activate = (cardInstanceId: string, playerIndex: 0 | 1 = 1): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId: 'e1' },
});
const pass = (playerIndex: 0 | 1): Action => ({ type: 'PassPriority', payload: { playerIndex } });
const attack = (attackerInstanceId: string, targetInstanceId?: string): Action => ({
  type: 'DeclareAttack',
  payload: {
    playerIndex: 0,
    attackerInstanceId,
    ...(targetInstanceId ? { targetInstanceId } : {}),
  },
});
const battle = (setup: FixtureSetup): GameState => ({
  ...fixtureState({ phase: 'Battle', ...setup }),
  turnCount: 3,
});
const main = (setup: FixtureSetup): GameState => ({
  ...fixtureState({ phase: 'Main1', ...setup }),
  turnCount: 3,
});

describe('reaction window after DeclareAttack', () => {
  it('opens for the opponent with a legal Set Trap: only AttackDeclared, nothing resolved yet', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[2, 'M1', 'DefenseDown']],
      oppSpellTraps: [[0, 'TRAP_BURN']],
    });
    const { state, events } = apply(before, attack('m0-0', 'o0-2'));
    expect(events).toEqual([
      {
        type: 'AttackDeclared',
        playerIndex: 0,
        attackerInstanceId: 'm0-0',
        targetInstanceId: 'o0-2',
      },
    ]);
    expect(state.chainWindow).toEqual({
      priorityPlayer: 1,
      passCount: 0,
      reactionTo: {
        kind: 'Attack',
        playerIndex: 0,
        attackerInstanceId: 'm0-0',
        targetInstanceId: 'o0-2',
      },
    });
    expect(state.chainStack).toEqual([]);
    // Not flipped, nothing destroyed, no damage yet.
    expect(state.players[1].board.monsterZones[2]?.position).toBe('DefenseDown');
    expect(state.players.map((p) => p.lifePoints)).toEqual(before.players.map((p) => p.lifePoints));
    expect(state.version).toBe(before.version + 1);
  });

  it('one pass by the opponent closes it and the attack resolves (flip → destroy)', () => {
    const opened = apply(
      battle({
        myMonsters: [[0, 'BIG']],
        oppMonsters: [[2, 'M1', 'DefenseDown']],
        oppSpellTraps: [[0, 'TRAP_BURN']],
      }),
      attack('m0-0', 'o0-2'),
    ).state;
    const { state, events } = apply(opened, pass(1));
    expect(types(events)).toEqual(['MonsterFlipped', 'MonsterDestroyed']);
    expect(state.chainWindow).toBeNull();
    expect(state.players[1].board.monsterZones[2]).toBeNull();
    expect(state.players[0].board.monsterZones[0]?.attackedTurn).toBe(3);
    expect(state.version).toBe(opened.version + 1);
  });

  it('while open: the attacker cannot pass, other actions are blocked, Surrender still works', () => {
    const opened = apply(
      battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'TRAP_BURN']] }),
      attack('m0-0'),
    ).state;
    expectEngineError(() => apply(opened, pass(0)), 'NOT_PRIORITY_HOLDER');
    expectEngineError(
      () => apply(opened, { type: 'EndPhase', payload: { playerIndex: 0 } }),
      'CHAIN_WINDOW_OPEN',
    );
    expect(
      apply(opened, { type: 'Surrender', payload: { playerIndex: 0 } }).state.winnerIndex,
    ).toBe(1);
    expect(getLegalActions(opened, 0, fixtureCtx)).toEqual([
      { type: 'Surrender', payload: { playerIndex: 0 } },
    ]);
    const theirs = getLegalActions(opened, 1, fixtureCtx);
    expect(theirs).toContainEqual(pass(1));
    expect(theirs).toContainEqual(activate('os-0'));
  });

  it('a direct attack opens the window too; after a pass the damage is dealt', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'TRAP_BURN']] });
    const opened = apply(before, attack('m0-0'));
    expect(opened.state.chainWindow?.reactionTo).toMatchObject({
      kind: 'Attack',
      targetInstanceId: null,
    });
    const { state, events } = apply(opened.state, pass(1));
    expect(events).toEqual([{ type: 'DamageDealt', playerIndex: 1, amount: 2000 }]);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 2000);
  });

  it('the opponent chains a Trap: the chain resolves, then the attack continues', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'TRAP_BURN']] });
    const opened = apply(before, attack('m0-0')).state;
    const { state, events } = apply(opened, activate('os-0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt', // the Trap: 300 to player 0
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
      'DamageDealt', // the attack: 2000 to player 1
    ]);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints - 300);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 2000);
    expect(state.chainWindow).toBeNull();
  });

  it('a Trap that destroys the attacker stops the attack (no damage)', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'TRAP_KILL_MON']] });
    const opened = apply(before, attack('m0-0')).state;
    const { state, events } = apply(opened, activate('os-0'));
    expect(events.filter((e) => e.type === 'DamageDealt')).toEqual([]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'MonsterDestroyed', instanceId: 'm0-0' }),
    );
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
    expect(state.chainWindow).toBeNull();
  });

  it('a Trap that removes the attack target stops the attack; the attacker still counts as having attacked', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[1, 'M1']],
      oppSpellTraps: [[0, 'TRAP_KILL_OWN']],
    });
    const opened = apply(before, attack('m0-0', 'o0-1')).state;
    const { state, events } = apply(opened, activate('os-0'));
    expect(events.filter((e) => e.type === 'DamageDealt')).toEqual([]);
    expect(events.filter((e) => e.type === 'MonsterDestroyed').map((e) => e.instanceId)).toEqual([
      'o0-1',
    ]);
    expect(state.players[0].board.monsterZones[0]?.attackedTurn).toBe(3);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
  });

  it('a lethal Trap ends the duel: the attack never resumes, DuelEnded is last', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'TRAP_LETHAL']] });
    const { state, events } = apply(apply(before, attack('m0-0')).state, activate('os-0'));
    expect(state.winnerIndex).toBe(1);
    expect(events.at(-1)).toMatchObject({ type: 'DuelEnded', winnerIndex: 1 });
    expect(events.filter((e) => e.type === 'DamageDealt')).toEqual([
      { type: 'DamageDealt', playerIndex: 0, amount: 9000 },
    ]);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
  });

  it.each<[string, FixtureSetup]>([
    ['no Set card', {}],
    ['a Trap with no effect', { oppSpellTraps: [[0, 'TRAP_PLAIN']] }],
    ['a Trap Set this turn', { oppSpellTraps: [[0, 'TRAP_BURN', 3]] }],
    ['only the attacker holds a Quick-Play', { hand: ['QP_HEAL'] }],
  ])('%s → no window, the attack resolves at once exactly as before', (_name, extra) => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppMonsters: [[1, 'M1']], ...extra });
    const { state, events } = apply(before, attack('m0-0', 'o0-1'));
    expect(events).toEqual([
      {
        type: 'AttackDeclared',
        playerIndex: 0,
        attackerInstanceId: 'm0-0',
        targetInstanceId: 'o0-1',
      },
      {
        type: 'MonsterDestroyed',
        ownerIndex: 1,
        instanceId: 'o0-1',
        definitionId: 'M1',
        zoneIndex: 1,
      },
      { type: 'DamageDealt', playerIndex: 1, amount: 1000 },
    ]);
    expect(state.chainWindow).toBeNull();
    expect(state.version).toBe(before.version + 1);
  });
});

describe('reaction window after a Summon / Set', () => {
  const summon = (type: 'NormalSummon' | 'SetMonster', extra: object = {}): Action =>
    ({
      type,
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 3, ...extra },
    }) as Action;

  it.each(['NormalSummon', 'SetMonster'] as const)(
    '%s opens it for the opponent; a pass closes it',
    (type) => {
      const before = main({ hand: ['M1'], oppSpellTraps: [[0, 'TRAP_BURN']] });
      const opened = apply(before, summon(type));
      expect(types(opened.events)).toEqual([
        type === 'NormalSummon' ? 'NormalSummoned' : 'MonsterSet',
      ]);
      // Task 4.4: a Normal Summon also records the Summoned monster (a Set is not a Summon: nothing recorded).
      expect(opened.state.chainWindow).toEqual({
        priorityPlayer: 1,
        passCount: 0,
        reactionTo: { kind: 'Summon' },
        // Task 4.4c: and the Summon event still owed its triggers.
        ...(type === 'NormalSummon'
          ? {
              summoned: { playerIndex: 0, instanceId: 'h0' },
              summonEvent: {
                type: 'NormalSummoned',
                playerIndex: 0,
                instanceId: 'h0',
                definitionId: 'M1',
                zoneIndex: 3,
              },
            }
          : {}),
      });
      const closed = apply(opened.state, pass(1));
      expect(closed.events).toEqual([]);
      expect(closed.state.chainWindow).toBeNull();
      // The turn player acts again.
      expect(() =>
        apply(closed.state, { type: 'EndPhase', payload: { playerIndex: 0 } }),
      ).not.toThrow();
    },
  );

  it('a Tribute Summon opens it too', () => {
    const s = main({
      hand: ['BIG_L5'],
      myMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'TRAP_BURN']],
    });
    const { state } = apply(s, summon('NormalSummon', { tributeInstanceIds: ['m0-0'] }));
    expect(state.chainWindow?.reactionTo).toEqual({ kind: 'Summon' });
  });

  it('[REF] R2: a Trap destroys the monster just Summoned', () => {
    const opened = apply(
      main({ hand: ['M1'], oppSpellTraps: [[0, 'TRAP_KILL_MON']] }),
      summon('NormalSummon'),
    ).state;
    const { state, events } = apply(opened, activate('os-0'));
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'MonsterDestroyed', instanceId: 'h0' }),
    );
    expect(state.players[0].board.monsterZones[3]).toBeNull();
    expect(state.chainWindow).toBeNull();
  });

  it('no legal response → no window (summon resolves as before)', () => {
    const { state, events } = apply(main({ hand: ['M1'] }), summon('NormalSummon'));
    expect(types(events)).toEqual(['NormalSummoned']);
    expect(state.chainWindow).toBeNull();
  });
});

describe('reaction window — event log sanity', () => {
  it('replays deterministically', () => {
    const run = () => {
      let s = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'TRAP_BURN']] });
      const all: GameEvent[] = [];
      for (const a of [attack('m0-0'), activate('os-0')]) {
        const out = apply(s, a);
        s = out.state;
        all.push(...out.events);
      }
      return { s, all };
    };
    expect(run()).toEqual(run());
  });
});
