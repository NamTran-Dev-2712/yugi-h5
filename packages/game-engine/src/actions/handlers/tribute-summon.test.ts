import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '@yugi/shared';
import { applyAction } from '../../apply-action.js';
import type { Action, ActionContext, EndPhaseAction } from '../types.js';
import type { CardInstance, CardPosition, GameState, Phase } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';

function monster(id: string, level: number): CardDefinition {
  return {
    id,
    kind: 'Monster',
    name: { vi: `Test ${id}`, en: `Test ${id}` },
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
  M8: monster('M8', 8),
  SPELL: {
    id: 'SPELL',
    kind: 'Spell',
    name: { vi: 'Test Spell', en: 'Test Spell' },
    subType: 'Normal',
  },
};

const ctx: ActionContext = { cardDefinitions: (id) => DEFS[id] };

function card(
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1 = 0,
  position: CardPosition | null = null,
): CardInstance {
  return { instanceId, definitionId, position, ownerIndex };
}

type Slot = string | null;

interface Setup {
  /** Definition ids in player 0's hand (instance ids h0, h1, ...). */
  hand?: string[];
  /** Player 0's 5 monster zones: instance id `t<zone>` with the given definition id, or null. */
  own?: readonly [Slot, Slot, Slot, Slot, Slot];
  /** Zones (by index) of player 0 whose monster is face-down. */
  faceDown?: number[];
  /** Player 1's 5 monster zones: instance id `o<zone>`. */
  opp?: readonly [Slot, Slot, Slot, Slot, Slot];
  ownGrave?: CardInstance[];
  phase?: Phase;
}

const EMPTY: readonly [Slot, Slot, Slot, Slot, Slot] = [null, null, null, null, null];

function setup({
  hand = ['M5'],
  own = EMPTY,
  faceDown = [],
  opp = EMPTY,
  ownGrave = [],
  phase = 'Main1',
}: Setup = {}): GameState {
  const started = applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed: 'seed-tribute',
      playerIds: ['alice', 'bob'],
      deckLists: [
        Array.from({ length: 40 }, (_, i) => `D-${i}`),
        Array.from({ length: 40 }, (_, i) => `D-${i}`),
      ],
    },
  }).state;
  const zones = (slots: readonly Slot[], prefix: string, owner: 0 | 1, down: number[]) =>
    slots.map((definitionId, i) =>
      definitionId === null
        ? null
        : card(`${prefix}${i}`, definitionId, owner, down.includes(i) ? 'DefenseDown' : 'Attack'),
    ) as unknown as GameState['players'][0]['board']['monsterZones'];
  return {
    ...started,
    phase,
    players: [
      {
        ...started.players[0],
        hand: hand.map((id, i) => card(`h${i}`, id)),
        graveyard: ownGrave,
        board: { ...started.players[0].board, monsterZones: zones(own, 't', 0, faceDown) },
      },
      {
        ...started.players[1],
        board: { ...started.players[1].board, monsterZones: zones(opp, 'o', 1, []) },
      },
    ],
  };
}

const MODES = [
  {
    name: { vi: 'NormalSummon', en: 'NormalSummon' },
    type: 'NormalSummon',
    position: 'Attack',
    event: 'NormalSummoned',
  },
  {
    name: { vi: 'SetMonster', en: 'SetMonster' },
    type: 'SetMonster',
    position: 'DefenseDown',
    event: 'MonsterSet',
  },
] as const;

type Mode = (typeof MODES)[number]['type'];

const make = (
  type: Mode,
  cardInstanceId: string,
  zoneIndex: number,
  tributeInstanceIds?: readonly string[],
  playerIndex: 0 | 1 = 0,
): Action => ({
  type,
  payload: {
    playerIndex,
    cardInstanceId,
    zoneIndex,
    ...(tributeInstanceIds ? { tributeInstanceIds } : {}),
  },
});

const endPhase = (state: GameState): EndPhaseAction => ({
  type: 'EndPhase',
  payload: { playerIndex: state.turnPlayerIndex },
});

function totalCards(state: GameState, playerIndex: 0 | 1): number {
  const p = state.players[playerIndex];
  const board = [...p.board.monsterZones, ...p.board.spellTrapZones, p.board.fieldZone].filter(
    (c) => c !== null,
  );
  return p.hand.length + board.length + p.deck.length + p.graveyard.length;
}

