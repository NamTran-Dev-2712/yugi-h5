import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import { collectTriggers } from '../../effects/triggers.js';
import { getLegalActions } from '../../legal-actions.js';
import type { CardInstance, GameState, PlayerState } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../../testing/effect-fixtures.js';
import type { DeclareAttackAction, FlipSummonAction } from '../types.js';

/* Task 4.2b — FlipSummon action + OnFlip trigger (Flip Summon, or flipped by an attack). */

const flip = (cardInstanceId = 'm0-0', playerIndex: 0 | 1 = 0): FlipSummonAction => ({
  type: 'FlipSummon',
  payload: { playerIndex, cardInstanceId },
});

const run = (setup: FixtureSetup, action: FlipSummonAction = flip()) =>
  applyAction(deepFreeze(fixtureState(setup)), action, fixtureCtx);

const types = (events: readonly { type: string }[]) => events.map((e) => e.type);

/** Turn 3 (attacks allowed), Battle Phase, player 0 to act. */
const battle = (setup: FixtureSetup): GameState => ({
  ...fixtureState(setup),
  turnCount: 3,
  phase: 'Battle',
});

const attack = (attackerInstanceId: string, targetInstanceId: string): DeclareAttackAction => ({
  type: 'DeclareAttack',
  payload: { playerIndex: 0, attackerInstanceId, targetInstanceId },
});

/** Replaces player 0's monster in `zone` (e.g. to stamp summonedTurn). */
function withMyMonster(state: GameState, zone: number, card: CardInstance): GameState {
  const p0 = state.players[0];
  const monsterZones = p0.board.monsterZones.map((c, i) =>
    i === zone ? card : c,
  ) as unknown as PlayerState['board']['monsterZones'];
  return { ...state, players: [{ ...p0, board: { ...p0.board, monsterZones } }, state.players[1]] };
}

