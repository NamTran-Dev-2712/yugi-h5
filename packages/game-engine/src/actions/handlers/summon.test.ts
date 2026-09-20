import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '@yugi/shared';
import { applyAction } from '../../apply-action.js';
import type {
  Action,
  ActionContext,
  EndPhaseAction,
  NormalSummonAction,
  SetMonsterAction,
} from '../types.js';
import type { CardInstance, GameState, Phase } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';

function monster(id: string, level: number): CardDefinition {
  return {
    id,
    kind: 'Monster',
    name: `Test ${id}`,
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level,
    atk: 1000,
    def: 1000,
  };
}

const DEFS: Record<string, CardDefinition> = {
  M1: monster('M1', 1),
  M4: monster('M4', 4),
  M5: monster('M5', 5),
  M6: monster('M6', 6),
  M7: monster('M7', 7),
  SPELL: { id: 'SPELL', kind: 'Spell', name: 'Test Spell', subType: 'Normal' },
  TRAP: { id: 'TRAP', kind: 'Trap', name: 'Test Trap', subType: 'Normal' },
};

const ctx: ActionContext = { cardDefinitions: (id) => DEFS[id] };

function card(instanceId: string, definitionId: string, ownerIndex: 0 | 1 = 0): CardInstance {
  return { instanceId, definitionId, position: null, ownerIndex };
}

/** Duel where player 0 holds `hand` (instance ids h0, h1, ...) and is in `phase` of turn 1. */
function setup(hand: string[] = ['M4', 'M4', 'M1'], phase: Phase = 'Main1'): GameState {
  const started = applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed: 'seed-summon',
      playerIds: ['alice', 'bob'],
      deckLists: [
        Array.from({ length: 40 }, (_, i) => `D-${i}`),
        Array.from({ length: 40 }, (_, i) => `D-${i}`),
      ],
    },
  }).state;
  return {
    ...started,
    phase,
    players: [
      { ...started.players[0], hand: hand.map((id, i) => card(`h${i}`, id)) },
      started.players[1],
    ],
  };
}

const summon = (
  cardInstanceId: string,
  zoneIndex = 0,
  playerIndex: 0 | 1 = 0,
): NormalSummonAction => ({
  type: 'NormalSummon',
  payload: { playerIndex, cardInstanceId, zoneIndex },
});
const setMonster = (
  cardInstanceId: string,
  zoneIndex = 0,
  playerIndex: 0 | 1 = 0,
): SetMonsterAction => ({
  type: 'SetMonster',
  payload: { playerIndex, cardInstanceId, zoneIndex },
});
const endPhase = (state: GameState): EndPhaseAction => ({
  type: 'EndPhase',
  payload: { playerIndex: state.turnPlayerIndex },
});

const MODES = [
  {
    name: 'NormalSummon',
    make: summon,
    position: 'Attack',
    event: 'NormalSummoned',
  },
  {
    name: 'SetMonster',
    make: setMonster,
    position: 'DefenseDown',
    event: 'MonsterSet',
  },
] as const;

function totalCards(state: GameState, playerIndex: 0 | 1): number {
  const p = state.players[playerIndex];
  const board = [...p.board.monsterZones, ...p.board.spellTrapZones, p.board.fieldZone].filter(
    (c) => c !== null,
  );
  return p.hand.length + board.length + p.deck.length + p.graveyard.length;
}

/** Advance from the current state until the given phase of the next turn (via real EndPhase actions). */
function advanceTo(state: GameState, turnCount: number, phase: Phase): GameState {
  let s = state;
  while (s.turnCount !== turnCount || s.phase !== phase) {
    s = applyAction(s, endPhase(s), ctx).state;
  }
  return s;
}

