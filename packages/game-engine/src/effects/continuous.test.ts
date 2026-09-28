import { describe, expect, it } from 'vitest';
import { applyAction } from '../apply-action.js';
import type { Action } from '../actions/types.js';
import { getLegalActions } from '../legal-actions.js';
import type { CardInstance, GameState } from '../state/types.js';
import { deepFreeze } from '../testing/deep-freeze.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../testing/effect-fixtures.js';
import { activeContinuousEffects, effectiveStats } from './continuous.js';

/*
 * Task 3.6 — Continuous effects [RULE]: never activated, never on the chain; they apply while their card is face-up on
 * the field and stop the moment it leaves (or is face-down). The engine recomputes them on every read, nothing is
 * stored in the state. Fixture: player 0 is the turn player; `battle` bumps turnCount to 3 so attacks are allowed.
 */

const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const main = (setup: FixtureSetup): GameState => ({
  ...fixtureState({ phase: 'Main1', ...setup }),
  turnCount: 3,
});
const battle = (setup: FixtureSetup): GameState => ({
  ...fixtureState({ phase: 'Battle', ...setup }),
  turnCount: 3,
});
const stats = (state: GameState, player: 0 | 1, zone: number) =>
  effectiveStats(state, state.players[player].board.monsterZones[zone]!, fixtureCtx);
const attack = (attackerInstanceId: string, targetInstanceId?: string): Action => ({
  type: 'DeclareAttack',
  payload: {
    playerIndex: 0,
    attackerInstanceId,
    ...(targetInstanceId ? { targetInstanceId } : {}),
  },
});
/** Puts a face-up (activated) Spell/Trap in player 0's Spell/Trap Zone — only a fixture can until P4. */
const withFaceUpSpell = (state: GameState, definitionId: string, zone = 0): GameState => {
  const card: CardInstance = {
    instanceId: `ms-${zone}`,
    definitionId,
    ownerIndex: 0,
    position: 'Attack',
  };
  const me = state.players[0];
  const spellTrapZones = me.board.spellTrapZones.map((c, i) =>
    i === zone ? card : c,
  ) as unknown as typeof me.board.spellTrapZones;
  return {
    ...state,
    players: [{ ...me, board: { ...me.board, spellTrapZones } }, state.players[1]],
  };
};

