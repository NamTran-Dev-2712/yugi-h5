import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Action } from '@yugi/game-engine';
import {
  ScenarioSchema,
  type PlayerAction,
  type Scenario,
  type VisibleCardView,
} from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { scenarioToState } from '../dev-sandbox/scenario-to-state';
import { lookupCard } from './card-pool';
import { DuelManager } from './duel-manager';
import { InMemoryDuelStore } from './duel-store';
import { findLeaks } from './testing/leak-check';

/**
 * Task 4.2d — Flip Summon, Special Summon and Equip on the wire, through the Sandbox scenarios built on the real cards
 * SMP-044 / SMP-111 / SMP-112 (the same DuelManager path as HTTP).
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

const act = (a: PlayerAction): Action => a as unknown as Action;
const noLeaks = async (manager: DuelManager, payload: unknown) => {
  const state = (await manager.getDuel('duel-1')).state;
  expect(findLeaks(state, 0, payload)).toEqual([]);
};

describe('Sandbox scenarios on the task 4.2 mechanics (task 4.2d)', () => {
  it('flip-real: FlipSummon is listed for my face-down SMP-044; the OnFlip trigger asks me', async () => {
    const { manager, r } = await load('flip-real');
    const flip = r.legalActionsByViewer[0].find((a) => a.type === 'FlipSummon');
    expect(flip).toEqual({
      type: 'FlipSummon',
      payload: { playerIndex: 0, cardInstanceId: 'p0-7' },
    });
    const res = await manager.submitAction('duel-1', 0, act(flip!));
    expect(res.events.map((e) => e.type)).toContain('FlipSummoned');
    expect(res.view.players[0].board.monsterZones[1]).toMatchObject({
      hidden: false,
      definitionId: 'SMP-044',
      position: 'Attack',
    });
    expect(res.view.pendingPrompt).toMatchObject({ kind: 'TriggerActivation', playerIndex: 0 });
    await noLeaks(manager, res);
  });

  it('equip-real: the script equipped SMP-112 → equippedTo on the wire, effective ATK +500, CardEquipped sent', async () => {
    const { r } = await load('equip-real');
    const eq = r.views[0].players[0].board.spellTrapZones[0] as VisibleCardView;
    expect(eq).toMatchObject({ definitionId: 'SMP-112', position: 'Attack', equippedTo: 'p0-8' });
    expect(r.views[1].players[0].board.spellTrapZones[0]).toMatchObject({ equippedTo: 'p0-8' });
    expect(r.views[0].players[0].board.monsterZones[0]).toMatchObject({
      instanceId: 'p0-8',
      effectiveStats: { atk: 1700, def: 800 },
    });
    expect(r.eventsByViewer[1].map((e) => e.type)).toContain('CardEquipped');
  });

  it('special-summon-real: two effects (hand / graveyard); each opens a target prompt; the chosen monster lands', async () => {
    const { manager, r } = await load('special-summon-real');
    const acts = r.legalActionsByViewer[0].filter((a) => a.type === 'ActivateEffect');
    expect(acts.map((a) => a.type === 'ActivateEffect' && a.payload.effectId).sort()).toEqual([
      'call-from-grave',
      'call-from-hand',
    ]);
    const fromGrave = acts.find(
      (a) => a.type === 'ActivateEffect' && a.payload.effectId === 'call-from-grave',
    )!;
    const opened = await manager.submitAction('duel-1', 0, act(fromGrave));
    expect(opened.view.pendingPrompt).toMatchObject({ kind: 'SelectEffectTarget', playerIndex: 0 });
    const answers = opened.legalActions.filter((a) => a.type === 'ResolvePendingPrompt');
    const ids = answers.flatMap((a) =>
      a.type === 'ResolvePendingPrompt' ? a.payload.cardInstanceIds : [],
    );
    expect(ids.sort()).toEqual(['p0-10', 'p0-9']); // SMP-003 and SMP-001 in my graveyard
    const pick = answers.find(
      (a) => a.type === 'ResolvePendingPrompt' && a.payload.cardInstanceIds[0] === 'p0-9',
    )!;
    const done = await manager.submitAction('duel-1', 0, act(pick));
    expect(done.events).toContainEqual(
      expect.objectContaining({
        type: 'MonsterSpecialSummoned',
        instanceId: 'p0-9',
        from: 'Graveyard',
      }),
    );
    await noLeaks(manager, done);
  });

  it('special-summon-real (solo-debug, opponent holds a Set Trap): the opponent never sees which hand card was chosen', async () => {
    const base = sample('special-summon-real');
    const s = {
      ...base,
      players: [
        base.players[0],
        {
          ...base.players[1],
          field: {
            ...base.players[1].field,
            spellTraps: [{ card: 'SMP-203', zone: 0, position: 'DefenseDown' as const }],
          },
        },
      ],
    } as Scenario;
    const manager = new DuelManager({
      store: new InMemoryDuelStore(),
      cardDefinitions: lookupCard,
      newDuelId: () => 'duel-1',
    });
    const r = await manager.createDuelFromState({
      state: scenarioToState(s, { matchId: 'duel-1', playerIds: ['owner', 'owner'] }, lookupCard),
      seed: s.seed,
      mode: 'solo-debug',
      ownerId: 'owner',
    });
    const fromHand = r.legalActionsByViewer[0].find(
      (a) => a.type === 'ActivateEffect' && a.payload.effectId === 'call-from-hand',
    )!;
    const opened = await manager.submitAction('duel-1', 0, act(fromHand));
    const answer = opened.legalActions.find(
      (a) => a.type === 'ResolvePendingPrompt' && a.payload.cardInstanceIds[0] === 'p0-1',
    )!;
    const done = await manager.submitAction('duel-1', 0, act(answer));
    // The chain stays open: seat 1 may answer with its Set Trap.
    expect(done.view.chainWindow).toMatchObject({ priorityPlayer: 1 });
    const linkFor = (viewer: 0 | 1) =>
      done.eventsByViewer[viewer].find((e) => e.type === 'ChainLinkAdded');
    expect(linkFor(0)).toMatchObject({ targetInstanceIds: ['p0-1'] });
    expect(linkFor(1)).toMatchObject({ targetInstanceIds: [] });
    expect(done.view.chain[0]!.targetInstanceIds).toEqual(['p0-1']);
    const oppView = await manager.getView('duel-1', 1);
    expect(oppView.chain[0]!.targetInstanceIds).toEqual([]);
    const state = (await manager.getDuel('duel-1')).state;
    expect(findLeaks(state, 1, { events: done.eventsByViewer[1], view: oppView })).toEqual([]);
  });
});
