import { FIELD_DEMO_DECK } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { chooseAction, type AiPolicy } from './choose-action';
import { simulate, summarize, type SimResult } from './simulate';

/**
 * Task 4.3b: AI vs AI with `FIELD_DEMO_DECK` (real cards: Field Spell SMP-113, Continuous Spell SMP-114, Normal Spell
 * SMP-115, Continuous Trap SMP-208, SMP-105). Now that the Field Zone is on the wire its `legalActions` carry
 * `SetSpellTrap` into the Field Zone and activations of Field / Continuous cards:
 * 1) the server AI as-is never gets stuck on them and still never Sets / activates a Spell/Trap on its own outside a
 *    window it holds (ADR 048, 055): every game ends, nothing refused, no surrender;
 * 2) with a test-only "Set Spells/Traps first" wrapper there ARE Set cards (a Field Spell in the Field Zone too): the AI
 *    holds windows with them and every game still ends.
 * Long run: `AI_SIM_GAMES=100 pnpm --filter @yugi/api exec vitest run simulate.field-deck`.
 */
const GAMES = Number(process.env['AI_SIM_GAMES'] ?? 3);
const OFFSET = Number(process.env['AI_SIM_OFFSET'] ?? 0);

function tracked() {
  const seen = {
    decisions: 0,
    fieldSetListed: 0,
    stayingActivationListed: 0,
    spellTrapOnItsOwn: 0,
    windows: 0,
    activationsInWindow: 0,
    passes: 0,
    ownFieldZoneUsed: 0,
  };
  const policy: AiPolicy = (input) => {
    const answer = chooseAction(input);
    const key = JSON.stringify(answer);
    if (!input.legalActions.some((a) => JSON.stringify(a) === key)) {
      throw new Error(`AI answered outside legalActions: ${key}`);
    }
    if (answer.type === 'Surrender') throw new Error('AI surrendered');
    seen.decisions++;
    const own = input.view.players[input.view.viewerIndex];
    const defOf = (instanceId: string) => {
      const card = [...own.hand, ...own.board.spellTrapZones, own.board.fieldZone].find(
        (c) => c?.instanceId === instanceId,
      );
      return card && !card.hidden ? input.cardDefinitions(card.definitionId) : undefined;
    };
    const isField = (instanceId: string): boolean => {
      const def = defOf(instanceId);
      return def?.kind === 'Spell' && def.subType === 'Field';
    };
    if (
      input.legalActions.some((a) => a.type === 'SetSpellTrap' && isField(a.payload.cardInstanceId))
    ) {
      seen.fieldSetListed++;
    }
    if (
      input.legalActions.some(
        (a) => a.type === 'ActivateEffect' && defOf(a.payload.cardInstanceId)?.kind !== 'Monster',
      )
    ) {
      seen.stayingActivationListed++;
    }
    if (own.board.fieldZone) seen.ownFieldZoneUsed++;
    const inWindow = input.view.chainWindow?.priorityPlayer === input.view.viewerIndex;
    if (inWindow) {
      seen.windows++;
      if (answer.type === 'ActivateEffect') seen.activationsInWindow++;
      if (answer.type === 'PassPriority') seen.passes++;
    } else if (answer.type === 'SetSpellTrap' || answer.type === 'ActivateEffect') {
      seen.spellTrapOnItsOwn++;
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

/** Let the vitest worker answer its RPC between games (a long synchronous test starves it under load; ADR 062). */
const yieldToWorker = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function run(prefix: string, policy: AiPolicy): Promise<SimResult[]> {
  const results: SimResult[] = [];
  for (let i = OFFSET; i < OFFSET + GAMES; i++) {
    await yieldToWorker();
    results.push(
      simulate({ seed: `${prefix}-${i}`, policies: [policy, policy], deck: FIELD_DEMO_DECK }),
    );
  }
  return results;
}

describe('AI vs AI with FIELD_DEMO_DECK (task 4.3b, real Field / Continuous cards)', () => {
  it('the server AI as-is: Field Set / activations are listed, it takes none of them on its own, every game ends', async () => {
    const { seen, policy } = tracked();
    const s = summarize(await run('fd', policy));
    console.info(
      `[AI vs AI field deck] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      seen,
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.deadPrompts, 'prompts nobody could answer').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    // The situation the brief asks about really happened: the Field Zone Set and the activations were on offer.
    expect(seen.fieldSetListed, 'decisions with a Field Spell Set listed').toBeGreaterThan(0);
    expect(
      seen.stayingActivationListed,
      'decisions with a Spell activation listed',
    ).toBeGreaterThan(0);
    expect(seen.spellTrapOnItsOwn, 'Spell/Trap moves outside a window').toBe(0);
    expect(seen.ownFieldZoneUsed, 'the AI never fills its own Field Zone').toBe(0);
  }, 600_000);

  it('with Set cards (test wrapper): a Field Spell sits in the Field Zone, the AI holds windows, every game ends', async () => {
    const { seen, policy } = tracked();
    const s = summarize(await run('fds', setsFirst(policy)));
    console.info(
      `[AI vs AI field deck, sets first] games=${s.games} finished=${s.finished} meanTurns=${s.meanTurns.toFixed(1)}`,
      seen,
    );
    expect(s.stuck, 'games that never ended').toBe(0);
    expect(s.deadPrompts, 'prompts nobody could answer').toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.surrenders).toBe(0);
    expect(seen.ownFieldZoneUsed, 'decisions with a card in its Field Zone').toBeGreaterThan(0);
    expect(seen.windows, 'windows the AI held').toBeGreaterThan(0);
  }, 600_000);
});
