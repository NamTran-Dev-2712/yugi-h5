import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '@yugi/shared';
import { applyAction } from '../../apply-action.js';
import type { Action, ActionContext, ChangePositionAction, EndPhaseAction } from '../types.js';
import type { CardInstance, CardPosition, GameState, Phase } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';

const DEFS: Record<string, CardDefinition> = {
  M4: {
    id: 'M4',
    kind: 'Monster',
    name: { vi: 'Test M4', en: 'Test M4' },
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level: 4,
    atk: 1000,
    def: 1000,
  },
  M5: {
    id: 'M5',
    kind: 'Monster',
    name: { vi: 'Test M5', en: 'Test M5' },
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level: 5,
    atk: 1000,
    def: 1000,
  },
  SPELL: {
    id: 'SPELL',
    kind: 'Spell',
    name: { vi: 'Test Spell', en: 'Test Spell' },
    subType: 'Normal',
  },
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
  /** Player 0's monster zones: instance id `t<zone>` with this definition id. Default: one M4 in zone 0. */
  own?: Five<Slot>;
  /** Position per own zone (default 'Attack'). */
  positions?: Partial<Record<number, CardPosition>>;
  /** Turn stamps per own zone. */
  marks?: Partial<Record<number, Marks>>;
  /** Player 1's monster zones: instance id `o<zone>`. */
  opp?: Five<Slot>;
  hand?: string[];
  ownGrave?: string[];
  /** Player 0's spell/trap zone 0 holds this definition id (instance `s0`). */
  spellZone0?: string;
  phase?: Phase;
}

function setup({
  own = ['M4', null, null, null, null],
  positions = {},
  marks = {},
  opp = EMPTY,
  hand = [],
  ownGrave = [],
  spellZone0,
  phase = 'Main1',
}: Setup = {}): GameState {
  const started = applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed: 'seed-position',
      playerIds: ['alice', 'bob'],
      deckLists: [
        Array.from({ length: 40 }, (_, i) => `D-${i}`),
        Array.from({ length: 40 }, (_, i) => `D-${i}`),
      ],
    },
  }).state;
  const p0 = started.players[0];
  const p1 = started.players[1];
  const ownZones = own.map((id, i) =>
    id === null ? null : card(`t${i}`, id, 0, positions[i] ?? 'Attack', marks[i]),
  ) as unknown as GameState['players'][0]['board']['monsterZones'];
  const oppZones = opp.map((id, i) =>
    id === null ? null : card(`o${i}`, id, 1, 'Attack'),
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
    players: [
      {
        ...p0,
        hand: hand.map((id, i) => card(`h${i}`, id, 0, null)),
        graveyard: ownGrave.map((id, i) => card(`g${i}`, id, 0, null)),
        board: { ...p0.board, monsterZones: ownZones, spellTrapZones },
      },
      { ...p1, board: { ...p1.board, monsterZones: oppZones } },
    ],
  };
}

const change = (
  cardInstanceId: string,
  toPosition: CardPosition,
  playerIndex: 0 | 1 = 0,
): Action => ({
  type: 'ChangePosition',
  // Wider than the payload type on purpose: lets tests send DefenseDown to hit the runtime guard.
  payload: {
    playerIndex,
    cardInstanceId,
    toPosition: toPosition as ChangePositionAction['payload']['toPosition'],
  },
});

const endPhase = (state: GameState): EndPhaseAction => ({
  type: 'EndPhase',
  payload: { playerIndex: state.turnPlayerIndex },
});

/** Ends phases until it is player 0's Main1 again in a later turn (through the opponent's whole turn). */
function nextOwnMain1(state: GameState): GameState {
  let s = state;
  const startTurn = s.turnCount;
  do {
    s = applyAction(s, endPhase(s)).state;
  } while (!(s.turnCount > startTurn && s.turnPlayerIndex === 0 && s.phase === 'Main1'));
  return s;
}

function totalCards(state: GameState, playerIndex: 0 | 1): number {
  const p = state.players[playerIndex];
  const board = [...p.board.monsterZones, ...p.board.spellTrapZones, p.board.fieldZone].filter(
    (c) => c !== null,
  );
  return p.hand.length + board.length + p.deck.length + p.graveyard.length;
}

const run = (state: GameState, action: Action) => applyAction(state, action, ctx);

