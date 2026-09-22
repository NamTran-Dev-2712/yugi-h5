import { describe, expect, it } from 'vitest';
import type { CardDefinition, RulesetConfig } from '@yugi/shared';
import { applyAction } from '../../apply-action.js';
import type { Action, ActionContext } from '../types.js';
import type { CardInstance, CardPosition, GameState, Phase } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';

const DEFS: Record<string, CardDefinition> = {
  M1000: {
    id: 'M1000',
    kind: 'Monster',
    name: 'Test M1000',
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level: 4,
    atk: 1000,
    def: 1000,
  },
  M2000: {
    id: 'M2000',
    kind: 'Monster',
    name: 'Test M2000',
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level: 4,
    atk: 2000,
    def: 500,
  },
  M500: {
    id: 'M500',
    kind: 'Monster',
    name: 'Test M500',
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level: 4,
    atk: 500,
    def: 1500,
  },
  SPELL: { id: 'SPELL', kind: 'Spell', name: 'Test Spell', subType: 'Normal' },
};

const ctx: ActionContext = { cardDefinitions: (id) => DEFS[id] };

type Marks = Pick<CardInstance, 'summonedTurn' | 'positionChangedTurn' | 'attackedTurn'>;

function card(
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1,
  position: CardPosition | null,
  marks: Marks = {},
): CardInstance {
  return { instanceId, definitionId, position, ownerIndex, ...marks };
}

type Slot = string | null;
type Five<T> = readonly [T, T, T, T, T];
const EMPTY: Five<Slot> = [null, null, null, null, null];

interface Setup {
  /** Player 0's (turn player's) monster zones: instance id `t<zone>`. Default: one M1000 in zone 0, Attack. */
  own?: Five<Slot>;
  ownPositions?: Partial<Record<number, CardPosition>>;
  ownMarks?: Partial<Record<number, Marks>>;
  /** Player 1's (opponent's) monster zones: instance id `o<zone>`. Default: empty field. */
  opp?: Five<Slot>;
  oppPositions?: Partial<Record<number, CardPosition>>;
  hand?: string[];
  spellZone0?: string;
  phase?: Phase;
  /** Defaults to 2, so tests don't trip FIRST_TURN_ATTACK_BANNED unless they mean to. */
  turnCount?: number;
  ruleset?: Partial<RulesetConfig>;
  lifePoints?: readonly [number, number];
}

function setup({
  own = ['M1000', null, null, null, null],
  ownPositions = {},
  ownMarks = {},
  opp = EMPTY,
  oppPositions = {},
  hand = [],
  spellZone0,
  phase = 'Battle',
  turnCount = 2,
  ruleset,
  lifePoints,
}: Setup = {}): GameState {
  const started = applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed: 'seed-attack',
      playerIds: ['alice', 'bob'],
      deckLists: [
        Array.from({ length: 40 }, (_, i) => `D-${i}`),
        Array.from({ length: 40 }, (_, i) => `D-${i}`),
      ],
      ...(ruleset ? { ruleset } : {}),
    },
  }).state;
  const p0 = started.players[0];
  const p1 = started.players[1];
  const ownZones = own.map((id, i) =>
    id === null ? null : card(`t${i}`, id, 0, ownPositions[i] ?? 'Attack', ownMarks[i]),
  ) as unknown as GameState['players'][0]['board']['monsterZones'];
  const oppZones = opp.map((id, i) =>
    id === null ? null : card(`o${i}`, id, 1, oppPositions[i] ?? 'Attack'),
  ) as unknown as GameState['players'][0]['board']['monsterZones'];
  const spellTrapZones = [
    spellZone0 ? card('s0', spellZone0, 0, 'DefenseDown') : null,
    null,
    null,
    null,
    null,
  ] as unknown as GameState['players'][0]['board']['spellTrapZones'];
  return {
    ...started,
    phase,
    turnCount,
    players: [
      {
        ...p0,
        hand: hand.map((id, i) => card(`h${i}`, id, 0, null)),
        board: { ...p0.board, monsterZones: ownZones, spellTrapZones },
        lifePoints: lifePoints?.[0] ?? p0.lifePoints,
      },
      {
        ...p1,
        board: { ...p1.board, monsterZones: oppZones },
        lifePoints: lifePoints?.[1] ?? p1.lifePoints,
      },
    ],
  };
}

