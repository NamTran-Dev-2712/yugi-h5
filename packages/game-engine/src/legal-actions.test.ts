import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '@yugi/shared';
import { applyAction } from './apply-action.js';
import type { Action, ActionContext } from './actions/types.js';
import { EngineError } from './errors.js';
import { getLegalActions } from './legal-actions.js';
import type { CardInstance, GameState, Phase } from './state/types.js';
import { deepFreeze } from './testing/deep-freeze.js';

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
  M4: monster('M4', 4),
  M5: monster('M5', 5),
  M7: monster('M7', 7),
  SPELL: {
    id: 'SPELL',
    kind: 'Spell',
    name: { vi: 'Test Spell', en: 'Test Spell' },
    subType: 'Normal',
  },
};
const ctx: ActionContext = { cardDefinitions: (id) => DEFS[id] };

const card = (
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1,
  extra: Partial<CardInstance> = {},
): CardInstance => ({ instanceId, definitionId, position: null, ownerIndex, ...extra });

const onField = (
  instanceId: string,
  ownerIndex: 0 | 1,
  extra: Partial<CardInstance> = {},
): CardInstance =>
  card(instanceId, 'M4', ownerIndex, { position: 'Attack', summonedTurn: 0, ...extra });

interface Setup {
  hand?: string[];
  phase?: Phase;
  turnCount?: number;
  mine?: (CardInstance | null)[];
  theirs?: (CardInstance | null)[];
  normalSummoned?: boolean;
}

function setup(o: Setup = {}): GameState {
  const started = applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed: 'seed-legal',
      playerIds: ['alice', 'bob'],
      deckLists: [
        Array.from({ length: 40 }, (_, i) => `D-${i}`),
        Array.from({ length: 40 }, (_, i) => `D-${i}`),
      ],
    },
  }).state;
  const zones = (cards: (CardInstance | null)[] = []) =>
    [0, 1, 2, 3, 4].map((i) => cards[i] ?? null) as CardInstance[] & never;
  const p0 = started.players[0];
  const p1 = started.players[1];
  return deepFreeze({
    ...started,
    phase: o.phase ?? 'Main1',
    turnCount: o.turnCount ?? 2,
    players: [
      {
        ...p0,
        hand: (o.hand ?? []).map((d, i) => card(`h${i}`, d, 0)),
        hasNormalSummonedThisTurn: o.normalSummoned ?? false,
        board: { ...p0.board, monsterZones: zones(o.mine) },
      },
      { ...p1, board: { ...p1.board, monsterZones: zones(o.theirs) } },
    ],
  } as GameState);
}

const legal = (s: GameState, p: 0 | 1 = 0): Action[] => getLegalActions(s, p, ctx);
const ofType = (list: Action[], type: Action['type']) => list.filter((a) => a.type === type);

function accepted(s: GameState, a: Action): boolean {
  try {
    applyAction(s, a, ctx);
    return true;
  } catch (e) {
    if (e instanceof EngineError) return false;
    throw e;
  }
}

