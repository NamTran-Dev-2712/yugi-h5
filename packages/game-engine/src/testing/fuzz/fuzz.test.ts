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

/** Task 4.2d: let the vitest worker answer its RPC between seeds (a long synchronous test starves it under load). */
const yieldToWorker = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('fuzz: engine invariants hold', () => {
  it.each(SEEDS)('seed %s', (seed) => {
    const result = runFuzz({ seed, steps: STEPS });
    expect(result.ok, formatFuzzFailure(result)).toBe(true);
  });

  it('actually exercises the engine (not all rejections, duels finish, attacks happen)', async () => {
    let accepted = 0;
    let rejected = 0;
    let duelsEnded = 0;
    let maxChainLength = 0;
    let fieldLinks = 0;
    let speed3Links = 0;
    let reactionWindows = 0;
    let triggerLinks = 0;
    let triggerPrompts = 0;
    let continuousApplied = 0;
    let specialSummons = 0;
    let flipSummons = 0;
    let flipLinks = 0;
    let equips = 0;
    const byType: Record<string, number> = {};
    // Own fixed seeds (not FUZZ_SEEDS): coverage is statistical; 30 seeds keep every feature reached (task 4.2a
    // widened it from 10 when two more cards in the pool thinned out the multi-link chains).
    for (const seed of Array.from({ length: 30 }, (_, i) => `fuzz-${i + 1}`)) {
      await yieldToWorker();
      const result = runFuzz({ seed, steps: STEPS });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      rejected += result.stats.rejected;
      duelsEnded += result.stats.duelsEnded;
      maxChainLength = Math.max(maxChainLength, result.stats.maxChainLength);
      fieldLinks += result.stats.fieldLinks;
      speed3Links += result.stats.speed3Links;
      reactionWindows += result.stats.reactionWindows;
      triggerLinks += result.stats.triggerLinks;
      triggerPrompts += result.stats.triggerPrompts;
      continuousApplied += result.stats.continuousApplied;
      specialSummons += result.stats.specialSummons;
      flipSummons += result.stats.flipSummons;
      flipLinks += result.stats.flipLinks;
      equips += result.stats.equips;
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
      'FlipSummon',
    ]) {
      expect(byType[type] ?? 0, `${type} never accepted`).toBeGreaterThan(0);
    }
    // Chains with a window left open (≥ 1 link waiting) and multi-link chains are reached.
    expect(maxChainLength).toBeGreaterThanOrEqual(2);
    // Task 3.4: Set Traps / Quick-Play are activated from the field, and Counter Traps (Speed 3) are chained.
    expect(fieldLinks, 'no link from a Set card').toBeGreaterThan(0);
    expect(speed3Links, 'no Speed 3 link').toBeGreaterThan(0);
    // Task 3.4c: attacks and Summons/Sets open reaction windows for an opponent holding a Set card.
    expect(reactionWindows, 'no reaction window').toBeGreaterThan(0);
    // Task 3.5: trigger effects go on the chain, and optional ones ask their owner.
    expect(triggerLinks, 'no trigger link').toBeGreaterThan(0);
    expect(triggerPrompts, 'no TriggerActivation prompt').toBeGreaterThan(0);
    // Task 3.6: Continuous effects actually modify stats on the board.
    expect(continuousApplied, 'no Continuous modifier in force').toBeGreaterThan(0);
    // Task 4.2a: effects Special Summon monsters from the hand / graveyard.
    expect(specialSummons, 'no Special Summon').toBeGreaterThan(0);
    // Task 4.2b: Flip Summons happen and flip effects reach the chain.
    expect(flipSummons, 'no Flip Summon').toBeGreaterThan(0);
    expect(flipLinks, 'no OnFlip link').toBeGreaterThan(0);
    // Task 4.2c: Equip Spells get equipped, and some follow their monster to the graveyard.
    expect(equips, 'no Equip').toBeGreaterThan(0);
    // Task 4.2d: explicit timeout — ~2 s alone, 3–6× slower while the whole workspace tests in parallel.
  }, 120_000);

  it('an Equip follows its monster to the graveyard in real duels (task 4.2c; rare: 60 seeds × 400 steps)', async () => {
    let detached = 0;
    for (let i = 1; i <= 60; i++) {
      await yieldToWorker();
      const result = runFuzz({ seed: `fuzz-${i}`, steps: 400 });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      detached += result.stats.equipsDetached;
    }
    expect(detached).toBeGreaterThan(0);
  }, 120_000);

  it('Field Spells and Continuous Spells/Traps are really played (task 4.3; own seeds: 60 × 400 steps)', async () => {
    const total = {
      fieldSpellSets: 0,
      fieldSpellLinks: 0,
      fieldSpellsReplaced: 0,
      fieldSpellsDestroyed: 0,
      continuousCardsStayed: 0,
      setNormalSpellLinks: 0,
    };
    for (let i = 1; i <= 60; i++) {
      await yieldToWorker();
      const result = runFuzz({ seed: `fuzz-${i}`, steps: 400 });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      for (const key of Object.keys(total) as (keyof typeof total)[])
        total[key] += result.stats[key];
    }
    console.log(`fuzz 4.3 coverage: ${JSON.stringify(total)}`);
    for (const [key, n] of Object.entries(total))
      expect(n, `${key} never happened`).toBeGreaterThan(0);
  }, 120_000);

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
  // First failing run over fixed seeds (task 4.2b: one seed stopped reaching an open chain window once the action mix
  // gained FlipSummon; the scenarios these breaks need are rare, not the checker weaker).
  const detect = (apply: ApplyFn): FuzzResult => {
    let last: FuzzResult | null = null;
    for (let i = 1; i <= 30; i++) {
      last = runFuzz({ seed: `fuzz-${i}`, steps: 300, apply });
      if (!last.ok) return last;
    }
    return last!;
  };

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
    // Only a window with links on the chain (task 4.3: with more cards in the pool the first hit used to be an
    // activation answered inside an EMPTY reaction window, which the reaction-window invariant reports instead).
    const r = detect(
      broken('ActivateEffect', ({ state, events }) =>
        state.chainWindow && state.chainStack.length > 0
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

  it('flags an empty chain window that is not a valid reaction window (task 3.4c)', () => {
    // After an accepted EndPhase, leave a window open for the turn player with no chain and no reactionTo.
    const r = detect(
      broken('EndPhase', ({ state, events }) => ({
        events,
        state: {
          ...state,
          chainWindow: { priorityPlayer: state.turnPlayerIndex, passCount: 0 },
        },
      })),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/not a valid reaction window|cannot respond/);
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
