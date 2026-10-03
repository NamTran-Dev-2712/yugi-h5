import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Action } from '@yugi/game-engine';
import { ScenarioSchema, type PlayerAction, type Scenario, type StateView } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { scenarioToState } from '../dev-sandbox/scenario-to-state';
import { lookupCard } from './card-pool';
import { DuelManager } from './duel-manager';
import { InMemoryDuelStore } from './duel-store';

/**
 * Task 3.8 — the Sandbox scenarios built on the REAL sample cards open chain / reaction windows, trigger prompts and
 * Continuous stats through the normal DuelManager path (no test-only cards), as they do over HTTP.
 */

const dir = join(__dirname, '../../../../../packages/shared/scenarios');
const sample = (name: string): Scenario =>
  ScenarioSchema.parse(JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')));

async function load(name: string) {
  const s = sample(name);
  const manager = new DuelManager({
    store: new InMemoryDuelStore(),
    cardDefinitions: lookupCard,
    newDuelId: () => 'duel-1',
  });
  const r = await manager.createDuelFromState({
    state: scenarioToState(s, { matchId: 'duel-1', playerIds: ['owner', 'owner:ai'] }, lookupCard),
    seed: s.seed,
    mode: 'solo-vs-ai',
    ownerId: 'owner',
    aiSeat: 1,
    ...(s.script ? { script: s.script } : {}),
  });
  return { manager, r };
}

/** Legal actions are wire-shaped (`PlayerAction`); the manager takes the engine `Action` (same shape). */
const act = (a: PlayerAction): Action => a as unknown as Action;
const setCard = (view: StateView, zone: number) => view.players[0].board.spellTrapZones[zone]!;
const lp = (view: StateView) => view.players.map((p) => p.lifePoints);

describe('Sandbox scenarios on real cards (task 3.8)', () => {
  it('chain-reaction-real: the AI attacks, I hold a reaction window with two real Set cards', async () => {
    const { manager, r } = await load('chain-reaction-real');
    const view = r.views[0];
    expect(view.chainWindow).toMatchObject({
      priorityPlayer: 0,
      reactionTo: { kind: 'Attack', playerIndex: 1 },
    });
    const legal = r.legalActionsByViewer[0];
    expect(legal).toContainEqual({ type: 'PassPriority', payload: { playerIndex: 0 } });
    const sinkhole = setCard(view, 1).instanceId;
    const arrow = setCard(view, 3).instanceId;
    const activations = legal.filter((a) => a.type === 'ActivateEffect');
    expect(activations.map((a) => a.payload.cardInstanceId).sort()).toEqual(
      [sinkhole, arrow].sort(),
    );
    // Sudden Sinkhole on the attacker. The AI has nothing, so the engine passes for it; I still hold Flash Arrow (Speed 2), so the
    // priority comes back to me with the chain open (1 link). I pass: the chain resolves, the attacker is destroyed,
    // the attack stops (no damage) and the AI finishes its turn.
    const action = activations.find((a) => a.payload.cardInstanceId === sinkhole) as PlayerAction;
    const linked = await manager.submitAction('duel-1', 0, act(action));
    expect(linked.aiActions ?? []).toEqual([]); // the engine auto-passes the AI (no activation, ADR 3.3)
    expect(linked.view.chain).toHaveLength(1);
    expect(linked.view.chainWindow).toMatchObject({ priorityPlayer: 0, passCount: 1 });
    expect(linked.legalActions).toContainEqual({
      type: 'PassPriority',
      payload: { playerIndex: 0 },
    });
    const after = await manager.submitAction('duel-1', 0, {
      type: 'PassPriority',
      payload: { playerIndex: 0 },
    });
    expect(after.events.some((e) => e.type === 'MonsterDestroyed')).toBe(true);
    expect(lp(after.view)[0]).toBe(8000);
    expect(
      after.view.players[1].graveyard.some((c) => !c.hidden && c.definitionId === 'SMP-017'),
    ).toBe(true);
    // Control is back with me: either my turn, or the AI Summoned in Main 2 and my Flash Arrow opened a window.
    const v = after.view;
    expect(v.pendingPrompt?.playerIndex ?? v.chainWindow?.priorityPlayer ?? v.turnPlayerIndex).toBe(
      0,
    );
  });

  it('trigger-optional-real: the script Summons SMP-020; the AI answers the SUMMON with its Trap first (task 4.4c), then I am asked', async () => {
    const { manager, r } = await load('trigger-optional-real');
    const view = r.views[0];
    // Task 4.4c: the Summon reaction window comes before my optional trigger, and the AI (Set Counterspark) used it:
    // 800 to me before I am asked. Until 4.4c the AI answered my trigger link instead.
    expect(r.aiActions?.some((s) => s.action.type === 'ActivateEffect')).toBe(true);
    expect(lp(view)[0]).toBe(7200);
    expect(view.players[1].board.spellTrapZones[3]).toBeNull();
    expect(view.pendingPrompt).toMatchObject({ kind: 'TriggerActivation', playerIndex: 0 });
    const answers = r.legalActionsByViewer[0].filter((a) => a.type === 'ResolvePendingPrompt');
    expect(answers.some((a) => a.type === 'ResolvePendingPrompt' && a.payload.decline)).toBe(true);
    const target = view.players[1].board.spellTrapZones[1]!.instanceId;
    const accept = answers.find(
      (a) => a.type === 'ResolvePendingPrompt' && a.payload.cardInstanceIds[0] === target,
    )!;
    const after = await manager.submitAction('duel-1', 0, act(accept));
    // The AI has nothing left to answer my trigger link with: it resolves and destroys the chosen Set card.
    expect(after.aiActions?.some((s) => s.action.type === 'ActivateEffect')).toBe(false);
    expect(lp(after.view)[0]).toBe(7200);
    expect(after.view.players[1].board.spellTrapZones[1]).toBeNull();
    expect(after.view.chainWindow).toBeNull();
  });

  it('continuous-real: effective ATK on the wire differs from the printed ATK', async () => {
    const { r } = await load('continuous-real');
    const mine = r.views[0].players[0].board.monsterZones;
    const theirs = r.views[0].players[1].board.monsterZones;
    const atkOf = (c: (typeof mine)[number]) =>
      c && !c.hidden ? c.effectiveStats?.atk : undefined;
    // Mine: SMP-022 (z0) +300 to my other monsters; SMP-023 (z3) −300 to the AI's monsters.
    expect(atkOf(mine[0])).toBe(1500); // SMP-022 excludes itself
    expect(atkOf(mine[1])).toBe(1800 + 300); // SMP-017
    expect(atkOf(mine[3])).toBe(1300 + 300); // SMP-023
    expect(atkOf(theirs[1])).toBe(1700 - 300); // SMP-009
    expect(atkOf(theirs[3])).toBe(1600 - 300); // SMP-008
    // Face-down: no effective stats at all.
    expect(theirs[4]?.hidden).toBe(true);
  });
});