describe.each(MODES)('$name / tribute happy path', ({ type, position, event }) => {
  it.each([
    ['M5', ['t0']],
    ['M6', ['t0']],
    ['M7', ['t0', 't1']],
    ['M8', ['t0', 't1']],
  ])('level of %s: accepts exactly the required tributes %j', (id, tributes) => {
    const before = setup({ hand: [id], own: ['M1', 'M1', null, null, null] });
    const { state, events } = applyAction(before, make(type, 'h0', 3, tributes), ctx);

    const p = state.players[0];
    expect(p.board.monsterZones[3]).toMatchObject({ instanceId: 'h0', definitionId: id, position });
    for (const t of tributes) {
      expect(p.board.monsterZones.some((c) => c?.instanceId === t)).toBe(false);
      expect(p.graveyard.map((c) => c.instanceId)).toContain(t);
    }
    expect(p.graveyard).toHaveLength(tributes.length);
    expect(p.hand).toHaveLength(0);
    expect(p.hasNormalSummonedThisTurn).toBe(true);
    expect(state.version).toBe(before.version + 1);
    expect(events.at(-1)).toMatchObject({ type: event, instanceId: 'h0', zoneIndex: 3 });
  });

  it('tributes a face-down monster', () => {
    const before = setup({ hand: ['M5'], own: ['M1', null, null, null, null], faceDown: [0] });
    const { state } = applyAction(before, make(type, 'h0', 1, ['t0']), ctx);
    expect(state.players[0].board.monsterZones[0]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['t0']);
  });

  it('sends tributes to the graveyard in array order', () => {
    const before = setup({ hand: ['M7'], own: ['M1', 'M4', null, null, null] });
    const { state } = applyAction(before, make(type, 'h0', 2, ['t1', 't0']), ctx);
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['t1', 't0']);
  });

  it('resets a tributed monster to no board position in the graveyard', () => {
    const before = setup({ hand: ['M5'], own: ['M1', null, null, null, null] });
    const { state } = applyAction(before, make(type, 'h0', 1, ['t0']), ctx);
    expect(state.players[0].graveyard[0]).toMatchObject({ instanceId: 't0', position: null });
  });

  it('keeps a monster that was not tributed', () => {
    const before = setup({ hand: ['M5'], own: ['M1', 'M4', null, null, null] });
    const { state } = applyAction(before, make(type, 'h0', 2, ['t0']), ctx);
    expect(state.players[0].board.monsterZones[1]?.instanceId).toBe('t1');
    expect(state.players[0].board.monsterZones[0]).toBeNull();
  });
});

describe.each(MODES)('$name / tribute count', ({ type }) => {
  it.each([
    ['M5', 0],
    ['M5', 2],
    ['M6', 0],
    ['M6', 2],
    ['M7', 0],
    ['M7', 1],
    ['M7', 3],
    ['M8', 1],
    ['M4', 1],
    ['M1', 1],
  ])('%s with %i tribute(s) is rejected', (id, count) => {
    const own = ['M1', 'M1', 'M1', null, null] as const;
    const tributes = ['t0', 't1', 't2'].slice(0, count);
    expectEngineError(
      () => applyAction(setup({ hand: [id], own }), make(type, 'h0', 4, tributes), ctx),
      'TRIBUTE_COUNT_MISMATCH',
    );
  });

  it('an omitted tributeInstanceIds means no tribute', () => {
    const own = ['M1', null, null, null, null] as const;
    expectEngineError(
      () => applyAction(setup({ hand: ['M5'], own }), make(type, 'h0', 4), ctx),
      'TRIBUTE_COUNT_MISMATCH',
    );
  });

  it('level 1-4 with no tribute still works', () => {
    const { state } = applyAction(setup({ hand: ['M4'] }), make(type, 'h0', 0, []), ctx);
    expect(state.players[0].board.monsterZones[0]?.instanceId).toBe('h0');
    expect(state.players[0].graveyard).toHaveLength(0);
  });
});