describe.each(MODES)('$name / happy path', ({ make, position, event }) => {
  it.each(['Main1', 'Main2'] as const)('places the card from hand in %s', (phase) => {
    const before = setup(['M4', 'M1'], phase);
    const { state, events } = applyAction(before, make('h0', 2), ctx);

    const placed = state.players[0].board.monsterZones[2];
    expect(placed).toMatchObject({ instanceId: 'h0', definitionId: 'M4', position });
    expect(state.players[0].hand.map((c) => c.instanceId)).toEqual(['h1']);
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(true);
    expect(state.players[1].hasNormalSummonedThisTurn).toBe(false);
    expect(state.version).toBe(before.version + 1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: event,
      playerIndex: 0,
      instanceId: 'h0',
      zoneIndex: 2,
    });
  });

  it('accepts a level 1 monster', () => {
    const { state } = applyAction(setup(['M1']), make('h0'), ctx);
    expect(state.players[0].board.monsterZones[0]?.definitionId).toBe('M1');
  });
});

describe('event content', () => {
  it('NormalSummoned reveals the definition; MonsterSet does not', () => {
    const summoned = applyAction(setup(), summon('h0'), ctx).events[0];
    const set = applyAction(setup(), setMonster('h0'), ctx).events[0];

    expect(summoned).toEqual({
      type: 'NormalSummoned',
      playerIndex: 0,
      instanceId: 'h0',
      definitionId: 'M4',
      zoneIndex: 0,
    });
    expect(set).toEqual({ type: 'MonsterSet', playerIndex: 0, instanceId: 'h0', zoneIndex: 0 });
  });
});

describe('one Normal Summon / Set per turn', () => {
  it.each([
    ['Summon then Summon', summon, summon],
    ['Summon then Set', summon, setMonster],
    ['Set then Summon', setMonster, summon],
    ['Set then Set', setMonster, setMonster],
  ])('%s is rejected the second time', (_name, first, second) => {
    const { state } = applyAction(setup(), first('h0', 0), ctx);
    expect(() => applyAction(state, second('h1', 1), ctx)).toThrow(/already/i);
  });

  it('allows a new Summon after a full turn cycle', () => {
    const { state: turn1 } = applyAction(setup(['M4', 'M4']), summon('h0', 0), ctx);
    // Player 1's turn, then back to player 0 on turn 3.
    const turn3 = advanceTo(turn1, 3, 'Main1');
    expect(turn3.turnPlayerIndex).toBe(0);
    expect(turn3.players[0].hasNormalSummonedThisTurn).toBe(false);

    const { state } = applyAction(turn3, summon('h1', 1), ctx);
    expect(state.players[0].board.monsterZones[0]?.instanceId).toBe('h0');
    expect(state.players[0].board.monsterZones[1]?.instanceId).toBe('h1');
  });
});