const attack = (
  attackerInstanceId: string,
  targetInstanceId?: string | null,
  playerIndex: 0 | 1 = 0,
): Action =>
  targetInstanceId === undefined
    ? { type: 'DeclareAttack', payload: { playerIndex, attackerInstanceId } }
    : { type: 'DeclareAttack', payload: { playerIndex, attackerInstanceId, targetInstanceId } };

const run = (state: GameState, action: Action) => applyAction(state, action, ctx);

describe('DeclareAttack — direct attack', () => {
  it('deals damage equal to the attacker ATK and stamps attackedTurn', () => {
    const before = setup();
    const { state, events } = run(before, attack('t0'));
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 1000);
    expect(state.players[0].board.monsterZones[0]?.attackedTurn).toBe(before.turnCount);
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: null },
      { type: 'DamageDealt', playerIndex: 1, amount: 1000 },
    ]);
  });

  it('clamps life points at 0, never negative', () => {
    const before = setup({ own: ['M2000', null, null, null, null], lifePoints: [8000, 300] });
    const { state } = run(before, attack('t0'));
    expect(state.players[1].lifePoints).toBe(0);
  });

  it('uses the attacker ATK, not DEF, for damage (asymmetric stats)', () => {
    const before = setup({ own: ['M2000', null, null, null, null] });
    const { state } = run(before, attack('t0'));
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 2000);
  });

  it('rejects a direct attack when the opponent has a face-up monster', () => {
    const before = setup({ opp: ['M500', null, null, null, null] });
    expectEngineError(() => run(before, attack('t0')), 'MUST_TARGET_MONSTER');
  });

  it('rejects a direct attack when the opponent has only a face-down monster (must target-and-flip it instead, task 1.8)', () => {
    const before = setup({
      opp: ['M500', null, null, null, null],
      oppPositions: { 0: 'DefenseDown' },
    });
    expectEngineError(() => run(before, attack('t0')), 'MUST_TARGET_MONSTER');
  });
});

describe('DeclareAttack — ATK vs ATK', () => {
  it('attacker wins: defender destroyed, opponent loses the ATK difference', () => {
    const before = setup({ opp: ['M500', null, null, null, null] });
    const { state, events } = run(before, attack('t0', 'o0'));
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(state.players[1].graveyard).toEqual([{ ...card('o0', 'M500', 1, null) }]);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 500);
    expect(state.players[0].board.monsterZones[0]?.attackedTurn).toBe(before.turnCount);
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: 'o0' },
      {
        type: 'MonsterDestroyed',
        ownerIndex: 1,
        instanceId: 'o0',
        definitionId: 'M500',
        zoneIndex: 0,
      },
      { type: 'DamageDealt', playerIndex: 1, amount: 500 },
    ]);
  });

  it('attacker wins: uses the attacker ATK, not DEF, for the difference (asymmetric stats)', () => {
    const before = setup({
      own: ['M2000', null, null, null, null],
      opp: ['M500', null, null, null, null],
    });
    const { state } = run(before, attack('t0', 'o0'));
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints - 1500);
  });

  it('attacker loses: attacker destroyed, its owner loses the ATK difference', () => {
    const before = setup({ opp: ['M2000', null, null, null, null] });
    const { state, events } = run(before, attack('t0', 'o0'));
    expect(state.players[0].board.monsterZones[0]).toBeNull();
    expect(state.players[0].graveyard).toEqual([{ ...card('t0', 'M1000', 0, null) }]);
    expect(state.players[1].board.monsterZones[0]?.instanceId).toBe('o0');
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints - 1000);
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: 'o0' },
      {
        type: 'MonsterDestroyed',
        ownerIndex: 0,
        instanceId: 't0',
        definitionId: 'M1000',
        zoneIndex: 0,
      },
      { type: 'DamageDealt', playerIndex: 0, amount: 1000 },
    ]);
  });

  it('tie: both destroyed, nobody loses life points', () => {
    const before = setup({ opp: ['M1000', null, null, null, null] });
    const { state, events } = run(before, attack('t0', 'o0'));
    expect(state.players[0].board.monsterZones[0]).toBeNull();
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: 'o0' },
      {
        type: 'MonsterDestroyed',
        ownerIndex: 1,
        instanceId: 'o0',
        definitionId: 'M1000',
        zoneIndex: 0,
      },
      {
        type: 'MonsterDestroyed',
        ownerIndex: 0,
        instanceId: 't0',
        definitionId: 'M1000',
        zoneIndex: 0,
      },
    ]);
  });
});

