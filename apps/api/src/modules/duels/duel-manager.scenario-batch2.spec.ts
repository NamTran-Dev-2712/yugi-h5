import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Action } from '@yugi/game-engine';
import {
  ScenarioSchema,
  type CardView,
  type EventView,
  type PlayerAction,
  type Scenario,
  type StateView,
} from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { scenarioToState } from '../dev-sandbox/scenario-to-state';
import { lookupCard } from './card-pool';
import { DuelManager, type CreateDuelResult, type SubmitActionResult } from './duel-manager';
import { InMemoryDuelStore } from './duel-store';
import { findLeaks } from './testing/leak-check';

/**
 * Task 4.7 — three Sandbox scenarios on the real batch-2 cards, through the same DuelManager path as HTTP, in
 * `solo-vs-ai` (the server AI plays seat 1; it holds no Set card, so nothing answers):
 *  - `equip-opponent-real`: SMP-122, an Equip Spell aimed at the OPPONENT's monster (−600 ATK), then the battle it wins;
 *  - `beast-pack-real`: SMP-057 (Continuous: other Beasts +200 ATK) and the Field Spell SMP-124 (EARTH +200 / +200);
 *  - `revive-on-destroyed-real`: SMP-054 destroyed in battle brings SMP-048 back from the graveyard, which then heals.
 * Engine rules are not re-tested here (see `cards/sample/smp-*.test.ts`), only what each seat receives.
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
const types = (events: readonly EventView[]) => events.map((e) => e.type);
const endPhase: PlayerAction = { type: 'EndPhase', payload: { playerIndex: 0 } };

type Known = CardView & { hidden: false };
const known = (c: CardView | null | undefined): Known | null => (c && !c.hidden ? c : null);
const inHand = (view: StateView, definitionId: string): string => {
  const found = view.players[0].hand.find(
    (c): c is Known => !c.hidden && c.definitionId === definitionId,
  );
  if (!found) throw new Error(`${definitionId} is not in my hand`);
  return found.instanceId;
};
const monster = (view: StateView, seat: 0 | 1, zone: number): Known => {
  const c = known(view.players[seat].board.monsterZones[zone]);
  if (!c) throw new Error(`no face-up monster in zone ${zone} of seat ${seat}`);
  return c;
};
const listed = (
  legal: readonly PlayerAction[],
  test: (a: PlayerAction) => boolean,
  what: string,
): PlayerAction => {
  const found = legal.find(test);
  if (!found) throw new Error(`not in legalActions: ${what}`);
  return found;
};

/** Everything both seats got for this step passes the leak oracle. */
async function noLeaks(
  manager: DuelManager,
  res: Pick<SubmitActionResult, 'eventsByViewer'> | CreateDuelResult,
): Promise<void> {
  const state = (await manager.getDuel('duel-1')).state;
  for (const viewer of [0, 1] as const) {
    const payload = {
      view: await manager.getView('duel-1', viewer),
      events: res.eventsByViewer[viewer],
      legal: await manager.getLegalActions('duel-1', viewer),
      ai: 'aiActions' in res ? res.aiActions : undefined,
    };
    expect(findLeaks(state, viewer, payload), `viewer ${viewer}`).toEqual([]);
  }
}

