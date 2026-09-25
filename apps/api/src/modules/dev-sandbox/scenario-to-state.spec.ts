import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { applyAction, getLegalActions } from '@yugi/game-engine';
import { ScenarioSchema, STARTER_DECK, type Scenario } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { lookupCard } from '../duels/card-pool';
import { DuelServiceError } from '../duels/duel-errors';
import { scenarioToState } from './scenario-to-state';

const ctx = { cardDefinitions: lookupCard };
const dir = join(__dirname, '../../../../../packages/shared/scenarios');
const sample = (name: string): Scenario =>
  ScenarioSchema.parse(JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')));

const player = (over: Partial<Scenario['players'][0]> = {}): Scenario['players'][0] => ({
  lp: 8000,
  hand: ['SMP-001', 'SMP-004'],
  deck: ['SMP-005', 'SMP-006'],
  field: { monsters: [], spellTraps: [] },
  gy: [],
  ...over,
});
const scenario = (over: Partial<Scenario> = {}): Scenario => ({
  name: 't',
  seed: 's',
  players: [player(), player()],
  turn: { count: 3, player: 1 },
  phase: 'Main2',
  ...over,
});
const build = (s: Scenario) =>
  scenarioToState(s, { matchId: 'm1', playerIds: ['a', 'b'] }, lookupCard);
const message = (s: Scenario): string => {
  try {
    build(s);
  } catch (e) {
    if (e instanceof DuelServiceError) {
      expect(e.code).toBe('INVALID_SCENARIO');
      return e.message;
    }
    throw e;
  }
  throw new Error('expected scenarioToState to throw');
};

describe('scenarioToState — the state it builds', () => {
  it('places cards, LP, turn and phase exactly as described', () => {
    const state = build(
      scenario({
        players: [
          player({
            lp: 5000,
            field: {
              monsters: [{ card: 'SMP-002', zone: 3, position: 'DefenseUp', summonedTurn: 1 }],
              spellTraps: [{ card: 'SMP-201', zone: 1, position: 'DefenseDown' }],
            },
            gy: ['SMP-003'],
          }),
          player(),
        ],
      }),
    );
    const p0 = state.players[0];
    expect(state.turnCount).toBe(3);
    expect(state.turnPlayerIndex).toBe(1);
    expect(state.phase).toBe('Main2');
    expect(state.matchId).toBe('m1');
    expect(state.winnerIndex).toBeNull();
    expect(state.pendingPrompt).toBeNull();
    expect(state.players[0].playerId).toBe('a');
    expect(state.players[1].playerId).toBe('b');
    expect(p0.lifePoints).toBe(5000);
    expect(p0.hand.map((c) => c.definitionId)).toEqual(['SMP-001', 'SMP-004']);
    expect(p0.deck.map((c) => c.definitionId)).toEqual(['SMP-005', 'SMP-006']);
    expect(p0.graveyard.map((c) => c.definitionId)).toEqual(['SMP-003']);
    expect(p0.board.monsterZones[3]).toMatchObject({
      definitionId: 'SMP-002',
      position: 'DefenseUp',
      summonedTurn: 1,
      ownerIndex: 0,
    });
    expect(p0.board.monsterZones.filter((c) => c !== null)).toHaveLength(1);
    expect(p0.board.spellTrapZones[1]).toMatchObject({
      definitionId: 'SMP-201',
      position: 'DefenseDown',
    });
    expect(p0.hasNormalSummonedThisTurn).toBe(false);
  });

  it('gives every card a unique instanceId that starts with p<seat>-', () => {
    const state = build(sample('attack-defense'));
    for (const seat of [0, 1] as const) {
      const p = state.players[seat];
      const all = [
        ...p.hand,
        ...p.deck,
        ...p.graveyard,
        ...p.board.monsterZones.flatMap((c) => (c ? [c] : [])),
        ...p.board.spellTrapZones.flatMap((c) => (c ? [c] : [])),
      ];
      for (const c of all) expect(c.instanceId.startsWith(`p${seat}-`)).toBe(true);
    }
    const ids = state.players.flatMap((p) => [
      ...p.hand,
      ...p.deck,
      ...p.board.monsterZones.flatMap((c) => (c ? [c] : [])),
    ]);
    expect(new Set(ids.map((c) => c.instanceId)).size).toBe(ids.length);
  });

  it('marks every card with the seat that owns it', () => {
    const state = build(sample('attack-defense'));
    for (const seat of [0, 1] as const) {
      const p = state.players[seat];
      const all = [...p.hand, ...p.deck, ...p.board.monsterZones.flatMap((c) => (c ? [c] : []))];
      expect(all.length).toBeGreaterThan(0);
      for (const c of all) expect(c.ownerIndex).toBe(seat);
    }
  });

  it('is deterministic and does not share a mutable state between calls', () => {
    const s = sample('tribute-summon');
    expect(build(s)).toEqual(build(s));
  });

  it('applies a ruleset override on top of the defaults', () => {
    const state = build(scenario({ ruleset: { handLimit: 2, firstTurnAttack: true } }));
    expect(state.ruleset.handLimit).toBe(2);
    expect(state.ruleset.firstTurnAttack).toBe(true);
    expect(state.ruleset.openingHandSize).toBe(5);
  });

  it('has the same top-level shape as a state made by StartDuel (catches engine drift)', () => {
    const real = applyAction(null, {
      type: 'StartDuel',
      payload: {
        matchId: 'm1',
        seed: 's',
        playerIds: ['a', 'b'],
        deckLists: [STARTER_DECK, STARTER_DECK],
      },
    }).state;
    const built = build(scenario());
    expect(Object.keys(built).sort()).toEqual(Object.keys(real).sort());
    expect(Object.keys(built.players[0]).sort()).toEqual(Object.keys(real.players[0]).sort());
    expect(Object.keys(built.players[0].board).sort()).toEqual(
      Object.keys(real.players[0].board).sort(),
    );
    expect(Object.keys(built.players[0].hand[0] ?? {}).sort()).toEqual(
      Object.keys(real.players[0].hand[0] ?? {}).sort(),
    );
  });
});

describe('scenarioToState — the engine accepts what it built', () => {
  it.each(['tribute-summon', 'attack-defense', 'chain-basic'])(
    '%s: legal actions exist and apply',
    (name) => {
      const state = build(sample(name));
      const seat = state.turnPlayerIndex;
      const legal = getLegalActions(state, seat, ctx);
      expect(legal.length).toBeGreaterThan(0);
      for (const action of legal.slice(0, 20)) {
        expect(() => applyAction(state, action, ctx)).not.toThrow();
      }
    },
  );

  it('tribute-summon offers a tribute summon of the level 8 monster', () => {
    const state = build(sample('tribute-summon'));
    const legal = getLegalActions(state, 0, ctx);
    const hand8 = state.players[0].hand.find((c) => c.definitionId === 'SMP-003');
    expect(
      legal.some(
        (a) =>
          a.type === 'NormalSummon' &&
          a.payload.cardInstanceId === hand8?.instanceId &&
          (a.payload.tributeInstanceIds?.length ?? 0) === 2,
      ),
    ).toBe(true);
  });

  it('attack-defense lets the attacker hit the face-down and face-up defenders', () => {
    const state = build(sample('attack-defense'));
    const legal = getLegalActions(state, 0, ctx);
    const targets = new Set(
      legal.flatMap((a) => (a.type === 'DeclareAttack' ? [a.payload.targetInstanceId] : [])),
    );
    expect(targets.size).toBe(2);
  });

  it('a monster with summonedTurn omitted may attack at once', () => {
    const s = scenario({
      turn: { count: 3, player: 0 },
      phase: 'Battle',
      players: [
        player({
          field: {
            monsters: [{ card: 'SMP-006', zone: 0, position: 'Attack' }],
            spellTraps: [],
          },
        }),
        player(),
      ],
    });
    const legal = getLegalActions(build(s), 0, ctx);
    expect(legal.some((a) => a.type === 'DeclareAttack')).toBe(true);
  });
});

describe('scenarioToState — invalid scenarios', () => {
  it('rejects an unknown card id and names it', () => {
    expect(message(scenario({ players: [player({ hand: ['NOPE-1'] }), player()] }))).toMatch(
      /NOPE-1/,
    );
  });

  it('rejects an unknown id in every zone', () => {
    for (const p of [
      player({ deck: ['X-DECK'] }),
      player({ gy: ['X-GY'] }),
      player({
        field: { monsters: [{ card: 'X-MON', zone: 0, position: 'Attack' }], spellTraps: [] },
      }),
      player({
        field: { monsters: [], spellTraps: [{ card: 'X-ST', zone: 0, position: 'DefenseDown' }] },
      }),
    ]) {
      expect(message(scenario({ players: [p, player()] }))).toMatch(/X-/);
    }
  });

  it('rejects two monsters in the same zone', () => {
    const p = player({
      field: {
        monsters: [
          { card: 'SMP-001', zone: 2, position: 'Attack' },
          { card: 'SMP-002', zone: 2, position: 'Attack' },
        ],
        spellTraps: [],
      },
    });
    expect(message(scenario({ players: [p, player()] }))).toMatch(/zone 2/i);
  });

  it('rejects two spell/traps in the same zone', () => {
    const p = player({
      field: {
        monsters: [],
        spellTraps: [
          { card: 'SMP-201', zone: 0, position: 'DefenseDown' },
          { card: 'SMP-101', zone: 0, position: 'DefenseDown' },
        ],
      },
    });
    expect(message(scenario({ players: [p, player()] }))).toMatch(/zone 0/i);
  });

  it('rejects a Spell/Trap in monsters and a monster in spellTraps', () => {
    expect(
      message(
        scenario({
          players: [
            player({
              field: {
                monsters: [{ card: 'SMP-201', zone: 0, position: 'Attack' }],
                spellTraps: [],
              },
            }),
            player(),
          ],
        }),
      ),
    ).toMatch(/SMP-201/);
    expect(
      message(
        scenario({
          players: [
            player({
              field: {
                monsters: [],
                spellTraps: [{ card: 'SMP-001', zone: 0, position: 'DefenseDown' }],
              },
            }),
            player(),
          ],
        }),
      ),
    ).toMatch(/SMP-001/);
  });

  it('reports every problem, not only the first', () => {
    const msg = message(
      scenario({ players: [player({ hand: ['A-1'], deck: ['B-2'] }), player({ gy: ['C-3'] })] }),
    );
    expect(msg).toMatch(/A-1/);
    expect(msg).toMatch(/B-2/);
    expect(msg).toMatch(/C-3/);
  });

  it('rejects a script-independent invalid ruleset', () => {
    expect(message(scenario({ ruleset: { deckMin: 10, deckMax: 5 } }))).toMatch(/ruleset/i);
  });
});

describe('sample scenarios', () => {
  const names = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));

  it('ships the three named scenarios', () => {
    expect(names.sort()).toEqual(['attack-defense', 'chain-basic', 'tribute-summon']);
  });

  it.each(['tribute-summon', 'attack-defense', 'chain-basic'])(
    '%s validates against the schema and builds a state (every card id exists)',
    (name) => {
      expect(() => build(sample(name))).not.toThrow();
    },
  );
});