describe('DeclareAttack — ATK vs DEF (Defense Position target)', () => {
  it('ATK > DEF: defender destroyed, nobody loses life points', () => {
    const before = setup({
      opp: ['M2000', null, null, null, null],
      oppPositions: { 0: 'DefenseUp' },
    });
    const { state, events } = run(before, attack('t0', 'o0'));
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(state.players[1].graveyard).toEqual([{ ...card('o0', 'M2000', 1, null) }]);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
    expect(state.players[0].board.monsterZones[0]?.attackedTurn).toBe(before.turnCount);
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: 'o0' },
      {
        type: 'MonsterDestroyed',
        ownerIndex: 1,
        instanceId: 'o0',
        definitionId: 'M2000',
        zoneIndex: 0,
      },
    ]);
  });

  it('ATK < DEF: nobody destroyed, attacker owner loses the difference', () => {
    const before = setup({
      opp: ['M500', null, null, null, null],
      oppPositions: { 0: 'DefenseUp' },
    });
    const { state, events } = run(before, attack('t0', 'o0'));
    expect(state.players[0].board.monsterZones[0]?.instanceId).toBe('t0');
    expect(state.players[1].board.monsterZones[0]?.instanceId).toBe('o0');
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints - 500);
    expect(state.players[0].board.monsterZones[0]?.attackedTurn).toBe(before.turnCount);
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: 'o0' },
      { type: 'DamageDealt', playerIndex: 0, amount: 500 },
    ]);
  });

  it('[ASSUMED] ATK == DEF: nobody destroyed, no damage', () => {
    const before = setup({
      opp: ['M1000', null, null, null, null],
      oppPositions: { 0: 'DefenseUp' },
    });
    const { state, events } = run(before, attack('t0', 'o0'));
    expect(state.players[0].board.monsterZones[0]?.instanceId).toBe('t0');
    expect(state.players[1].board.monsterZones[0]?.instanceId).toBe('o0');
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: 'o0' },
    ]);
  });
});

