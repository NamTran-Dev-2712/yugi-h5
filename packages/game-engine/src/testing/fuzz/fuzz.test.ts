import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import { EngineError } from '../../errors.js';
import {
  BATCH2_DECK_POOL,
  BATCH2_EXTRA_DECK_POOL,
  EQUIP_TRIGGER_DECK_POOL,
  formatFuzzFailure,
  FUSION_DECK_POOL,
  FUSION_EXTRA_DECK_POOL,
  FUZZ_DEFS,
  IGNITION_DECK_POOL,
  IGNITION_RULESET,
  NEGATE_DECK_POOL,
  runFuzz,
  SUMMON_TRIGGER_DECK_POOL,
} from './fuzz.js';
import type { ApplyFn, FuzzOptions, FuzzResult } from './fuzz.js';

/*
 * Fixed seeds keep the normal suite fast and reproducible. For a longer hunt:
 *   FUZZ_SEEDS=300 FUZZ_STEPS=1000 pnpm --filter @yugi/game-engine test fuzz
 * On failure the assertion message carries the seed, step and the full action log.
 */
const SEED_COUNT = Number(process.env['FUZZ_SEEDS'] ?? 10);
const STEPS = Number(process.env['FUZZ_STEPS'] ?? 300);
const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => `fuzz-${i + 1}`);
/** Task 4.4: seeds of the Negate deck pool (their own names, so the seeds above keep their games). Long run: FUZZ_NEGATE_SEEDS. */
const NEGATE_SEEDS = Array.from(
  { length: Number(process.env['FUZZ_NEGATE_SEEDS'] ?? 5) },
  (_, i) => `negate-long-${i + 1}`,
);
/** Task 4.4c: seeds of the Summon-trigger deck pool. Long run: FUZZ_SUMWIN_SEEDS. */
const SUMMON_TRIGGER_SEEDS = Array.from(
  { length: Number(process.env['FUZZ_SUMWIN_SEEDS'] ?? 5) },
  (_, i) => `sumwin-long-${i + 1}`,
);
/** Task 4.5: seeds of the Fusion deck pool + Extra Deck pool. Long run: FUZZ_FUSION_SEEDS. */
const FUSION_SEEDS = Array.from(
  { length: Number(process.env['FUZZ_FUSION_SEEDS'] ?? 5) },
  (_, i) => `fusion-long-${i + 1}`,
);
/** Task 4.5: the Fusion variant — decks from FUSION_DECK_POOL, Extra Decks from FUSION_EXTRA_DECK_POOL. */
const FUSION: Pick<FuzzOptions, 'deckPool' | 'extraDeckPool'> = {
  deckPool: FUSION_DECK_POOL,
  extraDeckPool: FUSION_EXTRA_DECK_POOL,
};

/** Task 4.7: seeds of the batch-2 pool (the REAL cards SMP-048…061 / 117…124 / 211…214). Long run: FUZZ_BATCH2_SEEDS. */
const BATCH2_SEEDS = Array.from(
  { length: Number(process.env['FUZZ_BATCH2_SEEDS'] ?? 5) },
  (_, i) => `batch2-long-${i + 1}`,
);
const BATCH2: Pick<FuzzOptions, 'deckPool' | 'extraDeckPool'> = {
  deckPool: BATCH2_DECK_POOL,
  extraDeckPool: BATCH2_EXTRA_DECK_POOL,
};

/** Task 4.8: seeds of the "Equip leaves with a destroyed trigger monster" pool. Long run: FUZZ_EQUIPTRIG_SEEDS. */
const EQUIP_TRIGGER_SEEDS = Array.from(
  { length: Number(process.env['FUZZ_EQUIPTRIG_SEEDS'] ?? 5) },
  (_, i) => `equiptrig-long-${i + 1}`,
);

/** Task 4.8: seeds of the monster-Ignition pool (ruleset flag on). Long run: FUZZ_IGNITION_SEEDS. */
const IGNITION_SEEDS = Array.from(
  { length: Number(process.env['FUZZ_IGNITION_SEEDS'] ?? 5) },
  (_, i) => `ignition-long-${i + 1}`,
);
/** Task 4.8: the monster-Ignition variant — decks from IGNITION_DECK_POOL, `allowMonsterEffectActivation` on. */
const IGNITION: Pick<FuzzOptions, 'deckPool' | 'ruleset'> = {
  deckPool: IGNITION_DECK_POOL,
  ruleset: IGNITION_RULESET,
};

