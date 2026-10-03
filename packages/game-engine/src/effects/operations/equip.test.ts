import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import type { ActivateEffectAction } from '../../actions/types.js';
import { getLegalActions } from '../../legal-actions.js';
import { detachOrphanEquips } from '../../state/detach-equips.js';
import type { CardInstance, GameState, PlayerState } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../../testing/effect-fixtures.js';
import { effectiveStats } from '../continuous.js';

/* Task 4.2c — Equip Spells: operation Equip + ModifyStat.equipped; the Equip leaves the field with its monster. */

const activate = (
  cardInstanceId = 'h0',
  playerIndex: 0 | 1 = 0,
  effectId = 'e1',
): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId },
});

const run = (setup: FixtureSetup, action: ActivateEffectAction = activate()) =>
  applyAction(deepFreeze(fixtureState(setup)), action, fixtureCtx);

const types = (events: readonly { type: string }[]) => events.map((e) => e.type);

const atkOf = (state: GameState, instanceId: string): number => {
  for (const p of state.players) {
    const card = p.board.monsterZones.find((c) => c?.instanceId === instanceId);
    if (card) return effectiveStats(state, card, fixtureCtx).atk;
  }
  throw new Error(`${instanceId} is not on the field`);
};

/** Puts `definitionId` face-up in `owner`'s Spell/Trap Zone `zone`, already equipped to `targetId` (instance id eq-<owner>). */
function withEquip(
  state: GameState,
  owner: 0 | 1,
  zone: number,
  definitionId: string,
  targetId: string,
): GameState {
  const card: CardInstance = {
    instanceId: `eq-${owner}`,
    definitionId,
    ownerIndex: owner,
    position: 'Attack',
    equippedTo: targetId,
  };
  const p = state.players[owner];
  const spellTrapZones = p.board.spellTrapZones.map((c, i) =>
    i === zone ? card : c,
  ) as unknown as PlayerState['board']['spellTrapZones'];
  const next: PlayerState = { ...p, board: { ...p.board, spellTrapZones } };
  return { ...state, players: owner === 0 ? [next, state.players[1]] : [state.players[0], next] };
}