describe('DeclareAttack — win condition (LP <= 0)', () => {
  it('direct attack that brings LP to exactly 0 ends the duel for the attacker', () => {
    const before = setup({ lifePoints: [8000, 1000] });
    const { state, events } = run(before, attack('t0'));
    expect(state.players[1].lifePoints).toBe(0);
    expect(state.winnerIndex).toBe(0);
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: null },
      { type: 'DamageDealt', playerIndex: 1, amount: 1000 },
      { type: 'DuelEnded', winnerIndex: 0, reason: 'LP_ZERO' },
    ]);
  });

  it('overkill damage (LP would go negative) still clamps to 0 and still ends the duel', () => {
    const before = setup({ own: ['M2000', null, null, null, null], lifePoints: [8000, 500] });
    const { state, events } = run(before, attack('t0'));
    expect(state.players[1].lifePoints).toBe(0);
    expect(state.winnerIndex).toBe(0);
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: null },
      { type: 'DamageDealt', playerIndex: 1, amount: 2000 },
      { type: 'DuelEnded', winnerIndex: 0, reason: 'LP_ZERO' },
    ]);
  });

  it('ATK vs ATK: the attacker itself dying to 0 LP ends the duel for the defender', () => {
    const before = setup({ opp: ['M2000', null, null, null, null], lifePoints: [1000, 8000] });
    const { state, events } = run(before, attack('t0', 'o0'));
    expect(state.players[0].lifePoints).toBe(0);
    expect(state.winnerIndex).toBe(1);
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: 'o0' },
      {
        type: 'MonsterDestroyed',
        ownerIndex: 0,
        instanceId: 't0',
        definitionId: 'M1000',
        zoneIndex: 0,
      },
      { type: 'DamageDealt', playerIndex: 0, amount: 1000 },
      { type: 'DuelEnded', winnerIndex: 1, reason: 'LP_ZERO' },
    ]);
  });

  it('ATK vs DEF: self-damage from a weaker attack ending at 0 LP ends the duel for the defender', () => {
    const before = setup({
      opp: ['M500', null, null, null, null],
      oppPositions: { 0: 'DefenseUp' },
      lifePoints: [500, 8000],
    });
    const { state, events } = run(before, attack('t0', 'o0'));
    expect(state.players[0].lifePoints).toBe(0);
    expect(state.winnerIndex).toBe(1);
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: 'o0' },
      { type: 'DamageDealt', playerIndex: 0, amount: 500 },
      { type: 'DuelEnded', winnerIndex: 1, reason: 'LP_ZERO' },
    ]);
  });

  it('does not end the duel when nobody reaches 0 LP', () => {
    const before = setup();
    const { state, events } = run(before, attack('t0'));
    expect(state.winnerIndex).toBeNull();
    expect(events.some((e) => e.type === 'DuelEnded')).toBe(false);
  });

  it('[ASSUMED] both players at 0 LP in the same action is a draw', () => {
    // Contrived fixture: the opponent's LP is set to 0 directly (normal play could never reach
    // this state while winnerIndex is still null, since DUEL_ENDED would already reject further
    // actions) so the simultaneous-zero branch can be exercised without a crash.
    const before = setup({
      opp: ['M500', null, null, null, null],
      oppPositions: { 0: 'DefenseUp' },
      lifePoints: [500, 0],
    });
    const { state, events } = run(before, attack('t0', 'o0'));
    expect(state.players[0].lifePoints).toBe(0);
    expect(state.players[1].lifePoints).toBe(0);
    expect(state.winnerIndex).toBe('draw');
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: 'o0' },
      { type: 'DamageDealt', playerIndex: 0, amount: 500 },
      { type: 'DuelEnded', winnerIndex: null, reason: 'LP_ZERO' },
    ]);
  });

  it('rejects any further action once the duel has ended this way', () => {
    const before = setup({ lifePoints: [8000, 1000] });
    const ended = run(before, attack('t0')).state;
    expect(ended.winnerIndex).toBe(0);
    expectEngineError(() => run(ended, attack('t0')), 'DUEL_ENDED');
  });
});

