import { EFFECT_DEMO_DECK } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { chooseAction, type AiPolicy } from './choose-action';
import { simulate, summarize, type SimResult } from './simulate';

/**
 * Task 3.8: AI vs AI with the REAL sample cards (`EFFECT_DEMO_DECK`, server card pool — no test-only cards).
 * 1) The real AI as it runs on the server (never Sets a Spell/Trap by itself): Spells/Traps are dead cards in its
 *    hand, triggers and Continuous monsters still play; every game must end, nothing refused, no surrender.
 * 2) With a test-only "Set Spells/Traps first" wrapper so there are Set cards: the AI holds reaction/chain windows,
 *    activates harmful Traps / Quick-Plays and answers trigger prompts — all from legalActions.
 * Long run: `AI_SIM_GAMES=200 pnpm --filter @yugi/api exec vitest run simulate.effect-deck`.
 */
const GAMES = Number(process.env['AI_SIM_GAMES'] ?? 2);
const OFFSET = Number(process.env['AI_SIM_OFFSET'] ?? 0);

function tracked() {
  const seen = { windows: 0, activations: 0, passes: 0, triggerAnswers: 0, effectiveStats: 0 };
  const policy: AiPolicy = (input) => {
    const answer = chooseAction(input);
    const key = JSON.stringify(answer);
    if (!input.legalActions.some((a) => JSON.stringify(a) === key)) {
      throw new Error(`AI answered outside legalActions: ${key}`);
    }
    if (answer.type === 'Surrender') throw new Error('AI surrendered');
    if (input.view.chainWindow?.priorityPlayer === input.view.viewerIndex) {
      seen.windows++;
      if (answer.type === 'ActivateEffect') seen.activations++;
      if (answer.type === 'PassPriority') seen.passes++;
    }
    if (input.view.pendingPrompt?.kind === 'TriggerActivation') seen.triggerAnswers++;
    // A Continuous monster (SMP-022/023) changed some face-up monster's ATK.
    const modified = input.view.players
      .flatMap((p) => p.board.monsterZones)
      .some((c) => {
        if (!c || c.hidden || !c.effectiveStats) return false;
        const def = input.cardDefinitions(c.definitionId);
        return def?.kind === 'Monster' && c.effectiveStats.atk !== def.atk;
      });
    if (modified) seen.effectiveStats++;
    return answer;
  };
  return { seen, policy };
}

/** Test-only: Set any Spell/Trap the engine allows first (the server AI does not; ADR 3.2b/3.4b). */
const setsFirst =
  (inner: AiPolicy): AiPolicy =>
  (input) => {
    const set = input.legalActions.find((a) => a.type === 'SetSpellTrap');
    if (set && input.view.chainWindow === null && input.view.pendingPrompt === null) return set;
    return inner(input);
  };

/** Task 4.2d: let the vitest worker answer its RPC between games (a long synchronous test starves it under load). */
const yieldToWorker = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function run(prefix: string, policy: AiPolicy): Promise<SimResult[]> {
  const results: SimResult[] = [];
  for (let i = OFFSET; i < OFFSET + GAMES; i++) {
    await yieldToWorker();
    results.push(
      simulate({ seed: `${prefix}-${i}`, policies: [policy, policy], deck: EFFECT_DEMO_DECK }),
    );
  }
  return results;
}

describe('AI vs AI with EFFECT_DEMO_DECK (task 3.8, real sample cards)', () => {
  it('the server AI as-is: every game finishes, nothing refused, never surrenders', async () => {
    const { seen, policy } = tracked();
    const s = summarize(await run('ed', policy));
    console.info(
      `[AI vs AI effect deck] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      seen,
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.deadPrompts, 'prompts nobody could answer').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
  }, 600_000);

  it('with Set cards: the AI holds windows, activates real Traps/Quick-Plays, answers triggers', async () => {
    const { seen, policy } = tracked();
    const s = summarize(await run('eds', setsFirst(policy)));
    console.info(
      `[AI vs AI effect deck, sets first] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      seen,
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.deadPrompts, 'prompts nobody could answer').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(seen.windows, 'windows the AI held').toBeGreaterThan(0);
    expect(seen.activations, 'AI answers with a real card').toBeGreaterThan(0);
    // No pass expected: every Set card in this deck harms the opponent, and a window only opens when the holder
    // has a legal activation — so the AI always answers (passes are covered by simulate.chain.spec.ts).
    expect(seen.triggerAnswers, 'trigger prompts (SMP-020) the AI answered').toBeGreaterThan(0);
    expect(seen.effectiveStats, 'Continuous ATK seen on the wire').toBeGreaterThan(0);
  }, 600_000);
});