describe('ChangePosition — happy path', () => {
  it.each<{ phase: Phase; from: CardPosition; to: CardPosition }>([
    { phase: 'Main1', from: 'Attack', to: 'DefenseUp' },
    { phase: 'Main1', from: 'DefenseUp', to: 'Attack' },
    { phase: 'Main2', from: 'Attack', to: 'DefenseUp' },
    { phase: 'Main2', from: 'DefenseUp', to: 'Attack' },
  ])('changes $from → $to in $phase', ({ phase, from, to }) => {
    const before = setup({ phase, positions: { 0: from } });
    const { state, events } = run(before, change('t0', to));
    expect(state.players[0].board.monsterZones[0]?.position).toBe(to);
    expect(events).toEqual([
      {
        type: 'PositionChanged',
        playerIndex: 0,
        instanceId: 't0',
        definitionId: 'M4',
        zoneIndex: 0,
        from,
        to,
      },
    ]);
    expect(state.version).toBe(before.version + 1);
  });

  it('works on any zone index and leaves other monsters alone', () => {
    const before = setup({ own: ['M4', null, 'M5', null, 'M4'], positions: { 4: 'DefenseUp' } });
    const { state } = run(before, change('t4', 'Attack'));
    expect(state.players[0].board.monsterZones.map((c) => c?.position ?? null)).toEqual([
      'Attack',
      null,
      'Attack',
      null,
      'Attack',
    ]);
    expect(state.players[0].board.monsterZones[4]?.instanceId).toBe('t4');
  });

  it('stamps the change so the same monster cannot change again this turn', () => {
    const before = setup();
    const { state } = run(before, change('t0', 'DefenseUp'));
    expect(state.players[0].board.monsterZones[0]?.positionChangedTurn).toBe(before.turnCount);
  });
});

describe('ChangePosition — across turns', () => {
  it('a monster Summoned in turn N can change on its owner’s next turn', () => {
    let state = setup({ own: EMPTY, hand: ['M4'] });
    state = run(state, {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 0 },
    }).state;
    expectEngineError(() => run(state, change('h0', 'DefenseUp')), 'SUMMONED_THIS_TURN');
    state = nextOwnMain1(state);
    expect(state.turnCount).toBeGreaterThan(1);
    const { state: after } = run(state, change('h0', 'DefenseUp'));
    expect(after.players[0].board.monsterZones[0]?.position).toBe('DefenseUp');
  });

  it('a Set monster is face-down, so ChangePosition is still rejected on later turns', () => {
    let state = setup({ own: EMPTY, hand: ['M4'] });
    state = run(state, {
      type: 'SetMonster',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 0 },
    }).state;
    state = nextOwnMain1(state);
    expectEngineError(() => run(state, change('h0', 'Attack')), 'MONSTER_FACE_DOWN');
  });

  it('a Tribute-Summoned monster cannot change that turn but can on the next one', () => {
    let state = setup({ own: ['M4', null, null, null, null], hand: ['M5'] });
    state = run(state, {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 1, tributeInstanceIds: ['t0'] },
    }).state;
    expectEngineError(() => run(state, change('h0', 'DefenseUp')), 'SUMMONED_THIS_TURN');
    state = nextOwnMain1(state);
    expect(
      run(state, change('h0', 'DefenseUp')).state.players[0].board.monsterZones[1]?.position,
    ).toBe('DefenseUp');
  });

  it('the once-per-turn limit expires: changed in turn N, allowed again on the owner’s next turn', () => {
    let state = setup();
    state = run(state, change('t0', 'DefenseUp')).state;
    expectEngineError(() => run(state, change('t0', 'Attack')), 'POSITION_ALREADY_CHANGED');
    state = nextOwnMain1(state);
    state = run(state, change('t0', 'Attack')).state;
    expect(state.players[0].board.monsterZones[0]?.position).toBe('Attack');
  });

  it('the limit is still active in Main2 of the same turn, and does not leak into the opponent’s turn', () => {
    let state = setup({ phase: 'Main1' });
    state = run(state, change('t0', 'DefenseUp')).state;
    state = applyAction(state, endPhase(state)).state; // Battle
    state = applyAction(state, endPhase(state)).state; // Main2
    expect(state.phase).toBe('Main2');
    expectEngineError(() => run(state, change('t0', 'Attack')), 'POSITION_ALREADY_CHANGED');
  });

  it('an attackedTurn stamp from an earlier turn no longer blocks', () => {
    let state = setup({ marks: { 0: { attackedTurn: 1 } } });
    expectEngineError(() => run(state, change('t0', 'DefenseUp')), 'ATTACKED_THIS_TURN');
    state = nextOwnMain1(state);
    expect(() => run(state, change('t0', 'DefenseUp'))).not.toThrow();
  });
});