describe('DeclareAttack — rejections (by code)', () => {
  it.each<Phase>(['Draw', 'Standby', 'Main1', 'Main2', 'End'])('rejects in %s phase', (phase) => {
    expectEngineError(() => run(setup({ phase }), attack('t0')), 'WRONG_PHASE');
  });

  it('rejects once the duel has a winner', () => {
    expectEngineError(() => run({ ...setup(), winnerIndex: 1 }, attack('t0')), 'DUEL_ENDED');
  });

  it('rejects while a prompt is pending', () => {
    const state: GameState = {
      ...setup(),
      pendingPrompt: { promptId: 'p', playerIndex: 0, kind: 'x', payload: null },
    };
    expectEngineError(() => run(state, attack('t0')), 'PENDING_PROMPT');
  });

  it('rejects when the caller is not the turn player', () => {
    expectEngineError(
      () => run(setup({ opp: ['M1000', null, null, null, null] }), attack('o0', null, 1)),
      'NOT_TURN_PLAYER',
    );
  });

  it('rejects declaring an attack on turn 1 by default', () => {
    expectEngineError(() => run(setup({ turnCount: 1 }), attack('t0')), 'FIRST_TURN_ATTACK_BANNED');
  });

  it('allows turn 1 attacks when ruleset.firstTurnAttack is true', () => {
    const before = setup({ turnCount: 1, ruleset: { firstTurnAttack: true } });
    expect(() => run(before, attack('t0'))).not.toThrow();
  });

  it('rejects a card in hand', () => {
    expectEngineError(() => run(setup({ hand: ['M1000'] }), attack('h0')), 'CARD_NOT_ON_FIELD');
  });

  it('rejects the opponent’s monster as the attacker', () => {
    expectEngineError(
      () => run(setup({ opp: ['M1000', null, null, null, null] }), attack('o0')),
      'CARD_NOT_ON_FIELD',
    );
  });

  it('rejects an unknown instance id', () => {
    expectEngineError(() => run(setup(), attack('nope')), 'CARD_NOT_ON_FIELD');
  });

  it('rejects a non-monster card as the attacker', () => {
    expectEngineError(() => run(setup({ spellZone0: 'SPELL' }), attack('s0')), 'NOT_A_MONSTER');
  });

  it('rejects a face-down attacker', () => {
    const state = setup({ ownPositions: { 0: 'DefenseDown' } });
    expectEngineError(() => run(state, attack('t0')), 'MONSTER_FACE_DOWN');
  });

  it('rejects an attacker in Defense Position', () => {
    const state = setup({ ownPositions: { 0: 'DefenseUp' } });
    expectEngineError(() => run(state, attack('t0')), 'ATTACKER_IN_DEFENSE_POSITION');
  });

  it('rejects a monster that already attacked this turn', () => {
    const state = setup({ ownMarks: { 0: { attackedTurn: 2 } } });
    expectEngineError(() => run(state, attack('t0')), 'ATTACKED_THIS_TURN');
  });

  it('rejects a monster Summoned or Set this turn', () => {
    const state = setup({ ownMarks: { 0: { summonedTurn: 2 } } });
    expectEngineError(() => run(state, attack('t0')), 'JUST_SUMMONED_CANNOT_ATTACK');
  });

  it('rejects a target id that is not on the opponent’s field, including the attacker’s own instance id', () => {
    const state = setup();
    expectEngineError(() => run(state, attack('t0', 'nope')), 'INVALID_TARGET');
    expectEngineError(() => run(state, attack('t0', 't0')), 'INVALID_TARGET');
  });
});