describe('effectiveStats — ModifyStat', () => {
  it('without any Continuous effect returns the printed ATK/DEF', () => {
    const state = main({ myMonsters: [[0, 'BIG']], oppMonsters: [[0, 'M1']] });
    expect(stats(state, 0, 0)).toEqual({ atk: 2000, def: 500 });
    expect(stats(state, 1, 0)).toEqual({ atk: 1000, def: 1000 });
    expect(activeContinuousEffects(state, fixtureCtx)).toEqual([]);
  });

  it('only Continuous effects are in force (a face-up trigger monster or Quick Trap is not a source)', () => {
    const state = withFaceUpSpell(
      main({
        myMonsters: [
          [0, 'SUM_DRAW'],
          [1, 'DES_BURN'],
        ],
      }),
      'TRAP',
    );
    expect(activeContinuousEffects(state, fixtureCtx)).toEqual([]);
  });

  it('buffs the other matching monsters of its side, not itself (excludeSource), not other races, not the opponent', () => {
    const state = main({
      myMonsters: [
        [0, 'CONT_WARRIOR_BUFF'],
        [1, 'M1'], // Warrior
        [2, 'M2'], // Dragon
      ],
      oppMonsters: [[0, 'M1']], // Warrior, but on the other side
    });
    expect(stats(state, 0, 0)).toEqual({ atk: 1000, def: 1000 });
    expect(stats(state, 0, 1)).toEqual({ atk: 1500, def: 1000 });
    expect(stats(state, 0, 2)).toEqual({ atk: 1000, def: 1000 });
    expect(stats(state, 1, 0)).toEqual({ atk: 1000, def: 1000 });
  });

  it('side "opponent" hits every face-up monster of the other player (ATK and DEF operations of one effect)', () => {
    const state = main({
      myMonsters: [
        [0, 'CONT_WEAKEN'],
        [1, 'M1'],
      ],
      oppMonsters: [
        [0, 'BIG'],
        [1, 'M1', 'DefenseUp'],
      ],
    });
    expect(stats(state, 1, 0)).toEqual({ atk: 1400, def: 100 });
    expect(stats(state, 1, 1)).toEqual({ atk: 400, def: 600 });
    expect(stats(state, 0, 1)).toEqual({ atk: 1000, def: 1000 });
  });

  it('applies to the source itself when it matches and excludeSource is not set', () => {
    const state = main({ myMonsters: [[0, 'CONT_WALL']] });
    expect(stats(state, 0, 0)).toEqual({ atk: 1000, def: 1800 });
  });

  it('stacks two sources', () => {
    const state = main({
      myMonsters: [
        [0, 'CONT_WARRIOR_BUFF'],
        [1, 'CONT_WARRIOR_BUFF'],
        [2, 'M1'],
      ],
    });
    // Each source buffs the other one (Warrior) and M1.
    expect(stats(state, 0, 2)).toEqual({ atk: 2000, def: 1000 });
    expect(stats(state, 0, 0)).toEqual({ atk: 1500, def: 1000 });
  });

  it('never goes below 0 [RULE]', () => {
    const state = main({ myMonsters: [[0, 'CONT_CRUSH']], oppMonsters: [[0, 'BIG']] });
    expect(stats(state, 1, 0)).toEqual({ atk: 0, def: 500 });
  });

  it('a face-down source has no effect; face-up in Defense Position it does', () => {
    const down = main({
      myMonsters: [
        [0, 'CONT_WARRIOR_BUFF', 'DefenseDown'],
        [1, 'M1'],
      ],
    });
    expect(stats(down, 0, 1)).toEqual({ atk: 1000, def: 1000 });
    const up = main({
      myMonsters: [
        [0, 'CONT_WARRIOR_BUFF', 'DefenseUp'],
        [1, 'M1'],
      ],
    });
    expect(stats(up, 0, 1)).toEqual({ atk: 1500, def: 1000 });
  });

  it('a face-down monster keeps its printed stats (nobody reads them before it is flipped)', () => {
    const state = main({
      myMonsters: [
        [0, 'CONT_WALL'],
        [1, 'M1', 'DefenseDown'],
      ],
    });
    expect(stats(state, 0, 1)).toEqual({ atk: 1000, def: 1000 });
  });

  it('reads the card as it is on the given board, not the caller’s copy (a stale face-down copy of a face-up monster)', () => {
    const state = main({ myMonsters: [[0, 'CONT_WALL']] });
    const stale: CardInstance = {
      ...state.players[0].board.monsterZones[0]!,
      position: 'DefenseDown',
    };
    expect(effectiveStats(state, stale, fixtureCtx)).toEqual({ atk: 1000, def: 1800 });
  });

  it('a face-up Continuous Spell applies; the same card face-down does not', () => {
    const base = main({ myMonsters: [[0, 'M1']], mySpellTraps: [[0, 'CONT_SPELL_BUFF']] });
    expect(stats(base, 0, 0)).toEqual({ atk: 1000, def: 1000 });
    expect(stats(withFaceUpSpell(base, 'CONT_SPELL_BUFF'), 0, 0)).toEqual({ atk: 1300, def: 1000 });
  });

  it('respects the effect condition, re-evaluated on every read (IsMyTurn)', () => {
    const mine = main({ myMonsters: [[0, 'CONT_MY_TURN']] });
    expect(stats(mine, 0, 0)).toEqual({ atk: 1400, def: 1000 });
    expect(stats({ ...mine, turnPlayerIndex: 1 }, 0, 0)).toEqual({ atk: 1000, def: 1000 });
  });

  it('stops the moment the source leaves the field (nothing was stored in the state)', () => {
    const state = main({
      myMonsters: [
        [0, 'CONT_WARRIOR_BUFF'],
        [1, 'M1'],
      ],
    });
    const me = state.players[0];
    const monsterZones = me.board.monsterZones.map((c, i) =>
      i === 0 ? null : c,
    ) as unknown as typeof me.board.monsterZones;
    const gone: GameState = {
      ...state,
      players: [{ ...me, board: { ...me.board, monsterZones } }, state.players[1]],
    };
    expect(stats(gone, 0, 1)).toEqual({ atk: 1000, def: 1000 });
  });

  it('is pure: works on a frozen state and lists sources in a fixed order (P0 then P1, monsters then Spell/Trap)', () => {
    const state = deepFreeze(
      withFaceUpSpell(
        main({
          myMonsters: [
            [3, 'CONT_WALL'],
            [1, 'CONT_WARRIOR_BUFF'],
          ],
          oppMonsters: [[0, 'CONT_WEAKEN']],
        }),
        'CONT_SPELL_BUFF',
      ),
    );
    const active = activeContinuousEffects(state, fixtureCtx);
    expect(active.map((a) => [a.controller, a.source.instanceId])).toEqual([
      [0, 'm0-1'],
      [0, 'm0-3'],
      [0, 'ms-0'],
      [1, 'o0-0'],
    ]);
    expect(stats(state, 0, 1)).toEqual({ atk: 700, def: 1400 });
  });
});