describe('ChangePosition — rejections (by code)', () => {
  it.each<Phase>(['Draw', 'Standby', 'Battle', 'End'])('rejects in %s phase', (phase) => {
    expectEngineError(() => run(setup({ phase }), change('t0', 'DefenseUp')), 'WRONG_PHASE');
  });

  it('rejects once the duel has a winner', () => {
    expectEngineError(
      () => run({ ...setup(), winnerIndex: 1 }, change('t0', 'DefenseUp')),
      'DUEL_ENDED',
    );
  });

  it('rejects while a prompt is pending', () => {
    const state: GameState = {
      ...setup(),
      pendingPrompt: { promptId: 'p', playerIndex: 0, kind: 'x', payload: null },
    };
    expectEngineError(() => run(state, change('t0', 'DefenseUp')), 'PENDING_PROMPT');
  });

  it('rejects when the caller is not the turn player', () => {
    expectEngineError(
      () => run(setup({ opp: ['M4', null, null, null, null] }), change('o0', 'DefenseUp', 1)),
      'NOT_TURN_PLAYER',
    );
  });

  it('rejects face-down monsters (flipping is Flip Summon, a later task)', () => {
    const state = setup({ positions: { 0: 'DefenseDown' } });
    expectEngineError(() => run(state, change('t0', 'Attack')), 'MONSTER_FACE_DOWN');
    expectEngineError(() => run(state, change('t0', 'DefenseUp')), 'MONSTER_FACE_DOWN');
  });

  it.each<[CardPosition, CardPosition]>([
    ['Attack', 'Attack'],
    ['DefenseUp', 'DefenseUp'],
  ])('rejects %s → %s (same position)', (from, to) => {
    expectEngineError(
      () => run(setup({ positions: { 0: from } }), change('t0', to)),
      'SAME_POSITION',
    );
  });

  it('rejects a second change in the same turn, including changing back', () => {
    const first = run(setup(), change('t0', 'DefenseUp')).state;
    expectEngineError(() => run(first, change('t0', 'Attack')), 'POSITION_ALREADY_CHANGED');
    expectEngineError(() => run(first, change('t0', 'DefenseUp')), 'SAME_POSITION');
  });

  it('a second, different monster can still change in the same turn', () => {
    const first = run(setup({ own: ['M4', 'M4', null, null, null] }), change('t0', 'DefenseUp'));
    expect(() => run(first.state, change('t1', 'DefenseUp'))).not.toThrow();
  });

  it('rejects a monster Summoned this turn (stamp = current turn)', () => {
    const state = setup({ marks: { 0: { summonedTurn: 1 } } });
    expectEngineError(() => run(state, change('t0', 'DefenseUp')), 'SUMMONED_THIS_TURN');
  });

  it('rejects a monster that attacked this turn (attackedTurn = current turn)', () => {
    const state = setup({ marks: { 0: { attackedTurn: 1 } } });
    expectEngineError(() => run(state, change('t0', 'DefenseUp')), 'ATTACKED_THIS_TURN');
  });

  it('does not treat stamps from earlier turns as "this turn"', () => {
    const base = setup();
    const state: GameState = {
      ...base,
      turnCount: 5,
      players: [
        {
          ...base.players[0],
          board: {
            ...base.players[0].board,
            monsterZones: [
              card('t0', 'M4', 0, 'Attack', {
                summonedTurn: 3,
                positionChangedTurn: 3,
                attackedTurn: 3,
              }),
              null,
              null,
              null,
              null,
            ],
          },
        },
        base.players[1],
      ],
    };
    expect(() => run(state, change('t0', 'DefenseUp'))).not.toThrow();
  });

  it('rejects a card in hand', () => {
    expectEngineError(
      () => run(setup({ hand: ['M4'] }), change('h0', 'DefenseUp')),
      'CARD_NOT_ON_FIELD',
    );
  });

  it('rejects a card in the graveyard', () => {
    expectEngineError(
      () => run(setup({ ownGrave: ['M4'] }), change('g0', 'DefenseUp')),
      'CARD_NOT_ON_FIELD',
    );
  });

  it('rejects the opponent’s monster', () => {
    expectEngineError(
      () => run(setup({ opp: ['M4', null, null, null, null] }), change('o0', 'DefenseUp')),
      'CARD_NOT_ON_FIELD',
    );
  });

  it('rejects an unknown instance id', () => {
    expectEngineError(() => run(setup(), change('nope', 'DefenseUp')), 'CARD_NOT_ON_FIELD');
  });

  it('rejects a non-monster card on the field', () => {
    expectEngineError(
      () => run(setup({ spellZone0: 'SPELL' }), change('s0', 'DefenseUp')),
      'NOT_A_MONSTER',
    );
  });

  it('rejects DefenseDown as a target (only Attack/DefenseUp are legal targets)', () => {
    expectEngineError(() => run(setup(), change('t0', 'DefenseDown')), 'INVALID_POSITION');
  });
});