describe.each(MODES)('$name / invalid tributes', ({ type }) => {
  const own = ['M1', 'M1', null, null, null] as const;

  it('rejects the same tribute twice', () => {
    expectEngineError(
      () => applyAction(setup({ hand: ['M7'], own }), make(type, 'h0', 4, ['t0', 't0']), ctx),
      'INVALID_TRIBUTE',
    );
  });

  it("rejects the opponent's monster", () => {
    const before = setup({ hand: ['M5'], own, opp: ['M1', null, null, null, null] });
    expectEngineError(
      () => applyAction(before, make(type, 'h0', 4, ['o0']), ctx),
      'INVALID_TRIBUTE',
    );
  });

  it('rejects a card in hand', () => {
    expectEngineError(
      () => applyAction(setup({ hand: ['M5', 'M1'], own }), make(type, 'h0', 4, ['h1']), ctx),
      'INVALID_TRIBUTE',
    );
  });

  it('rejects a card in the graveyard', () => {
    const before = setup({ hand: ['M5'], own, ownGrave: [card('g0', 'M1')] });
    expectEngineError(
      () => applyAction(before, make(type, 'h0', 4, ['g0']), ctx),
      'INVALID_TRIBUTE',
    );
  });

  it('rejects an unknown id', () => {
    expectEngineError(
      () => applyAction(setup({ hand: ['M5'], own }), make(type, 'h0', 4, ['nope']), ctx),
      'INVALID_TRIBUTE',
    );
  });

  it('rejects the summoned card itself as a tribute', () => {
    expectEngineError(
      () => applyAction(setup({ hand: ['M5'], own }), make(type, 'h0', 4, ['h0']), ctx),
      'INVALID_TRIBUTE',
    );
  });
});

describe.each(MODES)('$name / freed zone', ({ type }) => {
  const full = ['M1', 'M1', 'M1', 'M1', 'M1'] as const;

  it.each([0, 2, 4])('a full board can summon into the tributed zone %i', (zone) => {
    const { state } = applyAction(
      setup({ hand: ['M5'], own: full }),
      make(type, 'h0', zone, [`t${zone}`]),
      ctx,
    );
    expect(state.players[0].board.monsterZones[zone]?.instanceId).toBe('h0');
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual([`t${zone}`]);
  });

  it('a full board rejects a zone whose monster was not tributed', () => {
    expectEngineError(
      () => applyAction(setup({ hand: ['M5'], own: full }), make(type, 'h0', 1, ['t0']), ctx),
      'ZONE_OCCUPIED',
    );
  });

  it('a partially free board still rejects an occupied non-tributed zone', () => {
    const own = ['M1', 'M1', null, null, null] as const;
    expectEngineError(
      () => applyAction(setup({ hand: ['M5'], own }), make(type, 'h0', 1, ['t0']), ctx),
      'ZONE_OCCUPIED',
    );
  });

  it('with 2 tributes, either freed zone can be used', () => {
    const { state } = applyAction(
      setup({ hand: ['M7'], own: full }),
      make(type, 'h0', 3, ['t1', 't3']),
      ctx,
    );
    expect(state.players[0].board.monsterZones.map((c) => c?.instanceId ?? null)).toEqual([
      't0',
      null,
      't2',
      'h0',
      't4',
    ]);
  });
});

describe.each(MODES)('$name / events', ({ type, event }) => {
  it('emits MonsterTributed per tribute in array order, then the summon event', () => {
    const before = setup({ hand: ['M7'], own: ['M1', 'M4', null, null, null] });
    const { events } = applyAction(before, make(type, 'h0', 2, ['t1', 't0']), ctx);

    expect(events.map((e) => e.type)).toEqual(['MonsterTributed', 'MonsterTributed', event]);
    expect(events[0]).toEqual({
      type: 'MonsterTributed',
      ownerIndex: 0,
      instanceId: 't1',
      definitionId: 'M4',
      zoneIndex: 1,
    });
    expect(events[1]).toEqual({
      type: 'MonsterTributed',
      ownerIndex: 0,
      instanceId: 't0',
      definitionId: 'M1',
      zoneIndex: 0,
    });
  });

  it('MonsterTributed reveals the definition even for a face-down tribute (graveyard is public)', () => {
    const before = setup({ hand: ['M5'], own: ['M4', null, null, null, null], faceDown: [0] });
    const { events } = applyAction(before, make(type, 'h0', 1, ['t0']), ctx);
    expect(events[0]).toMatchObject({ type: 'MonsterTributed', definitionId: 'M4' });
  });

  it('a set monster still hides its definition', () => {
    const before = setup({ hand: ['M5'], own: ['M1', null, null, null, null] });
    const last = applyAction(before, make(type, 'h0', 1, ['t0']), ctx).events.at(-1);
    if (type === 'SetMonster') expect(last).not.toHaveProperty('definitionId');
    else expect(last).toHaveProperty('definitionId', 'M5');
  });
});