describe('getLegalActions — scenarios', () => {
  it('lists Summon and Set for a level-4 hand card in every free zone', () => {
    const s = setup({ hand: ['M4'] });
    const list = legal(s);
    expect(ofType(list, 'NormalSummon')).toHaveLength(5);
    expect(ofType(list, 'SetMonster')).toHaveLength(5);
    expect(ofType(list, 'EndPhase')).toHaveLength(1);
  });

  it('never lists Spell cards for Summon/Set', () => {
    const s = setup({ hand: ['SPELL'] });
    const list = legal(s);
    expect(ofType(list, 'NormalSummon')).toHaveLength(0);
    expect(ofType(list, 'SetMonster')).toHaveLength(0);
  });

  it('after a Normal Summon no more Summon/Set', () => {
    const s = setup({ hand: ['M4'], normalSummoned: true });
    const list = legal(s);
    expect(ofType(list, 'NormalSummon')).toHaveLength(0);
    expect(ofType(list, 'SetMonster')).toHaveLength(0);
  });

  it('level 5 needs a tribute: none without monsters, one-tribute variants with a monster', () => {
    const none = legal(setup({ hand: ['M5'] }));
    expect(ofType(none, 'NormalSummon')).toHaveLength(0);
    const one = legal(setup({ hand: ['M5'], mine: [onField('f0', 0)] }));
    const summons = ofType(one, 'NormalSummon');
    expect(summons.length).toBeGreaterThan(0);
    for (const a of summons) {
      if (a.type !== 'NormalSummon') throw new Error('unreachable');
      expect(a.payload.tributeInstanceIds).toEqual(['f0']);
    }
  });

  it('level 7 needs 2 tributes: one monster is not enough', () => {
    expect(
      ofType(legal(setup({ hand: ['M7'], mine: [onField('f0', 0)] })), 'NormalSummon'),
    ).toHaveLength(0);
    const two = legal(setup({ hand: ['M7'], mine: [onField('f0', 0), onField('f1', 0)] }));
    expect(ofType(two, 'NormalSummon').length).toBeGreaterThan(0);
  });

  it('turn 1 has no attacks', () => {
    const s = setup({ phase: 'Battle', turnCount: 1, mine: [onField('f0', 0)] });
    expect(ofType(legal(s), 'DeclareAttack')).toHaveLength(0);
  });

  it('opponent without monsters → direct attack', () => {
    const s = setup({ phase: 'Battle', mine: [onField('f0', 0)] });
    const attacks = ofType(legal(s), 'DeclareAttack');
    expect(attacks).toHaveLength(1);
    const a = attacks[0]!;
    if (a.type !== 'DeclareAttack') throw new Error('unreachable');
    expect(a.payload.targetInstanceId ?? null).toBeNull();
  });

  it('opponent with monsters → only targeted attacks (face-down included)', () => {
    const s = setup({
      phase: 'Battle',
      mine: [onField('f0', 0)],
      theirs: [onField('e0', 1), onField('e1', 1, { position: 'DefenseDown' })],
    });
    const attacks = ofType(legal(s), 'DeclareAttack');
    expect(attacks).toHaveLength(2);
    for (const a of attacks) {
      if (a.type !== 'DeclareAttack') throw new Error('unreachable');
      expect(a.payload.targetInstanceId).toBeTruthy();
    }
  });

  it('a position already changed this turn cannot change again', () => {
    const fresh = setup({ mine: [onField('f0', 0)] });
    expect(ofType(legal(fresh), 'ChangePosition')).toHaveLength(1);
    const changed = setup({ mine: [onField('f0', 0, { positionChangedTurn: 2 })] });
    expect(ofType(legal(changed), 'ChangePosition')).toHaveLength(0);
  });

  it('hand over the limit at Main2 → only discard answers (plus Surrender)', () => {
    const s = setup({
      phase: 'Main2',
      hand: ['M4', 'M4', 'M4', 'M4', 'M4', 'M4', 'M4'],
      normalSummoned: true,
    });
    const prompted = applyAction(s, { type: 'EndPhase', payload: { playerIndex: 0 } }, ctx).state;
    expect(prompted.pendingPrompt).not.toBeNull();
    const list = legal(prompted);
    const types = new Set(list.map((a) => a.type));
    expect([...types].sort()).toEqual(['ResolvePendingPrompt', 'Surrender']);
    expect(ofType(list, 'ResolvePendingPrompt')).toHaveLength(7); // C(7,1)
    // The seat that does not have to answer only has Surrender.
    expect(legal(prompted, 1).map((a) => a.type)).toEqual(['Surrender']);
  });

  it('the seat that is not the turn player only has Surrender', () => {
    const s = setup({ hand: ['M4'] });
    expect(legal(s, 1).map((a) => a.type)).toEqual(['Surrender']);
  });

  it('allowSurrender=false removes Surrender', () => {
    const s = setup({ hand: [] });
    const noSurrender = deepFreeze({ ...s, ruleset: { ...s.ruleset, allowSurrender: false } });
    expect(legal(noSurrender).map((a) => a.type)).toEqual(['EndPhase']);
    expect(legal(noSurrender, 1)).toEqual([]);
  });

  it('finished duel → empty for both seats', () => {
    const s = deepFreeze({ ...setup({ hand: ['M4'] }), winnerIndex: 0 as const });
    expect(legal(s, 0)).toEqual([]);
    expect(legal(s, 1)).toEqual([]);
  });

  it('never lists Draw or StartDuel', () => {
    const list = legal(setup({ hand: ['M4'], mine: [onField('f0', 0)] }));
    expect(list.some((a) => a.type === 'Draw' || a.type === 'StartDuel')).toBe(false);
  });

  it('has no duplicates and everything listed is accepted', () => {
    const s = setup({
      hand: ['M4', 'M5', 'M7'],
      mine: [onField('f0', 0), onField('f1', 0), onField('f2', 0)],
      theirs: [onField('e0', 1)],
    });
    const list = legal(s);
    expect(new Set(list.map((a) => JSON.stringify(a))).size).toBe(list.length);
    for (const a of list) expect(accepted(s, a)).toBe(true);
  });

  it('rethrows unexpected (non-EngineError) failures instead of hiding them', () => {
    const s = setup({ hand: ['M4'] });
    const broken: ActionContext = {
      cardDefinitions: () => {
        throw new Error('boom');
      },
    };
    expect(() => getLegalActions(s, 0, broken)).toThrow('boom');
  });

  it('does not mutate its (frozen) input', () => {
    const s = setup({ hand: ['M4'], mine: [onField('f0', 0)] });
    expect(() => legal(s)).not.toThrow();
  });
});

describe('getLegalActions — worst-case cost', () => {
  it('a full board with a level-7 hand stays fast', () => {
    const s = setup({
      phase: 'Main1',
      hand: ['M7', 'M7', 'M5', 'M5', 'M4', 'M4', 'M4'],
      mine: [0, 1, 2, 3, 4].map((i) => onField(`f${i}`, 0)),
      theirs: [0, 1, 2, 3, 4].map((i) => onField(`e${i}`, 1)),
    });
    const started = performance.now();
    const runs = 20;
    let size = 0;
    for (let i = 0; i < runs; i++) size = legal(s).length;
    const perCallMs = (performance.now() - started) / runs;
    console.info(`getLegalActions full board: ${size} actions, ${perCallMs.toFixed(2)} ms/call`);
    expect(perCallMs).toBeLessThan(300);
  });
});
