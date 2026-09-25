import { describe, expect, it } from 'vitest';
import { ScenarioSchema } from './scenario-schema.js';

const player = (over: Record<string, unknown> = {}) => ({
  lp: 8000,
  hand: ['SMP-001'],
  deck: ['SMP-002'],
  field: { monsters: [], spellTraps: [] },
  gy: [],
  ...over,
});

const base = (over: Record<string, unknown> = {}) => ({
  name: 'demo',
  seed: 'seed-1',
  players: [player(), player()],
  turn: { count: 1, player: 0 },
  phase: 'Main1',
  ...over,
});

const ok = (v: unknown) => ScenarioSchema.safeParse(v).success;

describe('ScenarioSchema', () => {
  it('accepts a minimal scenario', () => {
    expect(ok(base())).toBe(true);
  });

  it('accepts field cards, ruleset override and a script', () => {
    expect(
      ok(
        base({
          ruleset: { firstTurnAttack: true },
          players: [
            player({
              field: {
                monsters: [{ card: 'SMP-001', zone: 0, position: 'Attack', summonedTurn: 0 }],
                spellTraps: [{ card: 'SMP-201', zone: 2 }],
              },
              gy: ['SMP-003'],
            }),
            player(),
          ],
          script: [{ type: 'EndPhase', payload: { playerIndex: 0 } }],
        }),
      ),
    ).toBe(true);
  });

  it.each([
    ['missing name', base({ name: undefined })],
    ['empty name', base({ name: '' })],
    ['one player', base({ players: [player()] })],
    ['three players', base({ players: [player(), player(), player()] })],
    ['lp 0', base({ players: [player({ lp: 0 }), player()] })],
    ['fractional lp', base({ players: [player({ lp: 10.5 }), player()] })],
    ['unknown phase', base({ phase: 'Battlee' })],
    ['turn count 0', base({ turn: { count: 0, player: 0 } })],
    ['turn player 2', base({ turn: { count: 1, player: 2 } })],
    ['unknown top-level key', base({ extra: 1 })],
    ['unknown player key', base({ players: [player({ cheat: true }), player()] })],
    [
      'zone 5',
      base({
        players: [
          player({
            field: { monsters: [{ card: 'SMP-001', zone: 5, position: 'Attack' }], spellTraps: [] },
          }),
          player(),
        ],
      }),
    ],
    [
      'monster position null',
      base({
        players: [
          player({
            field: {
              monsters: [{ card: 'SMP-001', zone: 0, position: 'Sideways' }],
              spellTraps: [],
            },
          }),
          player(),
        ],
      }),
    ],
    [
      'script with StartDuel',
      base({ script: [{ type: 'StartDuel', payload: { playerIndex: 0 } }] }),
    ],
    ['script with malformed action', base({ script: [{ type: 'EndPhase' }] })],
    ['bad ruleset value', base({ ruleset: { handLimit: -1 } })],
  ])('rejects %s', (_name, value) => {
    expect(ok(value)).toBe(false);
  });

  it('defaults spell/trap position to face-down', () => {
    const parsed = ScenarioSchema.parse(
      base({
        players: [
          player({ field: { monsters: [], spellTraps: [{ card: 'SMP-201', zone: 1 }] } }),
          player(),
        ],
      }),
    );
    expect(parsed.players[0].field.spellTraps[0]?.position).toBe('DefenseDown');
  });
});
