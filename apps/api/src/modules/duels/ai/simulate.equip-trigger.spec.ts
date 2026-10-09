import type { CardDefinition } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { lookupCard } from '../card-pool';
import { chooseAction, type AiPolicy } from './choose-action';
import { simulate, summarize, type SimResult } from './simulate';

/**
 * Task 4.8: the situation that made a prompt nobody could answer (found by the "player on both seats" simulation of task
 * 4.7): a monster whose "when destroyed" trigger destroys 1 Spell/Trap the opponent controls — the first design of
 * SMP-056 — is destroyed while the opponent's Equip Spell (the real SMP-122) is on it. That monster is a test-only card
 * (no real card does this yet); everything else is the real pool.
 * 1) a stand-in for the person on both seats: every game ends, no prompt without an answer;
 * 2) that stand-in against the server AI: the AI answers the trigger prompts it is asked and never gets stuck.
 * Long run: `AI_SIM_GAMES=100 pnpm --filter @yugi/api exec vitest run simulate.equip-trigger`.
 */
const GAMES = Number(process.env['AI_SIM_GAMES'] ?? 3);
const OFFSET = Number(process.env['AI_SIM_OFFSET'] ?? 0);

const TRIGGER_MONSTER = 'T48-DES-KILL-ST';
const TEST_CARDS: Record<string, CardDefinition> = {
  [TRIGGER_MONSTER]: {
    id: TRIGGER_MONSTER,
    kind: 'Monster',
    name: { vi: 'Thử nghiệm 4.8', en: 'Task 4.8 test monster' },
    category: 'Effect',
    attribute: 'DARK',
    race: 'Fiend',
    level: 4,
    atk: 1500,
    def: 1000,
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'OnDestroyed' },
        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
};
const cards = (id: string): CardDefinition | undefined => TEST_CARDS[id] ?? lookupCard(id);

/** 16 trigger monsters, 12 × SMP-122 (Equip on an opponent's monster, −600 ATK), 12 plain attackers (ATK 1600–1900). */
const DECK: readonly string[] = [
  ...Array.from({ length: 16 }, () => TRIGGER_MONSTER),
  ...Array.from({ length: 12 }, () => 'SMP-122'),
  ...Array.from({ length: 12 }, (_, i) => ['SMP-008', 'SMP-009', 'SMP-017', 'SMP-033'][i % 4]!),
];

interface Counts {
  promptAnswers: number;
  activations: number;
}

/** Test-only stand-in for the person: says yes to every prompt, activates whatever the engine lists. */
function player(counts: Counts): AiPolicy {
  return (input) => {
    if (input.view.pendingPrompt) {
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
    return chooseAction(input);
  };
}

/** Let the vitest worker answer its RPC between games (a long synchronous test starves it under load; ADR 062). */
const yieldToWorker = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function run(prefix: string, policies: readonly [AiPolicy, AiPolicy]): Promise<SimResult[]> {
  const results: SimResult[] = [];
  for (let i = OFFSET; i < OFFSET + GAMES; i++) {
    await yieldToWorker();
    results.push(
      simulate({ seed: `${prefix}-${i}`, policies, deck: DECK, cardDefinitions: cards }),
    );
  }
  return results;
}

describe('simulations: an Equip Spell on a monster whose "when destroyed" trigger targets a Spell/Trap (task 4.8)', () => {
  it('the test monster is the card that used to dead-end (schema-valid, trigger aimed at a Spell/Trap)', () => {
    expect(lookupCard(TRIGGER_MONSTER)).toBeUndefined();
    expect(cards('SMP-122')?.kind).toBe('Spell');
  });

  it('a player on both seats: every game ends, no prompt without an answer', async () => {
    const counts: Counts = { promptAnswers: 0, activations: 0 };
    const both = player(counts);
    const s = summarize(await run('eqt-pp', [both, both]));
    console.info(
      `[player vs player, Equip + trigger deck] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      counts,
    );
    expect(s.deadPrompts, 'prompts nobody could answer').toBe(0);
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(counts.activations, 'Equip Spells the players activated').toBeGreaterThan(0);
  }, 600_000);

  it('a player against the server AI: the AI answers what it is asked and never gets stuck', async () => {
    const counts: Counts = { promptAnswers: 0, activations: 0 };
    let aiPromptAnswers = 0;
    const ai: AiPolicy = (input) => {
      const answer = chooseAction(input);
      const key = JSON.stringify(answer);
      if (!input.legalActions.some((a) => JSON.stringify(a) === key))
        throw new Error(`AI answered outside legalActions: ${key}`);
      if (answer.type === 'Surrender') throw new Error('AI surrendered');
      if (answer.type === 'ResolvePendingPrompt') aiPromptAnswers++;
      return answer;
    };
    const s = summarize(await run('eqt-ph', [player(counts), ai]));
    console.info(
      `[player vs AI, Equip + trigger deck] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      { ...counts, aiPromptAnswers },
    );
    expect(s.deadPrompts, 'prompts nobody could answer').toBe(0);
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
  }, 600_000);
});
