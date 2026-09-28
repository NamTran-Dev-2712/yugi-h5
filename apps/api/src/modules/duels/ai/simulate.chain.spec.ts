import { SAMPLE_CARDS, type CardDefinition, type EffectDefinition } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { chooseAction, type AiPolicy } from './choose-action';
import { simulate, summarize, type SimResult } from './simulate';

/**
 * Task 3.4b: AI vs AI with a TEST deck full of chain material — Set Traps (harmful and harmless), a Quick-Play,
 * optional/mandatory OnSummon monsters, an OnDestroyed monster and a Continuous monster. The AI must answer every
 * window and trigger prompt it holds, only ever from legalActions, and every game must end (no AI_LOOP_LIMIT-like
 * stall, no AiNoActionError). Long run: `AI_SIM_GAMES=200 pnpm --filter @yugi/api exec vitest run simulate.chain`.
 */
const GAMES = Number(process.env['AI_SIM_GAMES'] ?? 3);
const OFFSET = Number(process.env['AI_SIM_OFFSET'] ?? 0);

const text = (s: string) => ({ vi: s, en: s });
const quick = (id: string, kind: 'Trap' | 'Spell', subType: string, e: Partial<EffectDefinition>) =>
  ({
    id,
    kind,
    name: text(id),
    subType,
    effects: [{ id: 'e1', trigger: { kind: 'Quick' }, ...e }],
  }) as CardDefinition;
const mon = (id: string, atk: number, e: Omit<EffectDefinition, 'id'>) =>
  ({
    id,
    kind: 'Monster',
    name: text(id),
    category: 'Effect',
    attribute: 'DARK',
    race: 'Fiend',
    level: 4,
    atk,
    def: 1000,
    effects: [{ id: 'e1', ...e }],
  }) as CardDefinition;

const CHAIN_CARDS: readonly CardDefinition[] = [
  quick('SC-TRAP-KILL', 'Trap', 'Normal', {
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  quick('SC-TRAP-BURN', 'Trap', 'Normal', {
    operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
  }),
  quick('SC-TRAP-HEAL', 'Trap', 'Normal', {
    operations: [{ kind: 'Heal', amount: 200, target: 'self' }],
  }),
  quick('SC-QP-BURN', 'Spell', 'QuickPlay', {
    operations: [{ kind: 'Damage', amount: 200, target: 'opponent' }],
  }),
  mon('SC-SUM-OPT', 1600, {
    trigger: { kind: 'OnSummon' },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  mon('SC-SUM-MAND', 1500, {
    trigger: { kind: 'OnSummon', mandatory: true },
    operations: [{ kind: 'Heal', amount: 300, target: 'self' }],
  }),
  mon('SC-DES', 1700, {
    trigger: { kind: 'OnDestroyed', mandatory: true },
    operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
  }),
  mon('SC-CONT', 1400, {
    trigger: { kind: 'Continuous' },
    operations: [{ kind: 'ModifyStat', stat: 'atk', amount: -300, side: 'opponent' }],
  }),
];
const DEFS = new Map([...SAMPLE_CARDS, ...CHAIN_CARDS].map((c) => [c.id, c]));
const cardDefinitions = (id: string) => DEFS.get(id);

/** 40 cards: every chain card ×3 (24) + 16 plain monsters from the sample pool. */
const DECK: string[] = [
  ...CHAIN_CARDS.flatMap((c) => [c.id, c.id, c.id]),
  ...SAMPLE_CARDS.filter((c) => c.kind === 'Monster')
    .slice(0, 8)
    .flatMap((c) => [c.id, c.id]),
];

const seen = { windows: 0, activations: 0, passes: 0, triggerAnswers: 0, declines: 0 };
const checked: AiPolicy = (input) => {
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
  if (input.view.pendingPrompt?.kind === 'TriggerActivation') {
    seen.triggerAnswers++;
    if (answer.type === 'ResolvePendingPrompt' && answer.payload.decline) seen.declines++;
  }
  return answer;
};

/**
 * The AI never Sets a Spell/Trap on its own yet (ADR 3.2b/3.4b). Test-only wrapper so there ARE Set cards to answer
 * with: in a Main Phase, Set any Spell/Trap the engine allows first; every other decision (windows, prompts, the rest
 * of the turn) is the real AI's.
 */
const setsFirst =
  (inner: AiPolicy): AiPolicy =>
  (input) => {
    const set = input.legalActions.find((a) => a.type === 'SetSpellTrap');
    if (set && input.view.chainWindow === null && input.view.pendingPrompt === null) return set;
    return inner(input);
  };

describe('AI vs AI with chain material (task 3.4b)', () => {
  it('every game finishes; the AI answers windows and trigger prompts from legalActions', () => {
    const results: SimResult[] = [];
    for (let i = OFFSET; i < OFFSET + GAMES; i++) {
      results.push(
        simulate({
          seed: `ac-${i}`,
          policies: [setsFirst(checked), setsFirst(checked)],
          deck: DECK,
          cardDefinitions,
        }),
      );
    }
    const s = summarize(results);
    console.info(
      `[AI vs AI chain] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)} ` +
        `seat0Wins=${s.seatWins[0]} seat1Wins=${s.seatWins[1]} draws=${s.draws}`,
      seen,
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.rejected, 'actions the engine refused').toBe(0);
    expect(s.surrenders).toBe(0);
    expect(seen.windows, 'windows the AI held').toBeGreaterThan(0);
    expect(seen.passes, 'AI passes').toBeGreaterThan(0);
    expect(seen.activations, 'AI answers with a card').toBeGreaterThan(0);
    expect(seen.triggerAnswers, 'trigger prompts the AI answered').toBeGreaterThan(0);
  }, 600_000);
});
