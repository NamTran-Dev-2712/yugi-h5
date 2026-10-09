import { FUSION_DEMO_DECK, FUSION_DEMO_EXTRA_DECK, isFusionEffect } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { chooseAction, type AiInput, type AiPolicy } from './choose-action';
import { simulate, summarize, type SimResult } from './simulate';

/**
 * Task 4.5b: simulations with `FUSION_DEMO_DECK` (real cards: SMP-116 fuses SMP-045 / 046 / 047). The AI is NOT taught
 * to Fusion Summon (P8) and, in a real `solo-vs-ai` duel, its seat has no Extra Deck (`DuelManager`):
 * 1) the server AI on both seats, no Extra Deck (what an AI seat really gets): every game ends, the fusion Spell is
 *    never even listed for it, and it never Sets / activates a Spell/Trap on its own;
 * 2) a test-only "fuser" seat (a stand-in for the person: Extra Deck, activates the fusion Spell, answers both prompts,
 *    Sets its Traps) against the server AI without an Extra Deck: fusions really happen and the AI never gets stuck;
 * 3) the Sandbox case — an AI seat that DOES have an Extra Deck and whose fusion Spell is activated for it (a scenario
 *    `script` can do that): the server AI answers both Fusion prompts from `legalActions` and every game still ends.
 * Long run: `AI_SIM_GAMES=100 pnpm --filter @yugi/api exec vitest run simulate.fusion-deck`.
 */
const GAMES = Number(process.env['AI_SIM_GAMES'] ?? 3);
const OFFSET = Number(process.env['AI_SIM_OFFSET'] ?? 0);

const FUSION_PROMPTS: ReadonlySet<string> = new Set([
  'SelectFusionMonster',
  'SelectFusionMaterials',
]);

const ownCard = (input: AiInput, instanceId: string) => {
  const own = input.view.players[input.view.viewerIndex];
  const card = [...own.hand, ...own.board.spellTrapZones, own.board.fieldZone].find(
    (c) => c?.instanceId === instanceId,
  );
  return card && !card.hidden ? input.cardDefinitions(card.definitionId) : undefined;
};
/** Read from the card data (the `FusionSummon` operation), not from the id. */
const isFusionSpell = (input: AiInput, instanceId: string): boolean =>
  (ownCard(input, instanceId)?.effects ?? []).some(isFusionEffect);

/** The server AI, watched: it must answer inside `legalActions`, never surrender. */
function tracked() {
  const seen = {
    decisions: 0,
    fusionSpellListed: 0,
    fusionSpellActivated: 0,
    fusionPromptsAnswered: 0,
    spellTrapOnItsOwn: 0,
  };
  const policy: AiPolicy = (input) => {
    const answer = chooseAction(input);
    const key = JSON.stringify(answer);
    if (!input.legalActions.some((a) => JSON.stringify(a) === key)) {
      throw new Error(`AI answered outside legalActions: ${key}`);
    }
    if (answer.type === 'Surrender') throw new Error('AI surrendered');
    seen.decisions++;
    if (
      input.legalActions.some(
        (a) => a.type === 'ActivateEffect' && isFusionSpell(input, a.payload.cardInstanceId),
      )
    ) {
      seen.fusionSpellListed++;
    }
    if (answer.type === 'ActivateEffect' && isFusionSpell(input, answer.payload.cardInstanceId)) {
      seen.fusionSpellActivated++;
    }
    const prompt = input.view.pendingPrompt;
    if (prompt && FUSION_PROMPTS.has(prompt.kind) && answer.type === 'ResolvePendingPrompt') {
      seen.fusionPromptsAnswered++;
    }
    const inWindow = input.view.chainWindow?.priorityPlayer === input.view.viewerIndex;
    if (!inWindow && (answer.type === 'SetSpellTrap' || answer.type === 'ActivateEffect')) {
      seen.spellTrapOnItsOwn++;
    }
    return answer;
  };
  return { seen, policy };
}

/**
 * Test-only stand-in for the person: activates the fusion Spell when the engine lists it, answers a Fusion prompt with a
 * listed answer, Sets a Trap when it may; otherwise the server AI's choice.
 */
function fuser(counts: {
  activations: number;
  monsterAnswers: number;
  materialAnswers: number;
}): AiPolicy {
  return (input) => {
    const prompt = input.view.pendingPrompt;
    if (prompt && FUSION_PROMPTS.has(prompt.kind)) {
      const answer = input.legalActions.find((a) => a.type === 'ResolvePendingPrompt');
      if (!answer) throw new Error(`no listed answer for ${prompt.kind}`);
      if (prompt.kind === 'SelectFusionMonster') counts.monsterAnswers++;
      else counts.materialAnswers++;
      return answer;
    }
    if (input.view.chainWindow === null && prompt === null) {
      const fuse = input.legalActions.find(
        (a) => a.type === 'ActivateEffect' && isFusionSpell(input, a.payload.cardInstanceId),
      );
      if (fuse) {
        counts.activations++;
        return fuse;
      }
      const set = input.legalActions.find(
        (a) =>
          a.type === 'SetSpellTrap' && ownCard(input, a.payload.cardInstanceId)?.kind === 'Trap',
      );
      if (set) return set;
    }
    return chooseAction(input);
  };
}