describe('FlipSummon — the action', () => {
  it('turns a face-down monster face-up in Attack Position, without using the Normal Summon', () => {
    const before = fixtureState({ myMonsters: [[0, 'M1', 'DefenseDown']] });
    const { state, events } = applyAction(deepFreeze(before), flip(), fixtureCtx);
    expect(state.players[0].board.monsterZones[0]).toEqual({
      instanceId: 'm0-0',
      definitionId: 'M1',
      ownerIndex: 0,
      position: 'Attack',
      positionChangedTurn: before.turnCount,
    });
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(false);
    expect(state.version).toBe(before.version + 1);
    expect(events).toEqual([
      {
        type: 'FlipSummoned',
        playerIndex: 0,
        instanceId: 'm0-0',
        definitionId: 'M1',
        zoneIndex: 0,
      },
    ]);
  });

  it('keeps the Normal Summon available afterwards', () => {
    const { state } = run({ hand: ['M2'], myMonsters: [[0, 'M1', 'DefenseDown']] });
    const summoned = applyAction(
      state,
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 1 } },
      fixtureCtx,
    );
    expect(summoned.state.players[0].board.monsterZones[1]?.instanceId).toBe('h0');
  });

  it('cannot change position again this turn, but may attack (it was Set on an earlier turn) [RULE]', () => {
    const start = { ...fixtureState({ myMonsters: [[0, 'M1', 'DefenseDown']] }), turnCount: 3 };
    const flipped = applyAction(start, flip(), fixtureCtx).state;
    expectEngineError(
      () =>
        applyAction(
          flipped,
          {
            type: 'ChangePosition',
            payload: { playerIndex: 0, cardInstanceId: 'm0-0', toPosition: 'DefenseUp' },
          },
          fixtureCtx,
        ),
      'POSITION_ALREADY_CHANGED',
    );
    const inBattle = applyAction(
      flipped,
      { type: 'EndPhase', payload: { playerIndex: 0 } },
      fixtureCtx,
    ).state;
    const direct = applyAction(
      inBattle,
      { type: 'DeclareAttack', payload: { playerIndex: 0, attackerInstanceId: 'm0-0' } },
      fixtureCtx,
    );
    expect(direct.events.find((e) => e.type === 'DamageDealt')).toMatchObject({ amount: 1000 });
  });

  it('rejects a face-up monster (MONSTER_FACE_UP), a monster Set this turn, a Spell/Trap, other cards', () => {
    expectEngineError(() => run({ myMonsters: [[0, 'M1', 'Attack']] }), 'MONSTER_FACE_UP');
    expectEngineError(() => run({ myMonsters: [[0, 'M1', 'DefenseUp']] }), 'MONSTER_FACE_UP');
    const setNow = withMyMonster(fixtureState(), 0, {
      instanceId: 'm0-0',
      definitionId: 'M1',
      ownerIndex: 0,
      position: 'DefenseDown',
      summonedTurn: 1,
    });
    expectEngineError(() => applyAction(setNow, flip(), fixtureCtx), 'SUMMONED_THIS_TURN');
    expectEngineError(() => run({ mySpellTraps: [[0, 'TRAP']] }, flip('ms-0')), 'NOT_A_MONSTER');
    expectEngineError(
      () => run({ oppMonsters: [[0, 'M1', 'DefenseDown']] }, flip('o0-0')),
      'CARD_NOT_ON_FIELD',
    );
    expectEngineError(() => run({ hand: ['M1'] }, flip('h0')), 'CARD_NOT_ON_FIELD');
  });

  it('rejects outside the Main Phases, off-turn, with a prompt pending, after the duel, in a chain window', () => {
    const setup: FixtureSetup = { myMonsters: [[0, 'M1', 'DefenseDown']] };
    const base = fixtureState(setup);
    expectEngineError(
      () => applyAction({ ...base, phase: 'Battle' }, flip(), fixtureCtx),
      'WRONG_PHASE',
    );
    expectEngineError(
      () => applyAction({ ...base, turnPlayerIndex: 1 }, flip(), fixtureCtx),
      'NOT_TURN_PLAYER',
    );
    expectEngineError(
      () =>
        applyAction(
          {
            ...base,
            pendingPrompt: {
              promptId: 'x',
              playerIndex: 0,
              kind: 'DiscardToHandLimit',
              payload: {},
            },
          },
          flip(),
          fixtureCtx,
        ),
      'PENDING_PROMPT',
    );
    expectEngineError(
      () => applyAction({ ...base, winnerIndex: 1 }, flip(), fixtureCtx),
      'DUEL_ENDED',
    );
    expectEngineError(
      () =>
        applyAction(
          {
            ...base,
            chainWindow: { priorityPlayer: 1, passCount: 0, reactionTo: { kind: 'Summon' } },
          },
          flip(),
          fixtureCtx,
        ),
      'CHAIN_WINDOW_OPEN',
    );
  });

  it('opens the Summon reaction window for an opponent holding a Set Trap (task 3.4c)', () => {
    const { state } = run({
      myMonsters: [[0, 'M1', 'DefenseDown']],
      oppSpellTraps: [[0, 'TRAP_BURN']],
    });
    expect(state.chainWindow).toEqual({
      priorityPlayer: 1,
      passCount: 0,
      reactionTo: { kind: 'Summon' },
    });
  });

  it('legalActions list FlipSummon for face-down monsters only', () => {
    const state = fixtureState({
      myMonsters: [
        [0, 'M1', 'DefenseDown'],
        [1, 'M2', 'Attack'],
      ],
    });
    const flips = getLegalActions(state, 0, fixtureCtx).filter((a) => a.type === 'FlipSummon');
    expect(flips).toEqual([flip('m0-0')]);
  });
});

describe('OnFlip — Flip Summon', () => {
  it('a mandatory OnFlip goes on the chain and resolves (400 to the opponent)', () => {
    const before = fixtureState({ myMonsters: [[0, 'FLIP_BURN', 'DefenseDown']] });
    const { state, events } = applyAction(deepFreeze(before), flip(), fixtureCtx);
    expect(types(events)).toEqual([
      'FlipSummoned',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 400);
  });

  it('an optional OnFlip asks its owner (TriggerActivation)', () => {
    const { state } = run({
      myMonsters: [[0, 'FLIP_KILL', 'DefenseDown']],
      oppMonsters: [[0, 'M1']],
    });
    expect(state.pendingPrompt).toMatchObject({
      kind: 'TriggerActivation',
      playerIndex: 0,
      payload: { optional: true, candidateInstanceIds: ['o0-0'], count: 1 },
    });
  });

  it('a Flip Summon is a Summon: the monster’s OnSummon fires too [RULE]', () => {
    const before = fixtureState({ myMonsters: [[0, 'SUM_BURN', 'DefenseDown']] });
    const { state } = applyAction(deepFreeze(before), flip(), fixtureCtx);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 300);
  });
});