describe('Sandbox scenarios on card batch 2 (task 4.7)', () => {
  it('equip-opponent-real: SMP-122 sits in MY zone, points at the AI monster, lowers its ATK for both seats — and decides the battle', async () => {
    const { manager, r } = await load('equip-opponent-real');
    const spell = inHand(r.views[0], 'SMP-122');
    const target = monster(r.views[0], 1, 2);
    expect(target.effectiveStats?.atk).toBe(1800);
    await noLeaks(manager, r);

    let res = await manager.submitAction(
      'duel-1',
      0,
      act(
        listed(
          r.legalActionsByViewer[0],
          (a) => a.type === 'ActivateEffect' && a.payload.cardInstanceId === spell,
          'ActivateEffect SMP-122',
        ),
      ),
    );
    // One monster on the other side: the target is chosen at once, no prompt.
    expect(types(res.events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'CardEquipped',
      'EffectResolved',
      'ChainResolved',
    ]);
    for (const viewer of [0, 1] as const) {
      const view = await manager.getView('duel-1', viewer);
      expect(known(view.players[0].board.spellTrapZones[0])).toMatchObject({
        definitionId: 'SMP-122',
        equippedTo: target.instanceId,
      });
      expect(monster(view, 1, 2).effectiveStats).toEqual({ atk: 1200, def: 1200 });
      expect(view.players[1].board.spellTrapZones.every((c) => c === null)).toBe(true);
    }
    await noLeaks(manager, res);

    res = await manager.submitAction('duel-1', 0, act(endPhase));
    expect(res.view.phase).toBe('Battle');
    const mine = monster(res.view, 0, 0);
    res = await manager.submitAction(
      'duel-1',
      0,
      act(
        listed(
          res.legalActions,
          (a) =>
            a.type === 'DeclareAttack' &&
            a.payload.attackerInstanceId === mine.instanceId &&
            a.payload.targetInstanceId === target.instanceId,
          'attack on the equipped monster',
        ),
      ),
    );
    // SMP-006 (1500) beats SMP-031 (1800 − 600): 300 damage, and the Equip follows the monster — to MY graveyard.
    expect(types(res.events)).toEqual(
      expect.arrayContaining(['MonsterDestroyed', 'DamageDealt', 'CardSentToGraveyard']),
    );
    expect(res.view.players[1].lifePoints).toBe(7700);
    expect(res.view.players[0].board.spellTrapZones[0]).toBeNull();
    expect(res.view.players[0].graveyard.map((c) => known(c)?.definitionId)).toEqual(['SMP-122']);
    await noLeaks(manager, res);
  });

  it('beast-pack-real: Summoning SMP-057 boosts my other Beast; SMP-124 then boosts every EARTH monster (not the AI`s WATER one)', async () => {
    const { manager, r } = await load('beast-pack-real');
    expect(monster(r.views[0], 0, 1).effectiveStats).toEqual({ atk: 900, def: 1400 });
    const alpha = inHand(r.views[0], 'SMP-057');
    let res = await manager.submitAction(
      'duel-1',
      0,
      act(
        listed(
          r.legalActionsByViewer[0],
          (a) =>
            a.type === 'NormalSummon' &&
            a.payload.cardInstanceId === alpha &&
            a.payload.zoneIndex === 0,
          'NormalSummon SMP-057 to zone 0',
        ),
      ),
    );
    expect(types(res.events)).toEqual(['NormalSummoned']);
    expect(monster(res.view, 0, 1).effectiveStats).toEqual({ atk: 1100, def: 1400 });
    expect(monster(res.view, 0, 0).effectiveStats).toEqual({ atk: 1500, def: 1200 });
    await noLeaks(manager, res);

    const field = inHand(res.view, 'SMP-124');
    res = await manager.submitAction(
      'duel-1',
      0,
      act(
        listed(
          res.legalActions,
          (a) => a.type === 'ActivateEffect' && a.payload.cardInstanceId === field,
          'ActivateEffect SMP-124',
        ),
      ),
    );
    expect(types(res.events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    for (const viewer of [0, 1] as const) {
      const view = await manager.getView('duel-1', viewer);
      expect(known(view.players[0].board.fieldZone)).toMatchObject({
        definitionId: 'SMP-124',
        position: 'Attack',
      });
      expect(monster(view, 0, 0).effectiveStats).toEqual({ atk: 1700, def: 1400 });
      expect(monster(view, 0, 1).effectiveStats).toEqual({ atk: 1300, def: 1600 });
      expect(monster(view, 1, 0).effectiveStats).toEqual({ atk: 1500, def: 1100 });
    }
    await noLeaks(manager, res);
  });

  it('revive-on-destroyed-real: SMP-054 falls in battle, I am asked, SMP-048 returns in Defense and then heals me', async () => {
    const { manager, r } = await load('revive-on-destroyed-real');
    expect(r.views[0].phase).toBe('Battle');
    const thane = monster(r.views[0], 0, 0);
    let res = await manager.submitAction(
      'duel-1',
      0,
      act(
        listed(
          r.legalActionsByViewer[0],
          (a) =>
            a.type === 'DeclareAttack' &&
            a.payload.attackerInstanceId === thane.instanceId &&
            a.payload.targetInstanceId != null,
          'attack with SMP-054',
        ),
      ),
    );
    expect(types(res.events)).toEqual(['AttackDeclared', 'MonsterDestroyed', 'DamageDealt']);
    expect(res.view.players[0].lifePoints).toBe(7300);
    const prompt = res.view.pendingPrompt;
    expect(prompt).toMatchObject({ kind: 'TriggerActivation', playerIndex: 0 });
    const medic = res.view.players[0].graveyard.find((c) => known(c)?.definitionId === 'SMP-048');
    // Only the Level 3 monster is offered: not the Level 6 one, not SMP-054 itself (Level 5).
    expect((prompt!.payload as { candidateInstanceIds: string[] }).candidateInstanceIds).toEqual([
      medic!.instanceId,
    ]);
    await noLeaks(manager, res);

    res = await manager.submitAction(
      'duel-1',
      0,
      act(
        listed(
          res.legalActions,
          (a) => a.type === 'ResolvePendingPrompt' && a.payload.decline !== true,
          'accept the trigger',
        ),
      ),
    );
    expect(types(res.events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterSpecialSummoned',
      'EffectResolved',
      'ChainResolved',
      // SMP-048 was Summoned: its own mandatory effect, on a new chain.
      'EffectActivated',
      'ChainLinkAdded',
      'LifePointsRecovered',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(monster(res.view, 0, 0)).toMatchObject({
      definitionId: 'SMP-048',
      position: 'DefenseUp',
    });
    expect(res.view.players[0].lifePoints).toBe(7800);
    expect(res.view.players[0].graveyard.map((c) => known(c)?.definitionId).sort()).toEqual([
      'SMP-002',
      'SMP-054',
    ]);
    await noLeaks(manager, res);
  });
});
