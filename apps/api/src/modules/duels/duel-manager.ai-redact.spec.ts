import type { CardDefinition, Scenario } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { scenarioToState } from '../dev-sandbox/scenario-to-state';
import { lookupCard } from './card-pool';
import { DuelManager } from './duel-manager';
import { InMemoryDuelStore } from './duel-store';
import { findLeaks } from './testing/leak-check';

/**
 * Task 4.2d — the AI answers a prompt whose targets are cards of ITS hand (Special Summon from the hand), and the chain
 * then waits for the human (who holds a Set Trap): the AI's answer in `aiActions` must not tell the human which hand card
 * was chosen, nor must `ChainLinkAdded` / `chain` (the card is still in the AI's hand when the response is built).
 */

const text = (s: string) => ({ vi: s, en: s });
/** Test-only: Level 4, OnSummon mandatory — Special Summon 1 monster from your hand. */
const CALLER: CardDefinition = {
  id: 'T-CALLER',
  kind: 'Monster',
  name: text('T-CALLER'),
  category: 'Effect',
  attribute: 'DARK',
  race: 'Fiend',
  level: 4,
  atk: 1800,
  def: 1000,
  effects: [
    {
      id: 'e1',
      trigger: { kind: 'OnSummon', mandatory: true },
      target: { kind: 'Card', zone: 'Hand', side: 'self', count: 1, filter: { kind: 'Monster' } },
      operations: [{ kind: 'SpecialSummon' }],
    },
  ],
};
const lookup = (id: string) => (id === CALLER.id ? CALLER : lookupCard(id));

const scenario: Scenario = {
  name: 'ai-hand-target',
  seed: 'ai-hand-target',
  players: [
    {
      lp: 8000,
      hand: ['SMP-006'],
      deck: ['SMP-005', 'SMP-006', 'SMP-007', 'SMP-008', 'SMP-009', 'SMP-010'],
      field: {
        monsters: [],
        // Counterspark (Trap, 800 damage): the human can answer any chain link, so the window waits for them.
        spellTraps: [{ card: 'SMP-203', zone: 0, position: 'DefenseDown' }],
      },
      gy: [],
    },
    {
      lp: 8000,
      // Only T-CALLER can be Normal Summoned (the two others need tributes); both are candidates of its trigger.
      hand: ['T-CALLER', 'SMP-018', 'SMP-015'],
      deck: ['SMP-004', 'SMP-005', 'SMP-009', 'SMP-010', 'SMP-012', 'SMP-011'],
      field: { monsters: [], spellTraps: [] },
      gy: [],
    },
  ],
  turn: { count: 4, player: 1 },
  phase: 'Main1',
};

describe('AI hand targets never reach the human (task 4.2d)', () => {
  it('aiActions, ChainLinkAdded and chain drop the AI hand card the trigger chose', async () => {
    const manager = new DuelManager({
      store: new InMemoryDuelStore(),
      cardDefinitions: lookup,
      newDuelId: () => 'duel-1',
    });
    const r = await manager.createDuelFromState({
      state: scenarioToState(
        scenario,
        { matchId: 'duel-1', playerIds: ['owner', 'owner:ai'] },
        lookup,
      ),
      seed: scenario.seed,
      mode: 'solo-vs-ai',
      ownerId: 'owner',
      aiSeat: 1,
    });
    // Task 4.4c: the human (Set Trap) first gets the Summon reaction window — the AI's trigger is not on the chain yet.
    expect(r.views[0].chainWindow).toMatchObject({
      priorityPlayer: 0,
      reactionTo: { kind: 'Summon' },
    });
    expect(r.views[0].chain).toEqual([]);
    expect((r.aiActions ?? []).some((a) => a.action.type === 'ResolvePendingPrompt')).toBe(false);
    const passed = await manager.submitAction('duel-1', 0, {
      type: 'PassPriority',
      payload: { playerIndex: 0 },
    });

    const state = (await manager.getDuel('duel-1')).state;
    // The situation really happened: the AI answered the trigger prompt, the chain waits for the human.
    const answers = (passed.aiActions ?? []).filter(
      (a) => a.action.type === 'ResolvePendingPrompt',
    );
    expect(answers).toHaveLength(1);
    expect(state.chainWindow?.priorityPlayer).toBe(0);
    expect(state.chainStack[0]?.targetInstanceIds).toHaveLength(1);
    const chosen = state.chainStack[0]!.targetInstanceIds[0]!;
    expect(state.players[1].hand.some((c) => c.instanceId === chosen)).toBe(true);

    const human = { view: passed.view, events: passed.events, aiActions: passed.aiActions };
    for (const a of answers) {
      if (a.action.type === 'ResolvePendingPrompt')
        expect(a.action.payload.cardInstanceIds).toEqual([]);
    }
    expect(passed.view.chain[0]?.targetInstanceIds).toEqual([]);
    expect(findLeaks(state, 0, human)).toEqual([]);
    // What the human got when the duel was created (the Summon, the window) leaks nothing either.
    expect(
      findLeaks(state, 0, {
        view: r.views[0],
        events: r.eventsByViewer[0],
        aiActions: r.aiActions,
      }),
    ).toEqual([]);
  });

  it('task 4.3b: an AI prompt answer carries the kind of the prompt it answered; other AI actions carry none', async () => {
    const manager = new DuelManager({
      store: new InMemoryDuelStore(),
      cardDefinitions: lookup,
      newDuelId: () => 'duel-1',
    });
    const r = await manager.createDuelFromState({
      state: scenarioToState(
        scenario,
        { matchId: 'duel-1', playerIds: ['owner', 'owner:ai'] },
        lookup,
      ),
      seed: scenario.seed,
      mode: 'solo-vs-ai',
      ownerId: 'owner',
      aiSeat: 1,
    });
    // Task 4.4c: the AI's Summon first waits on the human's Summon window; its trigger prompt comes after the pass.
    const passed = await manager.submitAction('duel-1', 0, {
      type: 'PassPriority',
      payload: { playerIndex: 0 },
    });
    const steps = [...(r.aiActions ?? []), ...(passed.aiActions ?? [])];
    expect(steps.length).toBeGreaterThan(1);
    expect(steps.some((s) => s.action.type === 'ResolvePendingPrompt')).toBe(true);
    for (const step of steps) {
      if (step.action.type === 'ResolvePendingPrompt') {
        expect(step.promptKind).toBe('TriggerActivation');
      } else {
        expect(step).not.toHaveProperty('promptKind');
      }
    }
  });
});
