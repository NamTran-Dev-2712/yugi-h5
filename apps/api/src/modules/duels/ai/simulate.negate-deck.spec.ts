import { NEGATE_DEMO_DECK, isNegateOperationKind } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { chooseAction, type AiInput, type AiPolicy } from './choose-action';
import { simulate, summarize, type SimResult } from './simulate';

/**
 * Task 4.4b: AI vs AI with `NEGATE_DEMO_DECK` (real cards: SMP-201 negates an attack, SMP-209 a Spell/Trap activation,
 * SMP-210 a Summon; plus SMP-114 / 115 / 105 / 101). The AI is NOT taught to use them (P8):
 * 1) the server AI as-is: every game ends, nothing refused, no surrender, and it never Sets / activates a Spell/Trap on
 *    its own outside a window it holds (ADR 048, 055);
 * 2) with a test-only "Set Spells/Traps first" wrapper there ARE Set negating cards: the AI holds the windows the engine
 *    opens for them and passes (it never activates a negation), and every game still ends;
 * 3) a test-only "negator" seat (Sets and USES the negating cards, activates its Spells) against the server AI: the
 *    AI's attacks / Summons really get negated and it never gets stuck.
 * Long run: `AI_SIM_GAMES=100 pnpm --filter @yugi/api exec vitest run simulate.negate-deck`.
 */
const GAMES = Number(process.env['AI_SIM_GAMES'] ?? 3);
const OFFSET = Number(process.env['AI_SIM_OFFSET'] ?? 0);

const ownCard = (input: AiInput, instanceId: string) => {
  const own = input.view.players[input.view.viewerIndex];
  const card = [...own.hand, ...own.board.spellTrapZones, own.board.fieldZone].find(
    (c) => c?.instanceId === instanceId,
  );
  return card && !card.hidden ? input.cardDefinitions(card.definitionId) : undefined;
};
/** Read from the card data (the three operation kinds of task 4.4), not from the id. */
const isNegation = (input: AiInput, instanceId: string): boolean =>
  (ownCard(input, instanceId)?.effects ?? []).some((e) =>
    e.operations.some((o) => isNegateOperationKind(o.kind)),
  );

function tracked() {
  const seen = {
    decisions: 0,
    negateSetListed: 0,
    spellTrapOnItsOwn: 0,
    windows: 0,
    negationListedInWindow: 0,
    negationsActivated: 0,
    passes: 0,
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
        (a) => a.type === 'SetSpellTrap' && isNegation(input, a.payload.cardInstanceId),
      )
    ) {
      seen.negateSetListed++;
    }
    const inWindow = input.view.chainWindow?.priorityPlayer === input.view.viewerIndex;
    if (inWindow) {
      seen.windows++;
      if (
        input.legalActions.some(
          (a) => a.type === 'ActivateEffect' && isNegation(input, a.payload.cardInstanceId),
        )
      ) {
        seen.negationListedInWindow++;
      }
      if (answer.type === 'PassPriority') seen.passes++;
    } else if (answer.type === 'SetSpellTrap' || answer.type === 'ActivateEffect') {
      seen.spellTrapOnItsOwn++;
    }
    if (answer.type === 'ActivateEffect' && isNegation(input, answer.payload.cardInstanceId)) {
      seen.negationsActivated++;
    }
    return answer;
  };
  return { seen, policy };
}

/** Test-only: Set any Spell/Trap the engine allows first (the server AI does not; ADR 048, 055). */
const setsFirst =
  (inner: AiPolicy): AiPolicy =>
  (input) => {
    const set = input.legalActions.find((a) => a.type === 'SetSpellTrap');
    if (set && input.view.chainWindow === null && input.view.pendingPrompt === null) return set;
    return inner(input);
  };

/**
 * Test-only opponent that plays the deck as a person would: Sets its negating cards, activates a negation whenever the
 * engine lists one, activates a Spell from its hand on its own turn; otherwise the server AI's choice.
 */
function negator(counts: { negations: number; spells: number }): AiPolicy {
  return (input) => {
    const free = input.view.chainWindow === null && input.view.pendingPrompt === null;
    const negation = input.legalActions.find(
      (a) => a.type === 'ActivateEffect' && isNegation(input, a.payload.cardInstanceId),
    );
    if (negation) {
      counts.negations++;
      return negation;
    }
    if (free) {
      const set = input.legalActions.find(
        (a) => a.type === 'SetSpellTrap' && isNegation(input, a.payload.cardInstanceId),
      );
      if (set) return set;
      const spell = input.legalActions.find(
        (a) =>
          a.type === 'ActivateEffect' && ownCard(input, a.payload.cardInstanceId)?.kind === 'Spell',
      );
      if (spell) {
        counts.spells++;
        return spell;
      }
    }
    return chooseAction(input);
  };
}

/** Let the vitest worker answer its RPC between games (a long synchronous test starves it under load; ADR 062). */
const yieldToWorker = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function run(prefix: string, policies: readonly [AiPolicy, AiPolicy]): Promise<SimResult[]> {
  const results: SimResult[] = [];
  for (let i = OFFSET; i < OFFSET + GAMES; i++) {
    await yieldToWorker();
    results.push(simulate({ seed: `${prefix}-${i}`, policies, deck: NEGATE_DEMO_DECK }));
  }
  return results;
}

describe('AI vs AI with NEGATE_DEMO_DECK (task 4.4b, real Counter Trap / Negate cards)', () => {
  it('the server AI as-is: Sets of negating cards are listed, it takes none of them on its own, every game ends', async () => {
    const { seen, policy } = tracked();
    const s = summarize(await run('ng', [policy, policy]));
    console.info(
      `[AI vs AI negate deck] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      seen,
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.deadPrompts, 'prompts nobody could answer').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(seen.negateSetListed, 'decisions with a negating card Set listed').toBeGreaterThan(0);
    expect(seen.spellTrapOnItsOwn, 'Spell/Trap moves outside a window').toBe(0);
    expect(seen.negationsActivated, 'negations the AI activated').toBe(0);
  }, 600_000);

  it('with Set negating cards (test wrapper): the AI holds their windows and passes, it never negates, every game ends', async () => {
    const { seen, policy } = tracked();
    const wrapped = setsFirst(policy);
    const s = summarize(await run('ngs', [wrapped, wrapped]));
    console.info(
      `[AI vs AI negate deck, sets first] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      seen,
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.deadPrompts, 'prompts nobody could answer').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(seen.windows, 'windows the AI held').toBeGreaterThan(0);
    expect(seen.negationListedInWindow, 'windows in which a negation was on offer').toBeGreaterThan(
      0,
    );
    expect(seen.negationsActivated, 'negations the AI activated').toBe(0);
  }, 600_000);

  it('against a seat that really negates its attacks / Summons: the server AI never gets stuck, every game ends', async () => {
    const { seen, policy } = tracked();
    const counts = { negations: 0, spells: 0 };
    const s = summarize(await run('ngn', [negator(counts), policy]));
    console.info(
      `[negator vs AI, negate deck] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      { ...counts, aiDecisions: seen.decisions, aiSpellTrapOnItsOwn: seen.spellTrapOnItsOwn },
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.deadPrompts, 'prompts nobody could answer').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(counts.negations, 'negations played against the AI').toBeGreaterThan(0);
    expect(seen.spellTrapOnItsOwn, 'Spell/Trap moves of the AI outside a window').toBe(0);
    expect(seen.negationsActivated, 'negations the AI activated').toBe(0);
  }, 600_000);
});