describe('Continuous effects in battle (resolve-attack reads effective stats)', () => {
  it('an ATK buff turns a mutual destruction into a win with damage', () => {
    const without = apply(
      battle({ myMonsters: [[1, 'M1']], oppMonsters: [[0, 'M2']] }),
      attack('m0-1', 'o0-0'),
    );
    expect(without.state.players[0].board.monsterZones[1]).toBeNull();

    const before = battle({
      myMonsters: [
        [0, 'CONT_WARRIOR_BUFF'],
        [1, 'M1'],
      ],
      oppMonsters: [[0, 'M2']],
    });
    const { state, events } = apply(before, attack('m0-1', 'o0-0'));
    expect(state.players[0].board.monsterZones[1]?.instanceId).toBe('m0-1');
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(events).toContainEqual({ type: 'DamageDealt', playerIndex: 1, amount: 500 });
    expect(state.players[1].lifePoints).toBe(7500);
  });

  it('a debuff on the opponent lowers the battle damage the attacker takes', () => {
    const before = battle({
      myMonsters: [
        [0, 'CONT_WEAKEN'],
        [1, 'M1'],
      ],
      oppMonsters: [[0, 'BIG']],
    });
    const { state, events } = apply(before, attack('m0-1', 'o0-0'));
    expect(events).toContainEqual({ type: 'DamageDealt', playerIndex: 0, amount: 400 });
    expect(state.players[0].lifePoints).toBe(7600);
  });

  it('a DEF debuff lets the attacker destroy a Defense Position monster it could not before', () => {
    const before = battle({
      myMonsters: [
        [0, 'CONT_WEAKEN'],
        [1, 'M1'],
      ],
      oppMonsters: [[0, 'M1', 'DefenseUp']],
    });
    const { state } = apply(before, attack('m0-1', 'o0-0'));
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(state.players[0].lifePoints).toBe(8000);
  });

  it('a face-down target that is flipped by the attack applies its own Continuous effect to the damage calc', () => {
    // CONT_WALL: DEF 1000 + 800 (its own effect, face-up once flipped) = 1800 vs ATK 1000 → 800 to the attacker.
    const before = battle({
      myMonsters: [[0, 'M1']],
      oppMonsters: [[0, 'CONT_WALL', 'DefenseDown']],
    });
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(events.map((e) => e.type)).toContain('MonsterFlipped');
    expect(events).toContainEqual({ type: 'DamageDealt', playerIndex: 0, amount: 800 });
    expect(state.players[1].board.monsterZones[0]?.position).toBe('DefenseUp');
  });

  it('destroying the source during the attack’s reaction window removes the buff before damage', () => {
    // M1 (1500 with the buff) attacks M2 (1000); the opponent's Trap destroys the buff source → 1000 vs 1000.
    let state = battle({
      myMonsters: [
        [0, 'CONT_WARRIOR_BUFF'],
        [1, 'M1'],
      ],
      oppMonsters: [[0, 'M2']],
      oppSpellTraps: [[0, 'TRAP_KILL_MON']],
    });
    state = apply(state, attack('m0-1', 'o0-0')).state;
    expect(state.chainWindow?.reactionTo?.kind).toBe('Attack');
    state = apply(state, {
      type: 'ActivateEffect',
      payload: { playerIndex: 1, cardInstanceId: 'os-0', effectId: 'e1' },
    }).state;
    const prompt = state.pendingPrompt!;
    state = apply(state, {
      type: 'ResolvePendingPrompt',
      payload: { playerIndex: 1, promptId: prompt.promptId, cardInstanceIds: ['m0-0'] },
    }).state;
    for (let i = 0; i < 4 && state.chainWindow !== null; i++) {
      state = apply(state, {
        type: 'PassPriority',
        payload: { playerIndex: state.chainWindow.priorityPlayer },
      }).state;
    }
    expect(state.chainWindow).toBeNull();
    expect(state.players[0].board.monsterZones[0]).toBeNull(); // source destroyed by the Trap
    expect(state.players[0].board.monsterZones[1]).toBeNull(); // tie: attacker destroyed
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(state.players[1].lifePoints).toBe(8000);
  });
});

describe('Continuous effects are never activated', () => {
  it('ActivateEffect on a Continuous effect → CONTINUOUS_NOT_ACTIVATABLE (from the hand or Set)', () => {
    const inHand = main({ hand: ['CONT_SPELL_BUFF'] });
    expectEngineError(
      () =>
        apply(inHand, {
          type: 'ActivateEffect',
          payload: { playerIndex: 0, cardInstanceId: 'h0', effectId: 'e1' },
        }),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
    const set = main({ mySpellTraps: [[0, 'CONT_SPELL_BUFF']] });
    expectEngineError(
      () =>
        apply(set, {
          type: 'ActivateEffect',
          payload: { playerIndex: 0, cardInstanceId: 'ms-0', effectId: 'e1' },
        }),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
  });

  it('a monster on the field with a Continuous effect → CONTINUOUS_NOT_ACTIVATABLE (other effect ids: CARD_NOT_IN_HAND)', () => {
    const state = main({ myMonsters: [[0, 'CONT_WALL']] });
    const act = (effectId: string): Action => ({
      type: 'ActivateEffect',
      payload: { playerIndex: 0, cardInstanceId: 'm0-0', effectId },
    });
    expectEngineError(() => apply(state, act('e1')), 'CONTINUOUS_NOT_ACTIVATABLE');
    expectEngineError(() => apply(state, act('nope')), 'CARD_NOT_IN_HAND');
  });

  it('legalActions never lists a Continuous effect', () => {
    const state = main({
      hand: ['CONT_SPELL_BUFF', 'CONT_WARRIOR_BUFF'],
      mySpellTraps: [[0, 'CONT_SPELL_BUFF']],
      myMonsters: [[0, 'CONT_WALL']],
    });
    const activations = getLegalActions(state, 0, fixtureCtx).filter(
      (a) => a.type === 'ActivateEffect',
    );
    expect(activations).toEqual([]);
  });
});