describe('Normal Summon right', () => {
  it.each(MODES)('a tribute $name uses the turn Normal Summon', ({ type }) => {
    const before = setup({ hand: ['M5', 'M4'], own: ['M1', null, null, null, null] });
    const { state } = applyAction(before, make(type, 'h0', 1, ['t0']), ctx);
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(true);
    expectEngineError(
      () => applyAction(state, make('NormalSummon', 'h1', 2, []), ctx),
      'NORMAL_SUMMON_USED',
    );
    expectEngineError(
      () => applyAction(state, make('SetMonster', 'h1', 2, []), ctx),
      'NORMAL_SUMMON_USED',
    );
  });

  it('a tribute summon is possible again on the next own turn', () => {
    const before = setup({ hand: ['M5', 'M6'], own: ['M1', 'M1', null, null, null] });
    let s = applyAction(before, make('NormalSummon', 'h0', 2, ['t0']), ctx).state;
    while (s.turnCount !== 3 || s.phase !== 'Main1') {
      s = applyAction(s, endPhase(s), ctx).state;
    }
    expect(s.turnPlayerIndex).toBe(0);
    const { state } = applyAction(s, make('NormalSummon', 'h1', 0, ['t1']), ctx);
    expect(state.players[0].board.monsterZones[0]?.instanceId).toBe('h1');
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['t0', 't1']);
  });
});

describe.each(MODES)('$name / purity and invariants', ({ type }) => {
  const own = ['M1', 'M4', 'M1', null, null] as const;

  it.each([
    ['too few tributes', 'M7', ['t0'], 'TRIBUTE_COUNT_MISMATCH'],
    ['opponent tribute', 'M5', ['o0'], 'INVALID_TRIBUTE'],
    ['occupied zone', 'M5', ['t0'], 'ZONE_OCCUPIED'],
  ] as const)('a rejection (%s) leaves the input state unchanged', (_n, id, tributes, code) => {
    const before = deepFreeze(setup({ hand: [id], own, opp: ['M1', null, null, null, null] }));
    const snapshot = JSON.stringify(before);
    const zone = code === 'ZONE_OCCUPIED' ? 1 : 4;
    expectEngineError(() => applyAction(before, make(type, 'h0', zone, tributes), ctx), code);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('never mutates a deep-frozen input state on success', () => {
    const before = deepFreeze(setup({ hand: ['M7'], own }));
    const { state } = applyAction(before, make(type, 'h0', 3, ['t0', 't1']), ctx);
    expect(state).not.toBe(before);
    expect(before.players[0].graveyard).toHaveLength(0);
    expect(before.players[0].board.monsterZones[0]?.instanceId).toBe('t0');
  });

  it('keeps the card total constant; graveyard grows by the tribute count', () => {
    const before = setup({ hand: ['M7'], own });
    const { state } = applyAction(before, make(type, 'h0', 3, ['t0', 't2']), ctx);
    expect(totalCards(state, 0)).toBe(totalCards(before, 0));
    expect(totalCards(state, 1)).toBe(totalCards(before, 1));
    expect(state.players[0].graveyard.length).toBe(before.players[0].graveyard.length + 2);
    expect(state.players[1]).toEqual(before.players[1]);
  });

  it('is deterministic and JSON-serializable', () => {
    const run = () => applyAction(setup({ hand: ['M5'], own }), make(type, 'h0', 3, ['t0']), ctx);
    expect(run()).toEqual(run());
    expect(JSON.parse(JSON.stringify(run().state))).toEqual(run().state);
  });
});