/** Test-only: activates the fusion Spell FOR the wrapped policy (as a Sandbox `script` may); everything else is `inner`. */
const fusionActivatedFor =
  (inner: AiPolicy, counts: { activations: number }): AiPolicy =>
  (input) => {
    if (input.view.chainWindow === null && input.view.pendingPrompt === null) {
      const fuse = input.legalActions.find(
        (a) => a.type === 'ActivateEffect' && isFusionSpell(input, a.payload.cardInstanceId),
      );
      if (fuse) {
        counts.activations++;
        return fuse;
      }
    }
    return inner(input);
  };

/** Let the vitest worker answer its RPC between games (a long synchronous test starves it under load; ADR 062). */
const yieldToWorker = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function run(
  prefix: string,
  policies: readonly [AiPolicy, AiPolicy],
  extraDecks?: readonly [readonly string[], readonly string[]],
): Promise<SimResult[]> {
  const results: SimResult[] = [];
  for (let i = OFFSET; i < OFFSET + GAMES; i++) {
    await yieldToWorker();
    results.push(
      simulate({
        seed: `${prefix}-${i}`,
        policies,
        deck: FUSION_DEMO_DECK,
        ...(extraDecks ? { extraDecks } : {}),
      }),
    );
  }
  return results;
}

describe('simulations with FUSION_DEMO_DECK (task 4.5b, real Fusion cards)', () => {
  it('the server AI on both seats, no Extra Deck: the fusion Spell is never listed, every game ends', async () => {
    const { seen, policy } = tracked();
    const s = summarize(await run('fu', [policy, policy]));
    console.info(
      `[AI vs AI fusion deck] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      seen,
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.deadPrompts, 'prompts nobody could answer').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(seen.fusionSpellListed, 'decisions with the fusion Spell listed').toBe(0);
    expect(seen.fusionSpellActivated).toBe(0);
    expect(seen.spellTrapOnItsOwn, 'Spell/Trap moves outside a window').toBe(0);
  }, 600_000);

  it('a seat that really fuses (Extra Deck) against the server AI without one: fusions happen, the AI never gets stuck', async () => {
    const { seen, policy } = tracked();
    const counts = { activations: 0, monsterAnswers: 0, materialAnswers: 0 };
    const s = summarize(await run('fuh', [fuser(counts), policy], [FUSION_DEMO_EXTRA_DECK, []]));
    console.info(
      `[fuser vs AI, fusion deck] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      { ...counts, aiDecisions: seen.decisions, aiSpellTrapOnItsOwn: seen.spellTrapOnItsOwn },
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.deadPrompts, 'prompts nobody could answer').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(counts.activations, 'fusion Spells activated against the AI').toBeGreaterThan(0);
    expect(counts.materialAnswers, 'Fusion Summons completed').toBeGreaterThan(0);
    expect(seen.fusionSpellListed, 'AI decisions with the fusion Spell listed').toBe(0);
    expect(seen.fusionPromptsAnswered, 'Fusion prompts the AI was asked').toBe(0);
    expect(seen.spellTrapOnItsOwn, 'Spell/Trap moves of the AI outside a window').toBe(0);
  }, 600_000);

  it('Sandbox case — the AI seat has an Extra Deck and its fusion Spell is activated for it: it answers both prompts, every game ends', async () => {
    const { seen, policy } = tracked();
    const counts = { activations: 0 };
    const pushed = fusionActivatedFor(policy, counts);
    const s = summarize(
      await run('fua', [pushed, pushed], [FUSION_DEMO_EXTRA_DECK, FUSION_DEMO_EXTRA_DECK]),
    );
    console.info(
      `[AI with Extra Deck, fusion pushed] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      { ...counts, fusionPromptsAnswered: seen.fusionPromptsAnswered },
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.deadPrompts, 'prompts nobody could answer').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(counts.activations, 'fusion Spells activated for the AI').toBeGreaterThan(0);
    expect(seen.fusionPromptsAnswered, 'Fusion prompts the AI answered').toBeGreaterThan(0);
    // The AI itself never chose to activate the fusion Spell: every activation came from the wrapper.
    expect(seen.fusionSpellActivated).toBe(0);
  }, 600_000);
});