describe('Equip — activation and attachment', () => {
  it('goes face-up into a Spell/Trap Zone, equips the only face-up monster and stays on the field', () => {
    const before = fixtureState({ hand: ['EQ_POWER'], myMonsters: [[0, 'M1']] });
    const { state, events } = applyAction(deepFreeze(before), activate(), fixtureCtx);
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'CardEquipped',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(events[2]).toEqual({
      type: 'CardEquipped',
      playerIndex: 0,
      instanceId: 'h0',
      definitionId: 'EQ_POWER',
      targetInstanceId: 'm0-0',
    });
    const me = state.players[0];
    expect(me.hand).toEqual([]);
    expect(me.graveyard).toEqual([]);
    expect(me.board.spellTrapZones[0]).toEqual({
      instanceId: 'h0',
      definitionId: 'EQ_POWER',
      ownerIndex: 0,
      position: 'Attack',
      equippedTo: 'm0-0',
    });
    expect(atkOf(state, 'm0-0')).toBe(1500);
  });

  it('uses the lowest empty Spell/Trap Zone [ASSUMED]; all five full → NO_FREE_SPELL_TRAP_ZONE', () => {
    const { state } = run({
      hand: ['EQ_POWER'],
      myMonsters: [[0, 'M1']],
      mySpellTraps: [
        [0, 'TRAP_PLAIN'],
        [1, 'TRAP_PLAIN'],
      ],
    });
    expect(state.players[0].board.spellTrapZones[2]?.instanceId).toBe('h0');
    expectEngineError(
      () =>
        run({
          hand: ['EQ_POWER'],
          myMonsters: [[0, 'M1']],
          mySpellTraps: [0, 1, 2, 3, 4].map((z) => [z, 'TRAP_PLAIN'] as [number, string]),
        }),
      'NO_FREE_SPELL_TRAP_ZONE',
    );
  });

  it('only a face-up monster can be equipped [RULE]: face-down only → NO_VALID_TARGET', () => {
    expectEngineError(
      () => run({ hand: ['EQ_POWER'], myMonsters: [[0, 'M1', 'DefenseDown']] }),
      'NO_VALID_TARGET',
    );
  });

  it('is a Main Phase action from the hand; a Set Equip Spell is activatable too (task 4.4c)', () => {
    const base = fixtureState({ hand: ['EQ_POWER'], myMonsters: [[0, 'M1']] });
    expectEngineError(
      () => applyAction({ ...base, phase: 'Battle' }, activate(), fixtureCtx),
      'WRONG_PHASE',
    );
    // Until task 4.4c this was NOT_ACTIVATABLE (backlog); details in rules/equip-set-activation.test.ts.
    const { state } = run(
      { mySpellTraps: [[2, 'EQ_POWER']], myMonsters: [[0, 'M1']] },
      activate('ms-2'),
    );
    expect(state.players[0].board.spellTrapZones[2]).toMatchObject({
      position: 'Attack',
      equippedTo: 'm0-0',
    });
  });

  it('asks which monster when several qualify; only the equipped one is modified', () => {
    const { state } = run({
      hand: ['EQ_POWER'],
      myMonsters: [
        [0, 'M1'],
        [1, 'M1'],
      ],
    });
    expect(state.pendingPrompt).toMatchObject({
      kind: 'SelectEffectTarget',
      payload: { candidateInstanceIds: ['m0-0', 'm0-1'], count: 1 },
    });
    const done = applyAction(
      state,
      {
        type: 'ResolvePendingPrompt',
        payload: {
          playerIndex: 0,
          promptId: state.pendingPrompt!.promptId,
          cardInstanceIds: ['m0-1'],
        },
      },
      fixtureCtx,
    ).state;
    expect(atkOf(done, 'm0-1')).toBe(1500);
    expect(atkOf(done, 'm0-0')).toBe(1000);
  });

  it('can target the opponent’s monster (lowering its ATK); the Equip stays on MY side of the field', () => {
    const { state } = run({ hand: ['EQ_WEAK'], oppMonsters: [[0, 'M1']] });
    expect(state.players[0].board.spellTrapZones[0]?.equippedTo).toBe('o0-0');
    expect(atkOf(state, 'o0-0')).toBe(500);
  });

  it('target gone before it resolves → the link fizzles and the Equip goes to the graveyard [RULE]', () => {
    // The opponent answers with a Trap that destroys my monster (the Equip's only target).
    const first = run({
      hand: ['EQ_POWER'],
      myMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'TRAP_KILL_MON']],
    }).state;
    expect(first.chainWindow?.priorityPlayer).toBe(1);
    const { state, events } = applyAction(first, activate('os-0', 1), fixtureCtx);
    expect(types(events)).toContain('ChainLinkFizzled');
    expect(events.filter((e) => e.type === 'CardSentToGraveyard')).toContainEqual({
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'h0',
      definitionId: 'EQ_POWER',
      from: 'SpellTrapZone',
    });
    expect(state.players[0].board.spellTrapZones[0]).toBeNull();
    expect(types(events)).not.toContain('CardEquipped');
  });

  it('Equip destroyed in response → nothing equipped, the monster keeps its printed ATK', () => {
    const first = run({
      hand: ['EQ_POWER'],
      myMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'TRAP_KILL_ST']],
    }).state;
    const { state, events } = applyAction(first, activate('os-0', 1), fixtureCtx);
    expect(types(events)).toContain('SpellTrapDestroyed');
    expect(types(events)).not.toContain('CardEquipped');
    expect(state.players[0].board.spellTrapZones.every((c) => c === null)).toBe(true);
    expect(atkOf(state, 'm0-0')).toBe(1000);
  });
});

