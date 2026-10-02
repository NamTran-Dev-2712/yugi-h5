import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import type { Action, ActivateEffectAction } from '../../actions/types.js';
import { getLegalActions } from '../../legal-actions.js';
import type { GameState } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../../testing/effect-fixtures.js';

/*
 * Task 4.4 — operation `NegateAttack` (ADR 065): ends the attack the reaction window (task 3.4c) was opened for. No
 * flip, no destruction, no damage; the attacker counts as having attacked (no replay, like G14). It does not end the
 * Battle Phase. Activation needs an attack of the OPPONENT being declared (`NOTHING_TO_NEGATE` otherwise).
 * Fixture: player 0 attacks on turn 3; player 1 holds the Set cards `os-<zone>`.
 */

const act = (cardInstanceId: string, playerIndex: 0 | 1 = 1): ActivateEffectAction => ({
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
const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const types = (events: readonly { type: string }[]) => events.map((e) => e.type);
const lp = (state: GameState) => state.players.map((p) => p.lifePoints);
const battle = (setup: FixtureSetup): GameState => ({
  ...fixtureState({ phase: 'Battle', ...setup }),
  turnCount: 3,
});
const main = (setup: FixtureSetup): GameState => ({ ...fixtureState(setup), turnCount: 3 });

describe('NegateAttack', () => {
  it('a direct attack: no damage, the attacker counts as having attacked, the Trap goes to the graveyard', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'NEG_ATK']] });
    const opened = apply(before, attack('m0-0')).state;
    expect(opened.chainWindow).toMatchObject({ priorityPlayer: 1, reactionTo: { kind: 'Attack' } });

    const { state, events } = apply(opened, act('os-0'));
    expect(events).toEqual([
      {
        type: 'EffectActivated',
        playerIndex: 1,
        instanceId: 'os-0',
        definitionId: 'NEG_ATK',
        effectId: 'e1',
      },
      expect.objectContaining({ type: 'ChainLinkAdded', spellSpeed: 2, chainIndex: 1 }),
      { type: 'AttackNegated', playerIndex: 0, attackerInstanceId: 'm0-0', targetInstanceId: null },
      expect.objectContaining({ type: 'EffectResolved', instanceId: 'os-0' }),
      expect.objectContaining({ type: 'CardSentToGraveyard', instanceId: 'os-0' }),
      { type: 'ChainResolved', linkCount: 1 },
    ]);
    expect(lp(state)).toEqual(lp(before));
    expect(state.players[0].board.monsterZones[0]).toMatchObject({
      instanceId: 'm0-0',
      position: 'Attack',
      attackedTurn: 3,
    });
    expect(state.chainWindow).toBeNull();
    expect(state.phase).toBe('Battle');
    expect(state.version).toBe(opened.version + 1);
  });

  it('an attack on a face-down monster: not flipped, nothing destroyed', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[2, 'M1', 'DefenseDown']],
      oppSpellTraps: [[0, 'NEG_ATK']],
    });
    const { state, events } = apply(apply(before, attack('m0-0', 'o0-2')).state, act('os-0'));
    expect(events).toContainEqual({
      type: 'AttackNegated',
      playerIndex: 0,
      attackerInstanceId: 'm0-0',
      targetInstanceId: 'o0-2',
    });
    expect(types(events)).not.toContain('MonsterFlipped');
    expect(types(events)).not.toContain('MonsterDestroyed');
    expect(state.players[1].board.monsterZones[2]?.position).toBe('DefenseDown');
  });

  it('the same monster cannot attack again this turn; another one can; the Battle Phase goes on', () => {
    const before = battle({
      myMonsters: [
        [0, 'BIG'],
        [1, 'M1'],
      ],
      oppSpellTraps: [[0, 'NEG_ATK']],
    });
    const after = apply(apply(before, attack('m0-0')).state, act('os-0')).state;
    expectEngineError(() => apply(after, attack('m0-0')), 'ATTACKED_THIS_TURN');
    const second = apply(after, attack('m0-1'));
    expect(second.events).toContainEqual({ type: 'DamageDealt', playerIndex: 1, amount: 1000 });
  });

  it('the defender may pass instead: the attack goes through', () => {
    const before = battle({ myMonsters: [[0, 'BIG']], oppSpellTraps: [[0, 'NEG_ATK']] });
    const { state, events } = apply(apply(before, attack('m0-0')).state, pass(1));
    expect(events).toEqual([{ type: 'DamageDealt', playerIndex: 1, amount: 2000 }]);
    expect(state.players[1].board.spellTrapZones[0]?.position).toBe('DefenseDown');
  });

  it('NOTHING_TO_NEGATE outside an attack: on my own turn, and it does not open a Summon window', () => {
    const mine = main({ mySpellTraps: [[0, 'NEG_ATK']] });
    expectEngineError(() => apply(mine, act('ms-0', 0)), 'NOTHING_TO_NEGATE');
    expect(getLegalActions(mine, 0, fixtureCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );

    const summoned = apply(main({ hand: ['M1'], oppSpellTraps: [[0, 'NEG_ATK']] }), {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 0 },
    }).state;
    expect(summoned.chainWindow).toBeNull();
  });

  it('NOTHING_TO_NEGATE: answering a Spell (no attack is being declared)', () => {
    const before = main({
      hand: ['HEAL'],
      oppSpellTraps: [
        [0, 'NEG_ATK'],
        [1, 'TRAP'],
      ],
    });
    const opened = apply(before, { ...act('h0', 0) }).state;
    expect(opened.chainWindow?.priorityPlayer).toBe(1);
    expectEngineError(() => apply(opened, act('os-0')), 'NOTHING_TO_NEGATE');
  });

  it('only the defender negates: the attacker’s own Set copy is no response', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      mySpellTraps: [[0, 'NEG_ATK']],
      oppSpellTraps: [[0, 'TRAP_BURN']],
    });
    const opened = apply(before, attack('m0-0')).state;
    // Player 1 chains TRAP_BURN; player 0 (the attacker) cannot answer with NEG_ATK → everything resolves.
    const { state, events } = apply(opened, act('os-0'));
    expect(state.chainWindow).toBeNull();
    expect(types(events)).not.toContain('AttackNegated');
    expect(events.filter((e) => e.type === 'DamageDealt')).toEqual([
      { type: 'DamageDealt', playerIndex: 0, amount: 300 },
      { type: 'DamageDealt', playerIndex: 1, amount: 2000 },
    ]);
    expect(state.players[0].board.spellTrapZones[0]?.position).toBe('DefenseDown');
  });

  it('two NegateAttack on one chain: the attack is negated once, both cards are spent', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      mySpellTraps: [[0, 'TRAP']],
      oppSpellTraps: [
        [0, 'NEG_ATK'],
        [1, 'NEG_ATK'],
      ],
    });
    const opened = apply(before, attack('m0-0')).state;
    const link1 = apply(opened, act('os-0')).state;
    // Player 0 could chain TRAP, so the window waits; player 0 passes and player 1 adds the second copy.
    const back = apply(link1, pass(0)).state;
    expect(back.chainWindow).toMatchObject({ priorityPlayer: 1, passCount: 1 });
    const link2 = apply(back, act('os-1')).state;
    // Player 0 passes again; player 1 has nothing left, so the chain resolves in this call.
    const { state, events } = apply(link2, pass(0));
    expect(events.filter((e) => e.type === 'AttackNegated')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'EffectResolved').map((e) => e.instanceId)).toEqual([
      'os-1',
      'os-0',
    ]);
    expect(types(events)).not.toContain('DamageDealt');
    expect(state.players[1].graveyard.map((c) => c.instanceId)).toEqual(['os-1', 'os-0']);
    expect(lp(state)).toEqual(lp(before));
  });

  it('a negated NegateAttack lets the attack through (Counter Trap of the attacker)', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      mySpellTraps: [[0, 'NEG_ANY']],
      oppSpellTraps: [[0, 'NEG_ATK']],
    });
    const link1 = apply(apply(before, attack('m0-0')).state, act('os-0')).state;
    expect(link1.chainWindow).toMatchObject({ priorityPlayer: 0, reactionTo: { kind: 'Attack' } });
    const { state, events } = apply(link1, act('ms-0', 0));
    expect(types(events)).toContain('ChainLinkNegated');
    expect(types(events)).not.toContain('AttackNegated');
    expect(events.at(-1)).toEqual({ type: 'DamageDealt', playerIndex: 1, amount: 2000 });
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 2000);
  });

  it('the attacker left the field before it resolves: still negated, nothing to stamp', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      mySpellTraps: [[0, 'TRAP']],
      oppSpellTraps: [
        [0, 'NEG_ATK'],
        [1, 'TRAP_KILL_MON'],
      ],
    });
    const link1 = apply(apply(before, attack('m0-0')).state, act('os-0')).state;
    const link2 = apply(apply(link1, pass(0)).state, act('os-1')).state;
    const { state, events } = apply(link2, pass(0));
    expect(types(events)).toContain('MonsterDestroyed');
    expect(types(events)).toContain('AttackNegated');
    expect(types(events)).not.toContain('DamageDealt');
    expect(state.players[0].board.monsterZones[0]).toBeNull();
  });
});
