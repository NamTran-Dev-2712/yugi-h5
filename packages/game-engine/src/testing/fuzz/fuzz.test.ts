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
    const byType: Record<string, number> = {};
    for (const seed of SEEDS.slice(0, 10)) {
      const result = runFuzz({ seed, steps: STEPS });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      rejected += result.stats.rejected;
      duelsEnded += result.stats.duelsEnded;
      for (const [type, n] of Object.entries(result.stats.accepted)) {
        accepted += n;
        byType[type] = (byType[type] ?? 0) + n;
      }
    }
    expect(accepted / (accepted + rejected)).toBeGreaterThan(0.3);
    expect(duelsEnded).toBeGreaterThan(0);
    for (const type of ['EndPhase', 'NormalSummon', 'SetMonster', 'DeclareAttack']) {
      expect(byType[type] ?? 0, `${type} never accepted`).toBeGreaterThan(0);
    }
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