describe('ChangePosition — Normal Summon right is independent', () => {
  it('changing position first does not stop a later Normal Summon', () => {
    let state = setup({ hand: ['M4'] });
    state = run(state, change('t0', 'DefenseUp')).state;
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(false);
    state = run(state, {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 1 },
    }).state;
    expect(state.players[0].board.monsterZones[1]?.instanceId).toBe('h0');
  });

  it('a Normal Summon that already happened does not stop changing another monster', () => {
    let state = setup({ hand: ['M4'] });
    state = run(state, {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 1 },
    }).state;
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(true);
    state = run(state, change('t0', 'DefenseUp')).state;
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(true);
    expect(state.players[0].board.monsterZones[0]?.position).toBe('DefenseUp');
  });
});

describe('ChangePosition — purity and invariants', () => {
  it('does not mutate a deep-frozen input state', () => {
    const before = deepFreeze(setup({ own: ['M4', 'M5', null, null, null] }));
    expect(() => run(before, change('t0', 'DefenseUp'))).not.toThrow();
  });

  it.each<[string, () => GameState, Action]>([
    ['wrong phase', () => setup({ phase: 'Battle' }), change('t0', 'DefenseUp')],
    ['face-down', () => setup({ positions: { 0: 'DefenseDown' } }), change('t0', 'Attack')],
    ['same position', () => setup(), change('t0', 'Attack')],
    [
      'already changed',
      () => setup({ marks: { 0: { positionChangedTurn: 1 } } }),
      change('t0', 'DefenseUp'),
    ],
    ['unknown card', () => setup(), change('nope', 'DefenseUp')],
  ])('a rejected action (%s) leaves the state untouched', (_name, build, action) => {
    const before = deepFreeze(build());
    const snapshot = JSON.stringify(before);
    expect(() => run(before, action)).toThrow();
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('keeps the card count and changes only the targeted monster', () => {
    const before = setup({ own: ['M4', 'M5', 'M4', null, null], hand: ['M4'] });
    const { state } = run(before, change('t1', 'DefenseUp'));
    expect(totalCards(state, 0)).toBe(totalCards(before, 0));
    expect(totalCards(state, 1)).toBe(totalCards(before, 1));
    expect(state.players[1]).toEqual(before.players[1]);
    expect(state.players[0].hand).toEqual(before.players[0].hand);
    expect(state.players[0].graveyard).toEqual(before.players[0].graveyard);
    expect(state.players[0].board.monsterZones[0]).toEqual(before.players[0].board.monsterZones[0]);
    expect(state.players[0].board.monsterZones[2]).toEqual(before.players[0].board.monsterZones[2]);
    expect(state.players[0].board.monsterZones[1]).toEqual({
      ...before.players[0].board.monsterZones[1],
      position: 'DefenseUp',
      positionChangedTurn: before.turnCount,
    });
    expect({ ...state, players: null, version: 0 }).toEqual({
      ...before,
      players: null,
      version: 0,
    });
  });

  it('is deterministic and JSON-serializable', () => {
    const go = () => run(setup(), change('t0', 'DefenseUp'));
    expect(go()).toEqual(go());
    expect(JSON.parse(JSON.stringify(go().state))).toEqual(go().state);
  });
});