describe.each(MODES)('$name / rejections', ({ make }) => {
  it.each(['Draw', 'Standby', 'Battle', 'End'] as const)('is rejected in %s phase', (phase) => {
    expect(() => applyAction(setup(['M4'], phase), make('h0'), ctx)).toThrow(/Main Phase/);
  });

  it('is rejected once the duel has a winner', () => {
    const over: GameState = { ...setup(), winnerIndex: 1 };
    expect(() => applyAction(over, make('h0'), ctx)).toThrow(/ended/i);
  });

  it('is rejected while a prompt is pending', () => {
    const prompted: GameState = {
      ...setup(),
      pendingPrompt: { promptId: 'p', playerIndex: 0, kind: 'X', payload: null },
    };
    expect(() => applyAction(prompted, make('h0'), ctx)).toThrow(/prompt/i);
  });

  it('is rejected for the non-turn player', () => {
    const before = setup();
    const withOpponentHand: GameState = {
      ...before,
      players: [before.players[0], { ...before.players[1], hand: [card('o0', 'M4', 1)] }],
    };
    expect(() => applyAction(withOpponentHand, make('o0', 0, 1), ctx)).toThrow(/turn player/i);
  });

  it('is rejected when the card is not in the caller hand', () => {
    expect(() => applyAction(setup(), make('nope'), ctx)).toThrow(/not in your hand/i);
  });

  it("is rejected for a card in the opponent's hand", () => {
    const before = setup();
    const s: GameState = {
      ...before,
      players: [before.players[0], { ...before.players[1], hand: [card('o0', 'M4', 1)] }],
    };
    expect(() => applyAction(s, make('o0'), ctx)).toThrow(/not in your hand/i);
  });

  it.each(['SPELL', 'TRAP'])('is rejected for a %s card', (id) => {
    expect(() => applyAction(setup([id]), make('h0'), ctx)).toThrow(/not a Monster/i);
  });

  it.each(['M5', 'M6', 'M7'])(
    'is rejected for level 5+ monster %s (Tribute not supported yet)',
    (id) => {
      expect(() => applyAction(setup([id]), make('h0'), ctx)).toThrow(/Tribute/);
    },
  );

  it.each([-1, 5, 1.5, Number.NaN])('is rejected for zoneIndex %s', (zone) => {
    expect(() => applyAction(setup(), make('h0', zone), ctx)).toThrow(/zoneIndex must be/);
  });

  it('is rejected when the zone is occupied', () => {
    const before = setup(['M4', 'M4']);
    const occupied: GameState = {
      ...before,
      players: [
        {
          ...before.players[0],
          board: {
            ...before.players[0].board,
            monsterZones: [null, null, card('x', 'M1'), null, null],
          },
        },
        before.players[1],
      ],
    };
    expect(() => applyAction(occupied, make('h0', 2), ctx)).toThrow(/occupied/i);
  });

  it('is rejected when all 5 monster zones are full', () => {
    const before = setup(['M4']);
    const full: GameState = {
      ...before,
      players: [
        {
          ...before.players[0],
          board: {
            ...before.players[0].board,
            monsterZones: [
              card('x0', 'M1'),
              card('x1', 'M1'),
              card('x2', 'M1'),
              card('x3', 'M1'),
              card('x4', 'M1'),
            ],
          },
        },
        before.players[1],
      ],
    };
    for (const zone of [0, 1, 2, 3, 4]) {
      expect(() => applyAction(full, make('h0', zone), ctx)).toThrow(/occupied/i);
    }
  });

  it('is rejected when no card definition resolver is provided', () => {
    expect(() => applyAction(setup(), make('h0'))).toThrow(/card definition/i);
  });

  it('is rejected when the definition is unknown', () => {
    expect(() => applyAction(setup(['UNKNOWN']), make('h0'), ctx)).toThrow(/card definition/i);
  });

  it('does not change state when rejected', () => {
    const before = setup();
    const snapshot = JSON.stringify(before);
    expect(() => applyAction(before, make('h0', 9), ctx)).toThrow(/zoneIndex must be/);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe.each(MODES)('$name / purity and invariants', ({ make }) => {
  it('never mutates a deep-frozen input state', () => {
    const before = deepFreeze(setup());
    const { state } = applyAction(before, make('h0', 3), ctx);
    expect(state).not.toBe(before);
    expect(before.players[0].hand).toHaveLength(3);
    expect(before.players[0].hasNormalSummonedThisTurn).toBe(false);
  });

  it('keeps the total card count of the player constant', () => {
    const before = setup();
    const { state } = applyAction(before, make('h0', 4), ctx);
    expect(totalCards(state, 0)).toBe(totalCards(before, 0));
    expect(totalCards(state, 1)).toBe(totalCards(before, 1));
  });

  it('is deterministic and JSON-serializable', () => {
    const a = applyAction(setup(), make('h0'), ctx);
    const b = applyAction(setup(), make('h0'), ctx);
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a.state))).toEqual(a.state);
  });
});

describe('Action union', () => {
  it('accepts NormalSummon and SetMonster as Action values', () => {
    const actions: Action[] = [summon('h0'), setMonster('h0')];
    expect(actions.map((a) => a.type)).toEqual(['NormalSummon', 'SetMonster']);
  });
});