describe('Equip — leaves the field with its monster', () => {
  it('equipped monster destroyed by battle → the Equip is sent to the graveyard (not destroyed) [ASSUMED G18]', () => {
    const start = withEquip(
      {
        ...fixtureState({ myMonsters: [[0, 'M1']], oppMonsters: [[0, 'BIG']] }),
        turnCount: 3,
        phase: 'Battle',
      },
      0,
      0,
      'EQ_POWER',
      'm0-0',
    );
    expect(atkOf(start, 'm0-0')).toBe(1500);
    const { state, events } = applyAction(
      start,
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'm0-0', targetInstanceId: 'o0-0' },
      },
      fixtureCtx,
    );
    // 1500 vs 2000: the equipped monster loses, then its Equip follows it.
    expect(types(events)).toEqual([
      'AttackDeclared',
      'MonsterDestroyed',
      'DamageDealt',
      'CardSentToGraveyard',
    ]);
    expect(events.at(-1)).toEqual({
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'eq-0',
      definitionId: 'EQ_POWER',
      from: 'SpellTrapZone',
    });
    expect(state.players[0].board.spellTrapZones[0]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['m0-0', 'eq-0']);
    expect(state.players[0].graveyard[1]).not.toHaveProperty('equippedTo');
  });

  it('the Equip’s ATK counts in battle: 1500 beats a 1000 monster', () => {
    const start = withEquip(
      {
        ...fixtureState({ myMonsters: [[0, 'M1']], oppMonsters: [[0, 'M1']] }),
        turnCount: 3,
        phase: 'Battle',
      },
      0,
      0,
      'EQ_POWER',
      'm0-0',
    );
    const { events } = applyAction(
      start,
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'm0-0', targetInstanceId: 'o0-0' },
      },
      fixtureCtx,
    );
    expect(events.find((e) => e.type === 'DamageDealt')).toMatchObject({
      playerIndex: 1,
      amount: 500,
    });
  });

  it('equipped (opponent) monster destroyed by an effect → my Equip goes to MY graveyard', () => {
    const start = withEquip(
      fixtureState({ hand: ['KILL'], oppMonsters: [[0, 'M1']] }),
      0,
      0,
      'EQ_WEAK',
      'o0-0',
    );
    const { state, events } = applyAction(start, activate('h0'), fixtureCtx);
    expect(types(events).slice(-2)).toEqual(['ChainResolved', 'CardSentToGraveyard']);
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h0', 'eq-0']);
  });

  it('equipped monster Tributed → the Equip goes to the graveyard', () => {
    const start = withEquip(
      fixtureState({ hand: ['BIG_L5'], myMonsters: [[0, 'M1']] }),
      0,
      1,
      'EQ_POWER',
      'm0-0',
    );
    const { state, events } = applyAction(
      start,
      {
        type: 'NormalSummon',
        payload: {
          playerIndex: 0,
          cardInstanceId: 'h0',
          zoneIndex: 0,
          tributeInstanceIds: ['m0-0'],
        },
      },
      fixtureCtx,
    );
    expect(types(events)).toEqual(['MonsterTributed', 'NormalSummoned', 'CardSentToGraveyard']);
    expect(state.players[0].board.spellTrapZones[1]).toBeNull();
    // The new monster in the same zone is NOT equipped.
    expect(atkOf(state, 'h0')).toBe(2200);
  });

  it('Equip destroyed on its own → the monster loses the bonus at once (nothing stored)', () => {
    const start = withEquip(
      { ...fixtureState({ hand: ['KILL_ST'], oppMonsters: [[0, 'M1']] }) },
      1,
      0,
      'EQ_POWER',
      'o0-0',
    );
    expect(atkOf(start, 'o0-0')).toBe(1500);
    const { state } = applyAction(start, activate('h0'), fixtureCtx);
    expect(state.players[1].board.spellTrapZones[0]).toBeNull();
    expect(atkOf(state, 'o0-0')).toBe(1000);
  });
});

describe('detachOrphanEquips', () => {
  it('returns the very same state when every Equip has its monster', () => {
    const state = withEquip(fixtureState({ myMonsters: [[0, 'M1']] }), 0, 0, 'EQ_POWER', 'm0-0');
    const out = detachOrphanEquips(state);
    expect(out.state).toBe(state);
    expect(out.events).toEqual([]);
  });

  it('sends an Equip whose monster is gone, or face-down, to its owner’s graveyard', () => {
    const gone = withEquip(fixtureState(), 1, 2, 'EQ_POWER', 'nowhere');
    const out = detachOrphanEquips(gone);
    expect(out.state.players[1].board.spellTrapZones[2]).toBeNull();
    expect(out.state.players[1].graveyard.at(-1)).toEqual({
      instanceId: 'eq-1',
      definitionId: 'EQ_POWER',
      ownerIndex: 1,
      position: null,
    });
    const faceDown = withEquip(
      fixtureState({ myMonsters: [[0, 'M1', 'DefenseDown']] }),
      0,
      0,
      'EQ_POWER',
      'm0-0',
    );
    expect(detachOrphanEquips(faceDown).events).toHaveLength(1);
  });
});

describe('Equip — legal actions', () => {
  it('lists the activation only when there is a face-up monster to equip and a free zone', () => {
    const isEquip = (a: { type: string; payload: unknown }) =>
      a.type === 'ActivateEffect' &&
      (a.payload as { cardInstanceId: string }).cardInstanceId === 'h0';
    const ok = fixtureState({ hand: ['EQ_POWER'], myMonsters: [[0, 'M1']] });
    expect(getLegalActions(ok, 0, fixtureCtx).some(isEquip)).toBe(true);
    const none = fixtureState({ hand: ['EQ_POWER'] });
    expect(getLegalActions(none, 0, fixtureCtx).some(isEquip)).toBe(false);
  });
});