describe('OnFlip — flipped by an attack', () => {
  it('fires even when the monster is destroyed by that battle (from the graveyard), after damage [RULE]', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[0, 'FLIP_BURN', 'DefenseDown']],
    });
    const { state, events } = applyAction(deepFreeze(before), attack('m0-0', 'o0-0'), fixtureCtx);
    expect(types(events)).toEqual([
      'AttackDeclared',
      'MonsterFlipped',
      'MonsterDestroyed',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(events.find((e) => e.type === 'DamageDealt')).toMatchObject({
      playerIndex: 0,
      amount: 400,
    });
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints - 400);
  });

  it('fires from the Monster Zone when the monster survives', () => {
    const before = battle({
      myMonsters: [[0, 'M1']],
      oppMonsters: [[0, 'FLIP_BURN', 'DefenseDown']],
    });
    const { state, events } = applyAction(deepFreeze(before), attack('m0-0', 'o0-0'), fixtureCtx);
    expect(state.players[1].board.monsterZones[0]).toMatchObject({ position: 'DefenseUp' });
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints - 400);
    expect(types(events)).not.toContain('MonsterDestroyed');
  });

  it('OnFlip and OnDestroyed of the same card: event order, flip first [ASSUMED G15]', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[0, 'FLIP_DES', 'DefenseDown']],
    });
    const { events } = applyAction(deepFreeze(before), attack('m0-0', 'o0-0'), fixtureCtx);
    const links = events.filter((e) => e.type === 'ChainLinkAdded');
    expect(links.map((l) => ('effectId' in l ? l.effectId : null))).toEqual(['e1', 'e2']);
  });

  it('a face-up monster that is attacked does not fire OnFlip', () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[0, 'FLIP_BURN', 'DefenseUp']],
    });
    const { events } = applyAction(deepFreeze(before), attack('m0-0', 'o0-0'), fixtureCtx);
    expect(types(events)).not.toContain('EffectActivated');
  });
});

describe('collectTriggers — flips', () => {
  it('FlipSummoned fires OnFlip and OnSummon; MonsterFlipped only OnFlip', () => {
    const state = fixtureState({
      myMonsters: [
        [0, 'FLIP_BURN', 'Attack'],
        [1, 'SUM_BURN', 'Attack'],
      ],
    });
    const summonQueue = collectTriggers(
      state,
      [
        {
          type: 'FlipSummoned',
          playerIndex: 0,
          instanceId: 'm0-0',
          definitionId: 'FLIP_BURN',
          zoneIndex: 0,
        },
        {
          type: 'FlipSummoned',
          playerIndex: 0,
          instanceId: 'm0-1',
          definitionId: 'SUM_BURN',
          zoneIndex: 1,
        },
      ],
      fixtureCtx,
    );
    expect(summonQueue.map((t) => t.instanceId)).toEqual(['m0-0', 'm0-1']);
    expect(summonQueue.every((t) => t.source.zone === 'MonsterZone')).toBe(true);
    const flippedQueue = collectTriggers(
      state,
      [
        {
          type: 'MonsterFlipped',
          ownerIndex: 0,
          instanceId: 'm0-0',
          definitionId: 'FLIP_BURN',
          zoneIndex: 0,
        },
        {
          type: 'MonsterFlipped',
          ownerIndex: 0,
          instanceId: 'm0-1',
          definitionId: 'SUM_BURN',
          zoneIndex: 1,
        },
      ],
      fixtureCtx,
    );
    expect(flippedQueue.map((t) => t.instanceId)).toEqual(['m0-0']);
  });
});
