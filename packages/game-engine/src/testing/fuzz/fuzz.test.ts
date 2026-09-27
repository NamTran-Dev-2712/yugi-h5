import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import { formatFuzzFailure, runFuzz } from './fuzz.js';
import type { ApplyFn, FuzzResult } from './fuzz.js';

/*
 * Fixed seeds keep the normal suite fast and reproducible. For a longer hunt:
 *   FUZZ_SEEDS=300 FUZZ_STEPS=1000 pnpm --filter @yugi/game-engine test fuzz
 * On failure the assertion message carries the seed, step and the full action log.
 */
const SEED_COUNT = Number(process.env['FUZZ_SEEDS'] ?? 10);
const STEPS = Number(process.env['FUZZ_STEPS'] ?? 300);
const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => `fuzz-${i + 1}`);

describe('fuzz: engine invariants hold', () => {
  it.each(SEEDS)('seed %s', (seed) => {
    const result = runFuzz({ seed, steps: STEPS });
    expect(result.ok, formatFuzzFailure(result)).toBe(true);
  });

  it('actually exercises the engine (not all rejections, duels finish, attacks happen)', () => {
    let accepted = 0;
    let rejected = 0;
    let duelsEnded = 0;
    let maxChainLength = 0;
    let fieldLinks = 0;
    let speed3Links = 0;
    const byType: Record<string, number> = {};
    for (const seed of SEEDS.slice(0, 10)) {
      const result = runFuzz({ seed, steps: STEPS });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      rejected += result.stats.rejected;
      duelsEnded += result.stats.duelsEnded;
      maxChainLength = Math.max(maxChainLength, result.stats.maxChainLength);
      fieldLinks += result.stats.fieldLinks;
      speed3Links += result.stats.speed3Links;
      for (const [type, n] of Object.entries(result.stats.accepted)) {
        accepted += n;
        byType[type] = (byType[type] ?? 0) + n;
      }
    }
    expect(accepted / (accepted + rejected)).toBeGreaterThan(0.3);
    expect(duelsEnded).toBeGreaterThan(0);
    for (const type of [
      'EndPhase',
      'NormalSummon',
      'SetMonster',
      'DeclareAttack',
      'SetSpellTrap',
      'ActivateEffect',
      'PassPriority',
    ]) {
      expect(byType[type] ?? 0, `${type} never accepted`).toBeGreaterThan(0);
    }
    // Chains with a window left open (≥ 1 link waiting) and multi-link chains are reached.
    expect(maxChainLength).toBeGreaterThanOrEqual(2);
    // Task 3.4: Set Traps / Quick-Play are activated from the field, and Counter Traps (Speed 3) are chained.
    expect(fieldLinks, 'no link from a Set card').toBeGreaterThan(0);
    expect(speed3Links, 'no Speed 3 link').toBeGreaterThan(0);
  });

  it('is deterministic: same seed → identical action log and stats', () => {
    const a = runFuzz({ seed: 'determinism', steps: 200 });
    const b = runFuzz({ seed: 'determinism', steps: 200 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(runFuzz({ seed: 'other', steps: 200 }).log)).not.toBe(
      JSON.stringify(a.log),
    );
  });
});

describe('fuzz: the checker is not vacuous (detects deliberately broken engines)', () => {
  /** Wraps the real engine and corrupts the result of accepted non-StartDuel actions of `onType`. */
  function broken(
    onType: string,
    corrupt: (r: ReturnType<ApplyFn>) => ReturnType<ApplyFn>,
  ): ApplyFn {
    return (state, action, ctx) => {
      const result = applyAction(state, action, ctx);
      return action.type === onType ? corrupt(result) : result;
    };
  }
  const detect = (apply: ApplyFn): FuzzResult => runFuzz({ seed: 'fuzz-1', steps: 300, apply });

  it('flags a card that disappears', () => {
    const r = detect(
      broken('EndPhase', ({ state, events }) => ({
        events,
        state: {
          ...state,
          players: [
            { ...state.players[0], deck: state.players[0].deck.slice(1) },
            state.players[1],
          ],
        },
      })),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/card/);
  });

  it('flags a duplicated card', () => {
    const r = detect(
      broken('EndPhase', ({ state, events }) => {
        const dup = state.players[0].deck[0];
        return dup
          ? {
              events,
              state: {
                ...state,
                players: [
                  { ...state.players[0], graveyard: [...state.players[0].graveyard, dup] },
                  state.players[1],
                ],
              },
            }
          : { state, events };
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('flags negative life points', () => {
    const r = detect(
      broken('EndPhase', ({ state, events }) => ({
        events,
        state: { ...state, players: [{ ...state.players[0], lifePoints: -1 }, state.players[1]] },
      })),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/LP/);
  });

  it('flags a version that does not increase by one', () => {
    const r = detect(
      broken('EndPhase', ({ state, events }) => ({
        events,
        state: { ...state, version: state.version + 5 },
      })),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/version/);
  });

  it('flags a chain link that loses its card (the Spell vanishes while on the chain)', () => {
    const r = detect(
      broken('ActivateEffect', ({ state, events }) => ({
        events,
        state: {
          ...state,
          chainStack: [],
        },
      })),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/chain|card/);
  });

  it('flags a chain window left open for a player who cannot respond', () => {
    const r = detect(
      broken('ActivateEffect', ({ state, events }) =>
        state.chainWindow
          ? {
              events,
              state: {
                ...state,
                chainWindow: {
                  ...state.chainWindow,
                  priorityPlayer: state.chainWindow.priorityPlayer === 0 ? 1 : 0,
                },
              },
            }
          : { state, events },
      ),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/cannot respond/);
  });

  it('flags a Set card left face-up on the field with no chain link (task 3.4)', () => {
    // After any accepted SetSpellTrap, turn the freshly Set card face-up without activating it.
    const r = detect(
      broken('SetSpellTrap', ({ state, events }) => {
        const set = events.find((e) => e.type === 'SpellTrapSet');
        if (!set || set.type !== 'SpellTrapSet') return { state, events };
        const p = state.players[set.playerIndex];
        const spellTrapZones = p.board.spellTrapZones.map((c, i) =>
          i === set.zoneIndex && c ? { ...c, position: 'Attack' as const } : c,
        ) as unknown as typeof p.board.spellTrapZones;
        const next = { ...p, board: { ...p.board, spellTrapZones } };
        return {
          events,
          state: {
            ...state,
            players: set.playerIndex === 0 ? [next, state.players[1]] : [state.players[0], next],
          },
        };
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/face-up Spell\/Trap/);
  });

  it('flags an uncontrolled exception', () => {
    const r = detect(
      broken('EndPhase', () => {
        throw new TypeError('boom');
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/uncontrolled exception/);
  });

  it('flags a handler that mutates its input state', () => {
    const r = detect((state, action, ctx) => {
      if (state && action.type === 'EndPhase') (state as { version: number }).version = 999;
      return applyAction(state, action, ctx);
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/uncontrolled exception/);
  });

  it('reports seed, step and the action log on failure', () => {
    const r = detect(
      broken('EndPhase', ({ state, events }) => ({ events, state: { ...state, version: 0 } })),
    );
    expect(r.ok).toBe(false);
    const text = formatFuzzFailure(r);
    expect(text).toContain('seed="fuzz-1"');
    expect(text).toContain('"type":"StartDuel"');
  });
});