describe('DeclareAttack — Flip-on-Attack (face-down target)', () => {
  it('flips the target face-up before destroy/damage events, in order', () => {
    const before = setup({
      own: ['M2000', null, null, null, null],
      opp: ['M500', null, null, null, null],
      oppPositions: { 0: 'DefenseDown' },
    });
    const { events } = run(before, attack('t0', 'o0'));
    expect(events).toEqual([
      { type: 'AttackDeclared', playerIndex: 0, attackerInstanceId: 't0', targetInstanceId: 'o0' },
      {
        type: 'MonsterFlipped',
        ownerIndex: 1,
        instanceId: 'o0',
        definitionId: 'M500',
        zoneIndex: 0,
      },
      {
        type: 'MonsterDestroyed',
        ownerIndex: 1,
        instanceId: 'o0',
        definitionId: 'M500',
        zoneIndex: 0,
      },
    ]);
  });

  it('ATK > DEF: flipped defender destroyed, nobody loses life points', () => {
    const before = setup({
      own: ['M2000', null, null, null, null],
      opp: ['M500', null, null, null, null],
      oppPositions: { 0: 'DefenseDown' },
    });
    const { state } = run(before, attack('t0', 'o0'));
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(state.players[1].graveyard).toEqual([{ ...card('o0', 'M500', 1, null) }]);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
  });

  it('ATK < DEF: nobody destroyed, attacker owner loses the difference, target stays face-up in Defense', () => {
    const before = setup({
      opp: ['M500', null, null, null, null],
      oppPositions: { 0: 'DefenseDown' },
    });
    const { state } = run(before, attack('t0', 'o0'));
    expect(state.players[0].board.monsterZones[0]?.instanceId).toBe('t0');
    expect(state.players[1].board.monsterZones[0]).toEqual(card('o0', 'M500', 1, 'DefenseUp'));
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints - 500);
  });

  it('[ASSUMED] ATK == DEF against a flipped target: nobody destroyed, no damage', () => {
    const before = setup({
      opp: ['M1000', null, null, null, null],
      oppPositions: { 0: 'DefenseDown' },
    });
    const { state } = run(before, attack('t0', 'o0'));
    expect(state.players[0].board.monsterZones[0]?.instanceId).toBe('t0');
    expect(state.players[1].board.monsterZones[0]).toEqual(card('o0', 'M1000', 1, 'DefenseUp'));
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints);
    expect(state.players[1].lifePoints).toBe(before.players[1].lifePoints);
  });

  it('a monster the opponent Set this turn is still a valid target when attacked (summonedTurn only blocks its own actions)', () => {
    const base = setup({
      opp: ['M500', null, null, null, null],
      oppPositions: { 0: 'DefenseDown' },
    });
    const before: GameState = {
      ...base,
      players: [
        base.players[0],
        {
          ...base.players[1],
          board: {
            ...base.players[1].board,
            monsterZones: base.players[1].board.monsterZones.map((c, i) =>
              i === 0 && c ? { ...c, summonedTurn: base.turnCount } : c,
            ) as unknown as GameState['players'][1]['board']['monsterZones'],
          },
        },
      ],
    };
    expect(() => run(before, attack('t0', 'o0'))).not.toThrow();
  });
});

describe('DeclareAttack — purity and invariants', () => {
  it('does not mutate a deep-frozen input state', () => {
    const before = deepFreeze(setup({ opp: ['M500', null, null, null, null] }));
    expect(() => run(before, attack('t0', 'o0'))).not.toThrow();
  });

  it('does not mutate a deep-frozen input state when flipping a face-down target', () => {
    const before = deepFreeze(
      setup({ opp: ['M500', null, null, null, null], oppPositions: { 0: 'DefenseDown' } }),
    );
    expect(() => run(before, attack('t0', 'o0'))).not.toThrow();
  });

  it.each<[string, () => GameState, Action]>([
    ['wrong phase', () => setup({ phase: 'Main1' }), attack('t0')],
    ['unknown attacker', () => setup(), attack('nope')],
    ['must target', () => setup({ opp: ['M500', null, null, null, null] }), attack('t0')],
    [
      'must target (face-down)',
      () => setup({ opp: ['M500', null, null, null, null], oppPositions: { 0: 'DefenseDown' } }),
      attack('t0'),
    ],
  ])('a rejected action (%s) leaves both sides of the state untouched', (_name, build, action) => {
    const before = deepFreeze(build());
    const snapshot = JSON.stringify(before);
    expect(() => run(before, action)).toThrow();
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('is deterministic and JSON-serializable', () => {
    const go = () => run(setup({ opp: ['M500', null, null, null, null] }), attack('t0', 'o0'));
    expect(go()).toEqual(go());
    expect(JSON.parse(JSON.stringify(go().state))).toEqual(go().state);
  });
});