/** Task 4.2d: let the vitest worker answer its RPC between seeds (a long synchronous test starves it under load). */
const yieldToWorker = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('fuzz: engine invariants hold', () => {
  it.each(SEEDS)('seed %s', (seed) => {
    const result = runFuzz({ seed, steps: STEPS });
    expect(result.ok, formatFuzzFailure(result)).toBe(true);
  });

  it.each(SUMMON_TRIGGER_SEEDS)('seed %s (Summon-trigger deck pool, task 4.4c)', (seed) => {
    const result = runFuzz({ seed, steps: STEPS, deckPool: SUMMON_TRIGGER_DECK_POOL });
    expect(result.ok, formatFuzzFailure(result)).toBe(true);
  });

  it.each(BATCH2_SEEDS)('seed %s (batch-2 real cards + Extra Decks, task 4.7)', (seed) => {
    const result = runFuzz({ seed, steps: STEPS, ...BATCH2 });
    expect(result.ok, formatFuzzFailure(result)).toBe(true);
  });

  it.each(EQUIP_TRIGGER_SEEDS)('seed %s (Equip + trigger-monster deck pool, task 4.8)', (seed) => {
    const result = runFuzz({ seed, steps: STEPS, deckPool: EQUIP_TRIGGER_DECK_POOL });
    expect(result.ok, formatFuzzFailure(result)).toBe(true);
  });

  it.each(IGNITION_SEEDS)(
    'seed %s (monster-Ignition deck pool, ruleset flag on, task 4.8)',
    (seed) => {
      const result = runFuzz({ seed, steps: STEPS, ...IGNITION });
      expect(result.ok, formatFuzzFailure(result)).toBe(true);
    },
  );

  it.each(NEGATE_SEEDS)('seed %s (Negate deck pool, task 4.4)', (seed) => {
    const result = runFuzz({ seed, steps: STEPS, deckPool: NEGATE_DECK_POOL });
    expect(result.ok, formatFuzzFailure(result)).toBe(true);
  });

  it.each(FUSION_SEEDS)('seed %s (Fusion deck pool + Extra Decks, task 4.5)', (seed) => {
    const result = runFuzz({ seed, steps: STEPS, ...FUSION });
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
    let promptStatesChecked = 0;
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
      promptStatesChecked += result.stats.promptStatesChecked;
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
    // Task 4.8: prompts are really open between actions — each of those states was checked to have an answer.
    expect(promptStatesChecked, 'no open prompt was ever checked').toBeGreaterThan(0);
    // Task 4.2d: explicit timeout — ~2 s alone, 3–6× slower while the whole workspace tests in parallel.
  }, 120_000);

  it('an Equip follows its monster to the graveyard in real duels (task 4.2c; rare: 60 seeds × 400 steps)', async () => {
    let detached = 0;
    let setEquipLinks = 0;
    for (let i = 1; i <= 60; i++) {
      await yieldToWorker();
      const result = runFuzz({ seed: `fuzz-${i}`, steps: 400 });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      detached += result.stats.equipsDetached;
      setEquipLinks += result.stats.setEquipLinks;
    }
    console.log(`fuzz 4.4c Set Equip Spells activated: ${setEquipLinks}`);
    expect(detached).toBeGreaterThan(0);
    // Task 4.4c: Equip Spells are really activated from where they were Set.
    expect(setEquipLinks).toBeGreaterThan(0);
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

  it('Counter Traps and Negate effects are really played (task 4.4; own seeds and deck pool: 80 × 400 steps)', async () => {
    const total = {
      counterTrapLinks: 0,
      activationsNegated: 0,
      stayingCardsNegated: 0,
      attacksNegated: 0,
      summonsNegated: 0,
    };
    // A variant of its own (ADR 064 lesson): a negation is too rare with the full pool, so these seeds draw their decks
    // from NEGATE_DECK_POOL. Same generator, same invariants; the seeds above keep the full pool.
    for (let i = 1; i <= 80; i++) {
      await yieldToWorker();
      const result = runFuzz({ seed: `negate-${i}`, steps: 400, deckPool: NEGATE_DECK_POOL });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      for (const key of Object.keys(total) as (keyof typeof total)[])
        total[key] += result.stats[key];
    }
    console.log(`fuzz 4.4 coverage: ${JSON.stringify(total)}`);
    for (const [key, n] of Object.entries(total))
      expect(n, `${key} never happened`).toBeGreaterThan(0);
  }, 120_000);

  it('the Summon window really comes before OnSummon / OnFlip triggers (task 4.4c; own seeds and deck pool: 60 × 400 steps)', async () => {
    const total = {
      summonWindowsBeforeTrigger: 0,
      triggerSummonsNegated: 0,
      triggersAfterSummonWindow: 0,
      summonsNegated: 0,
      flipLinks: 0,
      triggerPrompts: 0,
    };
    // A variant of its own (ADR 064 lesson): trigger monsters against Summon negation, drawn from
    // SUMMON_TRIGGER_DECK_POOL. Same generator, same invariants; every older seed keeps its pool.
    for (let i = 1; i <= 60; i++) {
      await yieldToWorker();
      const result = runFuzz({
        seed: `sumwin-${i}`,
        steps: 400,
        deckPool: SUMMON_TRIGGER_DECK_POOL,
      });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      for (const key of Object.keys(total) as (keyof typeof total)[])
        total[key] += result.stats[key];
    }
    console.log(`fuzz 4.4c coverage: ${JSON.stringify(total)}`);
    for (const [key, n] of Object.entries(total))
      expect(n, `${key} never happened`).toBeGreaterThan(0);
  }, 120_000);

  it('Fusion Summons are really played (task 4.5; own seeds, deck pool and Extra Decks: 60 × 400 steps)', async () => {
    const total = {
      fusionSummons: 0,
      fusionFieldMaterials: 0,
      fusionDeckMaterials: 0,
      fusionsNegated: 0,
      fusionsWithoutEffect: 0,
      fusionTriggerLinks: 0,
      fusionPausesWithOwedTriggers: 0,
    };
    let rejectedAnswers = 0;
    // A variant of its own (ADR 064 lesson): the default pool has no fusion card, and without an Extra Deck nothing
    // could be fused anyway. Same generator, same invariants; every older seed keeps its pool and its random stream.
    for (let i = 1; i <= 60; i++) {
      await yieldToWorker();
      const result = runFuzz({ seed: `fusion-${i}`, steps: 400, ...FUSION });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      for (const key of Object.keys(total) as (keyof typeof total)[])
        total[key] += result.stats[key];
      rejectedAnswers += result.stats.rejected;
    }
    console.log(`fuzz 4.5 coverage: ${JSON.stringify(total)} (rejected: ${rejectedAnswers})`);
    // `fusionsWithoutEffect` is only printed: random play does not reach "the last material is destroyed in response"
    // (0 in 60 × 400 steps, and 0 with a field-only pool too). That branch is covered by rules/fusion.test.ts and the
    // golden `fusion-material-destroyed-in-response`, not by the fuzz.
    for (const [key, n] of Object.entries(total)) {
      if (key === 'fusionsWithoutEffect') continue;
      expect(n, `${key} never happened`).toBeGreaterThan(0);
    }
  }, 120_000);

  it('the real batch-2 cards are really played (task 4.7; own seeds, deck pool and Extra Decks: 60 × 400 steps)', async () => {
    const total = {
      triggerLinks: 0,
      triggerPrompts: 0,
      flipLinks: 0,
      continuousApplied: 0,
      specialSummons: 0,
      equips: 0,
      equipsDetached: 0,
      fieldSpellLinks: 0,
      continuousCardsStayed: 0,
      activationsNegated: 0,
      counterTrapLinks: 0,
      fusionSummons: 0,
    };
    const played = new Set<string>();
    // A variant of its own: the default pool has no batch-2 card, so every older seed keeps its pool and its stream.
    for (let i = 1; i <= 60; i++) {
      await yieldToWorker();
      const result = runFuzz({ seed: `batch2-${i}`, steps: 400, ...BATCH2 });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      for (const key of Object.keys(total) as (keyof typeof total)[])
        total[key] += result.stats[key];
      for (const action of result.log) {
        if (action.type !== 'StartDuel') continue;
        for (const id of action.payload.deckLists.flat()) played.add(id);
        for (const id of (action.payload.extraDeckLists ?? []).flat()) played.add(id);
      }
    }
    console.log(`fuzz 4.7 coverage: ${JSON.stringify(total)}`);
    for (const [key, n] of Object.entries(total))
      expect(n, `${key} never happened`).toBeGreaterThan(0);
    // Every card of the batch was in some deck of these runs.
    for (const id of [...BATCH2_DECK_POOL, ...BATCH2_EXTRA_DECK_POOL])
      expect(played.has(id), id).toBe(true);
  }, 180_000);

  it('a trigger monster is really destroyed with an Equip on it, and its prompts are answerable (task 4.8; own seeds and deck pool: 60 × 400 steps)', async () => {
    const total = {
      equipLeftWithTriggerMonster: 0,
      triggerPrompts: 0,
      triggerLinks: 0,
      promptStatesChecked: 0,
      equipsDetached: 0,
    };
    // A variant of its own: the default pool has neither MDS nor MDSM, so every older seed keeps its pool and stream.
    for (let i = 1; i <= 60; i++) {
      await yieldToWorker();
      const result = runFuzz({
        seed: `equiptrig-${i}`,
        steps: 400,
        deckPool: EQUIP_TRIGGER_DECK_POOL,
      });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      for (const key of Object.keys(total) as (keyof typeof total)[])
        total[key] += result.stats[key];
    }
    console.log(`fuzz 4.8 Equip + trigger coverage: ${JSON.stringify(total)}`);
    for (const [key, n] of Object.entries(total))
      expect(n, `${key} never happened`).toBeGreaterThan(0);
  }, 120_000);

  it('monsters really activate Ignition effects from the field (task 4.8; own seeds, deck pool and ruleset: 60 × 400 steps)', async () => {
    const total = {
      monsterIgnitionLinks: 0,
      monsterIgnitionsNegated: 0,
      oncePerTurnRefused: 0,
      oncePerTurnReused: 0,
      promptStatesChecked: 0,
    };
    const paid = { PayLP: 0, Discard: 0, Tribute: 0 };
    // A variant of its own: no other run has the flag, so no older seed ever lists or accepts such an activation.
    for (let i = 1; i <= 60; i++) {
      await yieldToWorker();
      const result = runFuzz({ seed: `ignition-${i}`, steps: 400, ...IGNITION });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      for (const key of Object.keys(total) as (keyof typeof total)[])
        total[key] += result.stats[key];
      // Which costs were really paid: replay the accepted activations of a monster by their definition.
      let state: ReturnType<typeof applyAction>['state'] | null = null;
      const ctx = { cardDefinitions: (id: string) => FUZZ_DEFS[id] };
      for (const action of result.log) {
        let next;
        try {
          next = applyAction(action.type === 'StartDuel' ? null : state, action, ctx);
        } catch (error) {
          if (!(error instanceof EngineError)) throw error;
          continue;
        }
        if (state && action.type === 'ActivateEffect') {
          const monster = state.players[action.payload.playerIndex].board.monsterZones.find(
            (c) => c?.instanceId === action.payload.cardInstanceId,
          );
          const effect = monster
            ? FUZZ_DEFS[monster.definitionId]?.effects?.find(
                (e) => e.id === action.payload.effectId,
              )
            : undefined;
          for (const cost of effect?.cost ?? []) paid[cost.kind]++;
        }
        state = next.state;
      }
    }
    console.log(`fuzz 4.8 monster Ignition coverage: ${JSON.stringify({ ...total, paid })}`);
    for (const [key, n] of Object.entries(total))
      expect(n, `${key} never happened`).toBeGreaterThan(0);
    for (const [kind, n] of Object.entries(paid))
      expect(n, `cost ${kind} never paid by a monster`).toBeGreaterThan(0);
  }, 180_000);

  it('without the ruleset flag the very same pool never activates a monster effect (task 4.8)', async () => {
    let links = 0;
    let refused = 0;
    for (let i = 1; i <= 10; i++) {
      await yieldToWorker();
      const result = runFuzz({ seed: `ignition-${i}`, steps: 400, deckPool: IGNITION_DECK_POOL });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      links += result.stats.monsterIgnitionLinks;
      refused += result.stats.oncePerTurnRefused;
      for (const action of result.log)
        if (action.type === 'StartDuel') expect(action.payload.ruleset).toBeUndefined();
    }
    expect(links).toBe(0);
    expect(refused).toBe(0);
  }, 120_000);

  it('older runs never see a task-4.8 card: the default, Negate, Summon-trigger, Fusion and batch-2 pools have none', () => {
    const older: [string, Pick<FuzzOptions, 'deckPool' | 'extraDeckPool'>][] = [
      ['fuzz-1', {}],
      ['negate-1', { deckPool: NEGATE_DECK_POOL }],
      ['sumwin-1', { deckPool: SUMMON_TRIGGER_DECK_POOL }],
      ['fusion-1', FUSION],
      ['batch2-1', BATCH2],
    ];
    for (const [seed, pools] of older) {
      const result = runFuzz({ seed, steps: 300, ...pools });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      for (const action of result.log) {
        if (action.type !== 'StartDuel') continue;
        expect(action.payload.ruleset, `${seed}: a ruleset override`).toBeUndefined();
        for (const id of action.payload.deckLists.flat())
          expect(
            ['MDS', 'MDSM', 'MIP', 'MID', 'MIO', 'MIK', 'MIT', 'TNM'].includes(id),
            `${seed}: ${id}`,
          ).toBe(false);
      }
      expect(result.stats.equipLeftWithTriggerMonster).toBe(0);
      expect(result.stats.monsterIgnitionLinks).toBe(0);
      expect(result.stats.oncePerTurnRefused).toBe(0);
    }
  });

  it('older runs never see a batch-2 card: the default, Negate, Summon-trigger and Fusion pools have none (task 4.7)', () => {
    const older: [string, Pick<FuzzOptions, 'deckPool' | 'extraDeckPool'>][] = [
      ['fuzz-1', {}],
      ['negate-1', { deckPool: NEGATE_DECK_POOL }],
      ['sumwin-1', { deckPool: SUMMON_TRIGGER_DECK_POOL }],
      ['fusion-1', FUSION],
    ];
    for (const [seed, pools] of older) {
      const result = runFuzz({ seed, steps: 300, ...pools });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      for (const action of result.log) {
        if (action.type !== 'StartDuel') continue;
        const ids = [...action.payload.deckLists, ...(action.payload.extraDeckLists ?? [])].flat();
        for (const id of ids) expect(id.startsWith('SMP-'), `${seed}: ${id}`).toBe(false);
      }
    }
  });

  it('older runs never see a fusion card: the default pool has none and no run without extraDeckPool has an Extra Deck (task 4.5)', () => {
    for (const seed of ['fuzz-1', 'fuzz-2', 'fuzz-3']) {
      const result = runFuzz({ seed, steps: 300 });
      if (!result.ok) throw new Error(formatFuzzFailure(result));
      for (const action of result.log) {
        if (action.type !== 'StartDuel') continue;
        expect(action.payload.extraDeckLists).toBeUndefined();
        for (const id of action.payload.deckLists.flat()) {
          const def = FUZZ_DEFS[id];
          expect(def?.kind === 'Monster' && def.category === 'Fusion', id).toBe(false);
          expect(
            (def?.effects ?? []).some((e) => e.operations.some((o) => o.kind === 'FusionSummon')),
            id,
          ).toBe(false);
        }
      }
      expect(result.stats.fusionSummons).toBe(0);
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

  it('flags a negated card that does not end in the graveyard (task 4.4)', () => {
    // After an activation was negated, put the negated card back into its owner's hand (the card set stays intact, so
    // only the 4.4 invariant can report it). Negations are rare: the Negate deck pool and its own seeds.
    const apply = broken('ActivateEffect', ({ state, events }) => {
      const negated = events.find((e) => e.type === 'ChainLinkNegated');
      if (!negated || negated.type !== 'ChainLinkNegated') return { state, events };
      const owner = state.players[negated.playerIndex];
      const card = owner.graveyard.find((c) => c.instanceId === negated.instanceId);
      if (!card) return { state, events };
      const next = {
        ...owner,
        graveyard: owner.graveyard.filter((c) => c !== card),
        hand: [...owner.hand, card],
      };
      return {
        events,
        state: {
          ...state,
          players: negated.playerIndex === 0 ? [next, state.players[1]] : [state.players[0], next],
        },
      };
    });
    let last: FuzzResult | null = null;
    for (let i = 1; i <= 80 && (last === null || last.ok); i++)
      last = runFuzz({ seed: `negate-${i}`, steps: 400, deckPool: NEGATE_DECK_POOL, apply });
    expect(last?.ok).toBe(false);
    if (last && !last.ok) expect(last.violation).toMatch(/not in its owner's graveyard/);
  });

  it('flags a trigger that happens although its Summon was negated (task 4.4c)', () => {
    // After a Summon was negated, pretend the monster's trigger was activated anyway (events only: the state stays
    // legal, so only the 4.4c invariant can report it). Own deck pool and seeds, as for the coverage run.
    const apply = broken('ActivateEffect', ({ state, events }) => {
      const negated = events.find((e) => e.type === 'SummonNegated');
      if (!negated || negated.type !== 'SummonNegated') return { state, events };
      return {
        state,
        events: [
          ...events,
          {
            type: 'EffectActivated',
            playerIndex: negated.playerIndex,
            instanceId: negated.instanceId,
            definitionId: negated.definitionId,
            effectId: 'e1',
          },
        ],
      };
    });
    let last: FuzzResult | null = null;
    for (let i = 1; i <= 60 && (last === null || last.ok); i++)
      last = runFuzz({
        seed: `sumwin-${i}`,
        steps: 400,
        deckPool: SUMMON_TRIGGER_DECK_POOL,
        apply,
      });
    expect(last?.ok).toBe(false);
    if (last && !last.ok) expect(last.violation).toMatch(/after its Summon was negated/);
  });

  it('flags a Summon trigger put on the chain while its Summon window is still open (task 4.4c)', () => {
    // The pre-4.4c order, simulated on the state: the window that owes the triggers also shows a trigger prompt.
    const apply = broken('NormalSummon', ({ state, events }) =>
      state.chainWindow?.summonEvent
        ? {
            events,
            state: {
              ...state,
              pendingPrompt: {
                promptId: 'fake',
                playerIndex: state.turnPlayerIndex,
                kind: 'TriggerActivation',
                payload: {},
              },
            },
          }
        : { state, events },
    );
    let last: FuzzResult | null = null;
    for (let i = 1; i <= 60 && (last === null || last.ok); i++)
      last = runFuzz({
        seed: `sumwin-${i}`,
        steps: 400,
        deckPool: SUMMON_TRIGGER_DECK_POOL,
        apply,
      });
    expect(last?.ok).toBe(false);
    if (last && !last.ok) expect(last.violation).toMatch(/while the Summon window of/);
  });

  /** First failing Fusion run (own seeds, as for the coverage run). */
  const detectFusion = (apply: ApplyFn): FuzzResult => {
    let last: FuzzResult | null = null;
    for (let i = 1; i <= 60 && (last === null || last.ok); i++)
      last = runFuzz({ seed: `fusion-${i}`, steps: 400, ...FUSION, apply });
    return last!;
  };

  it('flags a Fusion material that goes back to the hand instead of the graveyard (task 4.5)', () => {
    // After a Fusion Summon, move its first material from the graveyard back to the hand (the card set stays intact, so
    // only the 4.5 invariant can report it).
    const r = detectFusion(
      broken('ResolvePendingPrompt', ({ state, events }) => {
        const fused = events.find((e) => e.type === 'MonsterFusionSummoned');
        if (!fused || fused.type !== 'MonsterFusionSummoned') return { state, events };
        const owner = state.players[fused.playerIndex];
        const card = owner.graveyard.find((c) => c.instanceId === fused.materialInstanceIds[0]);
        if (!card) return { state, events };
        const next = {
          ...owner,
          graveyard: owner.graveyard.filter((c) => c !== card),
          hand: [...owner.hand, card],
        };
        return {
          events,
          state: {
            ...state,
            players: fused.playerIndex === 0 ? [next, state.players[1]] : [state.players[0], next],
          },
        };
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/Fusion material .* is back in a hand or a Deck/);
  });

  it('flags a Fusion Monster that stays in the Extra Deck after its Summon (task 4.5)', () => {
    // The monster is on the field AND still listed in the Extra Deck under another instance id would change the card
    // set; instead keep it in the Extra Deck and take it off the field: the card set is intact.
    const r = detectFusion(
      broken('ResolvePendingPrompt', ({ state, events }) => {
        const fused = events.find((e) => e.type === 'MonsterFusionSummoned');
        if (!fused || fused.type !== 'MonsterFusionSummoned') return { state, events };
        const owner = state.players[fused.playerIndex];
        const card = owner.board.monsterZones[fused.zoneIndex];
        if (card?.instanceId !== fused.instanceId) return { state, events };
        const monsterZones = owner.board.monsterZones.map((c, i) =>
          i === fused.zoneIndex ? null : c,
        ) as unknown as typeof owner.board.monsterZones;
        const next = {
          ...owner,
          board: { ...owner.board, monsterZones },
          extraDeck: [...owner.extraDeck, { ...card, position: null }],
        };
        return {
          events,
          state: {
            ...state,
            players: fused.playerIndex === 0 ? [next, state.players[1]] : [state.players[0], next],
          },
        };
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/still in an Extra Deck after its Summon/);
  });

  it('flags a Fusion Monster that leaves the graveyard for the hand (task 4.5)', () => {
    // After any accepted EndPhase, a Fusion Monster in a graveyard is moved to its owner's hand.
    const r = detectFusion(
      broken('EndPhase', ({ state, events }) => {
        for (const seat of [0, 1] as const) {
          const owner = state.players[seat];
          const card = owner.graveyard.find(
            (c) =>
              FUZZ_DEFS[c.definitionId]?.kind === 'Monster' &&
              (FUZZ_DEFS[c.definitionId] as { category?: string }).category === 'Fusion',
          );
          if (!card) continue;
          const next = {
            ...owner,
            graveyard: owner.graveyard.filter((c) => c !== card),
            hand: [...owner.hand, card],
          };
          return {
            events,
            state: {
              ...state,
              players: seat === 0 ? [next, state.players[1]] : [state.players[0], next],
            },
          };
        }
        return { state, events };
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/Fusion Monster .* is in player \d's hand/);
  });

  it('flags a card in the Extra Deck that is not a Fusion Monster (task 4.5)', () => {
    // After any accepted EndPhase, the turn player's first hand card is put into their Extra Deck.
    const r = detectFusion(
      broken('EndPhase', ({ state, events }) => {
        const seat = state.turnPlayerIndex;
        const owner = state.players[seat];
        const card = owner.hand[0];
        if (!card) return { state, events };
        const next = { ...owner, hand: owner.hand.slice(1), extraDeck: [...owner.extraDeck, card] };
        return {
          events,
          state: {
            ...state,
            players: seat === 0 ? [next, state.players[1]] : [state.players[0], next],
          },
        };
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/Extra Deck is not a Fusion Monster/);
  });

  /** First failing run over the task-4.8 pool (own seeds, as for the coverage run). */
  const detectEquipTrigger = (apply: ApplyFn): FuzzResult => {
    let last: FuzzResult | null = null;
    for (let i = 1; i <= 60 && (last === null || last.ok); i++)
      last = runFuzz({
        seed: `equiptrig-${i}`,
        steps: 400,
        deckPool: EQUIP_TRIGGER_DECK_POOL,
        apply,
      });
    return last!;
  };

  /**
   * The engine as it was before task 4.8, simulated on top of the real one: a monster with a "when destroyed: destroy 1
   * Spell/Trap" trigger is destroyed while the opponent's Equip Spell — their only Spell/Trap — is on it. The old engine
   * asked the monster's owner to choose that Equip (already in the graveyard when the action ends) and then refused
   * every answer. `refuseAnswers: false` keeps only the first half (the prompt lists the Equip that left).
   */
  const preTask48 = (refuseAnswers: boolean): ApplyFn => {
    const FAKE = 'old-engine-equip-prompt';
    return (state, action, ctx) => {
      if (
        refuseAnswers &&
        action.type === 'ResolvePendingPrompt' &&
        state?.pendingPrompt?.promptId === FAKE &&
        action.payload.promptId === FAKE
      )
        throw new EngineError('INVALID_TRIGGER_ANSWER', 'the trigger can no longer activate.');
      const result = applyAction(state, action, ctx);
      const next = result.state;
      if (!state || next.winnerIndex !== null || next.pendingPrompt || next.chainWindow)
        return result;
      for (const e of result.events) {
        if (e.type !== 'MonsterDestroyed') continue;
        const effect = FUZZ_DEFS[e.definitionId]?.effects?.find(
          (x) => x.trigger.kind === 'OnDestroyed' && x.target?.kind === 'Card',
        );
        if (effect?.target?.kind !== 'Card' || effect.target.zone !== 'SpellTrapZone') continue;
        const other = e.ownerIndex === 0 ? 1 : 0;
        const equip = state.players[other].board.spellTrapZones.find(
          (c) => c?.equippedTo === e.instanceId,
        );
        const backrow = next.players[other].board;
        if (!equip || backrow.fieldZone || backrow.spellTrapZones.some((c) => c !== null)) continue;
        return {
          events: result.events,
          state: {
            ...next,
            pendingPrompt: {
              promptId: FAKE,
              playerIndex: e.ownerIndex,
              kind: 'TriggerActivation',
              payload: {
                trigger: {
                  playerIndex: e.ownerIndex,
                  instanceId: e.instanceId,
                  definitionId: e.definitionId,
                  effectId: effect.id,
                  source: { zone: 'Graveyard' },
                },
                optional:
                  effect.trigger.kind === 'OnDestroyed' && effect.trigger.mandatory !== true,
                candidateInstanceIds: [equip.instanceId],
                count: 1,
                remaining: [],
                afterward: null,
              },
            },
          },
        };
      }
      return result;
    };
  };

  it('flags a prompt nobody can answer — the pre-4.8 engine with an Equip on a destroyed trigger monster (task 4.8)', () => {
    const r = detectEquipTrigger(preTask48(true));
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.violation).toMatch(/TriggerActivation prompt .* has no answer the engine accepts/);
  });

  it('flags a trigger prompt that offers the Equip that left the field with the monster (task 4.8)', () => {
    // The answers are accepted here (the fixed engine takes any answer to a dead trigger as "does not activate"), so
    // only the "never a target" invariant can report it.
    const r = detectEquipTrigger(preTask48(false));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/left the field with .* but is a target of its/);
  });

  /** First failing run over the monster-Ignition pool (own seeds and ruleset, as for the coverage run). */
  const detectIgnition = (apply: ApplyFn): FuzzResult => {
    let last: FuzzResult | null = null;
    for (let i = 1; i <= 60 && (last === null || last.ok); i++)
      last = runFuzz({ seed: `ignition-${i}`, steps: 400, ...IGNITION, apply });
    return last!;
  };
  /** The state with every monster of `seat` rewritten by `change` (null = the zone is emptied). */
  const withMonsters = (
    state: ReturnType<ApplyFn>['state'],
    seat: 0 | 1,
    change: (
      c: NonNullable<(typeof state.players)[0]['board']['monsterZones'][0]>,
    ) => typeof c | null,
    graveyard: (typeof state.players)[0]['graveyard'] = state.players[seat].graveyard,
  ): typeof state => {
    const p = state.players[seat];
    const monsterZones = p.board.monsterZones.map((c) =>
      c ? change(c) : c,
    ) as unknown as typeof p.board.monsterZones;
    const next = { ...p, board: { ...p.board, monsterZones }, graveyard };
    return { ...state, players: seat === 0 ? [next, state.players[1]] : [state.players[0], next] };
  };

  it('flags a monster that goes to the graveyard for having activated its effect (task 4.8)', () => {
    // Like a Spell: after the activation the monster is "used up". The card set stays intact, so only the 4.8
    // invariant can report it.
    const r = detectIgnition(
      broken('ActivateEffect', ({ state, events }) => {
        const added = events.find((e) => e.type === 'ChainLinkAdded');
        if (!added || added.type !== 'ChainLinkAdded') return { state, events };
        const seat = added.playerIndex;
        const card = state.players[seat].board.monsterZones.find(
          (c) => c?.instanceId === added.instanceId,
        );
        if (!card) return { state, events };
        return {
          events,
          state: withMonsters(state, seat, (c) => (c.instanceId === card.instanceId ? null : c), [
            ...state.players[seat].graveyard,
            {
              instanceId: card.instanceId,
              definitionId: card.definitionId,
              ownerIndex: card.ownerIndex,
              position: null,
            },
          ]),
        };
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/left the field by activating its effect/);
  });

  it('flags an activation that leaves no once-per-turn stamp (task 4.8)', () => {
    const r = detectIgnition(
      broken('ActivateEffect', ({ state, events }) => {
        const strip = (seat: 0 | 1, s: typeof state) =>
          withMonsters(s, seat, ({ effectUsedTurns: _dropped, ...rest }) => rest);
        return { events, state: strip(1, strip(0, state)) };
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/carries no turn stamp/);
  });

  it('flags a once-per-turn effect activated twice in a turn (task 4.8)', () => {
    // The stamp is written but forgotten by the next action that is not an activation: the real engine then accepts a
    // second activation in the same turn.
    const strip = (seat: 0 | 1, s: ReturnType<ApplyFn>['state']) =>
      withMonsters(s, seat, ({ effectUsedTurns: _dropped, ...rest }) => rest);
    const r = detectIgnition((state, action, ctx) => {
      const result = applyAction(state, action, ctx);
      if (action.type === 'ActivateEffect' || action.type === 'StartDuel') return result;
      return { events: result.events, state: strip(1, strip(0, result.state)) };
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation).toMatch(/activated its once-per-turn effect .* twice in turn/);
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
