import { BATCH2_DEMO_DECK, BATCH2_FUSION_EXTRA_DECK } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { chooseAction, type AiPolicy } from './choose-action';
import { simulate, summarize, type SimResult } from './simulate';

/**
 * Task 4.7: simulations with `BATCH2_DEMO_DECK` (the 24 Main Deck cards of batch 2 + the fusion Spell; real data). The
 * AI is not taught any of these cards (P8): it only answers what the engine asks and what it already knew.
 * 1) the server AI on both seats, no Extra Deck (what an AI seat really gets): every game ends, it never Sets /
 *    activates a Spell/Trap on its own, and it answers the trigger prompts of the batch monsters;
 * 2) a test-only "player" seat (a stand-in for the person: Extra Deck, says yes to every prompt, activates whatever the
 *    engine lists, Sets its Spells / Traps) against the server AI: the batch cards are really used, nobody gets stuck;
 * 3) that "player" on both seats (the most card play a duel can hold): every game still ends.
 * Long run: `AI_SIM_GAMES=100 pnpm --filter @yugi/api exec vitest run simulate.batch2-deck`.
 */
const GAMES = Number(process.env['AI_SIM_GAMES'] ?? 3);
const OFFSET = Number(process.env['AI_SIM_OFFSET'] ?? 0);

/** The server AI, watched: it must answer inside `legalActions`, never surrender. */
function tracked() {
  const seen = { decisions: 0, promptsAnswered: 0, windowActivations: 0, spellTrapOnItsOwn: 0 };
  const policy: AiPolicy = (input) => {
    const answer = chooseAction(input);
    const key = JSON.stringify(answer);
    if (!input.legalActions.some((a) => JSON.stringify(a) === key)) {
      throw new Error(`AI answered outside legalActions: ${key}`);
    }
    if (answer.type === 'Surrender') throw new Error('AI surrendered');
    seen.decisions++;
    if (answer.type === 'ResolvePendingPrompt') seen.promptsAnswered++;
    const inWindow = input.view.chainWindow?.priorityPlayer === input.view.viewerIndex;
    if (inWindow && answer.type === 'ActivateEffect') seen.windowActivations++;
    if (!inWindow && (answer.type === 'SetSpellTrap' || answer.type === 'ActivateEffect')) {
      seen.spellTrapOnItsOwn++;
    }
    return answer;
  };
  return { seen, policy };
}

interface PlayerCounts {
  promptAnswers: number;
  activations: number;
  sets: number;
}

/**
 * Test-only stand-in for the person: accepts every prompt with a listed answer, activates the first effect the engine
 * lists (in a window or not), Sets a Spell / Trap when it may; otherwise the server AI's choice.
 */
function player(counts: PlayerCounts): AiPolicy {
  return (input) => {
    const prompt = input.view.pendingPrompt;
    if (prompt) {
      const yes = input.legalActions.find(
        (a) => a.type === 'ResolvePendingPrompt' && a.payload.decline !== true,
      );
      if (yes) {
        counts.promptAnswers++;
        return yes;
      }
    }
    const activation = input.legalActions.find((a) => a.type === 'ActivateEffect');
    if (activation) {
      counts.activations++;
      return activation;
    }
    if (input.view.chainWindow === null && prompt === null) {
      const set = input.legalActions.find((a) => a.type === 'SetSpellTrap');
      if (set) {
        counts.sets++;
        return set;
      }
    }
    return chooseAction(input);
  };
}

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
        deck: BATCH2_DEMO_DECK,
        ...(extraDecks ? { extraDecks } : {}),
      }),
    );
  }
  return results;
}

describe('simulations with BATCH2_DEMO_DECK (task 4.7, real batch-2 cards)', () => {
  it('the server AI on both seats, no Extra Deck: every game ends, no Spell/Trap move of its own', async () => {
    const { seen, policy } = tracked();
    const s = summarize(await run('b2', [policy, policy]));
    console.info(
      `[AI vs AI batch-2 deck] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      seen,
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(seen.promptsAnswered, 'trigger prompts the AI answered').toBeGreaterThan(0);
    expect(seen.spellTrapOnItsOwn, 'Spell/Trap moves outside a window').toBe(0);
  }, 600_000);

  it('a seat that really plays the cards (Extra Deck) against the server AI: cards are used, nobody gets stuck', async () => {
    const { seen, policy } = tracked();
    const counts: PlayerCounts = { promptAnswers: 0, activations: 0, sets: 0 };
    const s = summarize(await run('b2h', [player(counts), policy], [BATCH2_FUSION_EXTRA_DECK, []]));
    console.info(
      `[player vs AI, batch-2 deck] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      { ...counts, aiDecisions: seen.decisions, aiSpellTrapOnItsOwn: seen.spellTrapOnItsOwn },
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(counts.activations, 'effects the player activated').toBeGreaterThan(0);
    expect(counts.promptAnswers, 'prompts the player accepted').toBeGreaterThan(0);
    expect(counts.sets, 'Spells / Traps the player Set').toBeGreaterThan(0);
    expect(seen.spellTrapOnItsOwn, 'Spell/Trap moves of the AI outside a window').toBe(0);
  }, 600_000);

  it('that player on both seats, both with the Extra Deck: every game still ends', async () => {
    const counts: PlayerCounts = { promptAnswers: 0, activations: 0, sets: 0 };
    const both = player(counts);
    const s = summarize(
      await run('b2pp', [both, both], [BATCH2_FUSION_EXTRA_DECK, BATCH2_FUSION_EXTRA_DECK]),
    );
    console.info(
      `[player vs player, batch-2 deck] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      counts,
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(counts.activations).toBeGreaterThan(0);
  }, 600_000);
});
