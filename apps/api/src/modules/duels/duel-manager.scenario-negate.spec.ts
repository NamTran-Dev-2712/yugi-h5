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
import { DuelServiceError } from './duel-errors';
import { InMemoryDuelStore } from './duel-store';
import { findLeaks } from './testing/leak-check';

/**
 * Task 4.4b — Counter Trap / Negate on the wire, through the three Sandbox scenarios built on the real cards SMP-201
 * (negate an attack), SMP-210 (negate a Summon) and SMP-209 (negate a Spell/Trap activation): the same DuelManager path
 * as HTTP, in `solo-vs-ai` (the server AI plays seat 1). Engine rules are not re-tested here, only what each seat
 * receives: the three Negate events reach BOTH seats, unchanged, and nothing leaks.
 */

const dir = join(__dirname, '../../../../../packages/shared/scenarios');
const sample = (name: string): Scenario =>
  ScenarioSchema.parse(JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')));

async function start(s: Scenario) {
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
const load = (name: string) => start(sample(name));

const act = (a: PlayerAction): Action => a as unknown as Action;
const types = (events: readonly EventView[]) => events.map((e) => e.type);
/** The instance id of my Set card that is `definitionId` (the owner sees its own face-down cards). */
const mySet = (view: StateView, definitionId: string): string => {
  const found = view.players[0].board.spellTrapZones.find(
    (c): c is CardView & { hidden: false } =>
      c !== null && !c.hidden && c.definitionId === definitionId,
  );
  if (!found) throw new Error(`${definitionId} is not Set on my side`);
  return found.instanceId;
};
const activationOf = (
  legal: readonly PlayerAction[],
  cardInstanceId: string,
): PlayerAction | undefined =>
  legal.find((a) => a.type === 'ActivateEffect' && a.payload.cardInstanceId === cardInstanceId);
const activation = (legal: readonly PlayerAction[], cardInstanceId: string): PlayerAction => {
  const found = activationOf(legal, cardInstanceId);
  if (!found) throw new Error(`no ActivateEffect listed for ${cardInstanceId}`);
  return found;
};
const pass: PlayerAction = { type: 'PassPriority', payload: { playerIndex: 0 } };
const atk = (view: StateView, seat: 0 | 1, zone: number): number | undefined => {
  const c = view.players[seat].board.monsterZones[zone];
  return c && !c.hidden ? c.effectiveStats?.atk : undefined;
};
const gyIds = (view: StateView, seat: 0 | 1): string[] =>
  view.players[seat].graveyard.map((c) => c.instanceId);

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

describe('Sandbox scenarios on Counter Trap / Negate (task 4.4b)', () => {
  describe('negate-attack-real (SMP-201)', () => {
    it('loads with the AI attack declared and the reaction window held by me; SMP-201 is listed', async () => {
      const { manager, r } = await load('negate-attack-real');
      expect(types(r.eventsByViewer[0])).toContain('AttackDeclared');
      expect(r.aiActions?.map((a) => a.action.type)).toContain('DeclareAttack');
      const view = r.views[0];
      expect(view.chainWindow).toMatchObject({ priorityPlayer: 0, reactionTo: { kind: 'Attack' } });
      const legal = r.legalActionsByViewer[0];
      expect(activationOf(legal, mySet(view, 'SMP-201'))).toBeDefined();
      expect(legal).toContainEqual(pass);
      await noLeaks(manager, r);
    });

    it('activating it: AttackNegated reaches both seats unchanged; no damage, nothing destroyed, the Trap is spent', async () => {
      const { manager, r } = await load('negate-attack-real');
      const declared = r.eventsByViewer[0].find((e) => e.type === 'AttackDeclared');
      if (declared?.type !== 'AttackDeclared') throw new Error('no attack');
      const trap = mySet(r.views[0], 'SMP-201');
      const res = await manager.submitAction(
        'duel-1',
        0,
        act(activation(r.legalActionsByViewer[0], trap)),
      );
      const negated = {
        type: 'AttackNegated',
        playerIndex: 1,
        attackerInstanceId: declared.attackerInstanceId,
        targetInstanceId: declared.targetInstanceId,
      };
      for (const viewer of [0, 1] as const) {
        expect(res.eventsByViewer[viewer], `viewer ${viewer}`).toContainEqual(negated);
      }
      expect(types(res.events)).not.toContain('DamageDealt');
      expect(types(res.events)).not.toContain('MonsterDestroyed');
      expect(res.view.players[0].lifePoints).toBe(8000);
      expect(res.view.players[0].board.monsterZones[2]).toMatchObject({ definitionId: 'SMP-005' });
      expect(gyIds(res.view, 0)).toEqual([trap]);
      await noLeaks(manager, res);
    });

    it('passing instead: the attack goes through (the scenario is a real threat)', async () => {
      const { manager, r } = await load('negate-attack-real');
      const res = await manager.submitAction('duel-1', 0, act(pass));
      expect(types(res.events)).not.toContain('AttackNegated');
      expect(types(res.events)).toContain('DamageDealt');
      expect(res.view.players[0].lifePoints).toBeLessThan(8000);
      expect(r.views[0].players[0].lifePoints).toBe(8000);
    });
  });

  describe('counter-summon-real (SMP-210)', () => {
    it('loads with the AI Normal Summon done and the Summon window held by me; SMP-210 is listed', async () => {
      const { manager, r } = await load('counter-summon-real');
      expect(types(r.eventsByViewer[0])).toContain('NormalSummoned');
      const view = r.views[0];
      expect(view.chainWindow).toMatchObject({ priorityPlayer: 0, reactionTo: { kind: 'Summon' } });
      expect(activationOf(r.legalActionsByViewer[0], mySet(view, 'SMP-210'))).toBeDefined();
      await noLeaks(manager, r);
    });

    it('activating it: SummonNegated reaches both seats; the monster is in the AI graveyard and is not Summoned again', async () => {
      const { manager, r } = await load('counter-summon-real');
      const summoned = r.eventsByViewer[0].find((e) => e.type === 'NormalSummoned');
      if (summoned?.type !== 'NormalSummoned') throw new Error('no summon');
      const res = await manager.submitAction(
        'duel-1',
        0,
        act(activation(r.legalActionsByViewer[0], mySet(r.views[0], 'SMP-210'))),
      );
      const negated = {
        type: 'SummonNegated',
        playerIndex: 1,
        instanceId: summoned.instanceId,
        definitionId: summoned.definitionId,
        zoneIndex: summoned.zoneIndex,
      };
      for (const viewer of [0, 1] as const) {
        expect(res.eventsByViewer[viewer], `viewer ${viewer}`).toContainEqual(negated);
      }
      // "Sent", not "destroyed"; the Normal Summon of the turn stays used although the AI still holds a monster.
      expect(types(res.events)).not.toContain('MonsterDestroyed');
      const after = res.events.slice(res.events.findIndex((e) => e.type === 'SummonNegated') + 1);
      expect(types(after)).not.toContain('NormalSummoned');
      expect(types(after)).not.toContain('MonsterSet');
      expect(gyIds(res.view, 1)).toContain(summoned.instanceId);
      expect(res.view.players[1].board.monsterZones.every((c) => c === null)).toBe(true);
      expect(res.view.players[1].hand).toHaveLength(1);
      await noLeaks(manager, res);
    });

    it('on MY turn (Main Phase) the Set Counter Trap is not listed, and sending it anyway is NOTHING_TO_RESPOND_TO', async () => {
      const base = sample('counter-summon-real');
      const { manager, r } = await start({ ...base, turn: { count: 5, player: 0 } });
      const trap = mySet(r.views[0], 'SMP-210');
      expect(r.views[0].chainWindow).toBeNull();
      expect(activationOf(r.legalActionsByViewer[0], trap)).toBeUndefined();
      const forced: PlayerAction = {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: trap, effectId: 'gate-of-refusal' },
      };
      const error = await manager.submitAction('duel-1', 0, act(forced)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DuelServiceError);
      expect(error).toMatchObject({ code: 'ACTION_REJECTED', engineCode: 'NOTHING_TO_RESPOND_TO' });
    });
  });

  describe('counter-spell-real (SMP-209)', () => {
    it('loads with the script done: the AI seat activated its Continuous Spell, its Warriors are +300 and I hold priority', async () => {
      const { manager, r } = await load('counter-spell-real');
      expect(types(r.eventsByViewer[0])).toEqual(['EffectActivated', 'ChainLinkAdded']);
      const view = r.views[0];
      expect(view.chain).toHaveLength(1);
      expect(view.chainWindow).toMatchObject({ priorityPlayer: 0 });
      expect(view.players[1].board.spellTrapZones[0]).toMatchObject({
        hidden: false,
        definitionId: 'SMP-114',
        position: 'Attack',
      });
      // SMP-001 (Warrior 1200) and SMP-008 (Warrior 1600): the bonus applies as soon as the card is face-up.
      expect([atk(view, 1, 1), atk(view, 1, 3)]).toEqual([1500, 1900]);
      expect(activationOf(r.legalActionsByViewer[0], mySet(view, 'SMP-209'))).toBeDefined();
      await noLeaks(manager, r);
    });

    it('activating SMP-209: 1000 LP paid, ChainLinkNegated reaches both seats, the Continuous Spell is in the graveyard and its bonus is gone', async () => {
      const { manager, r } = await load('counter-spell-real');
      const spell = r.views[0].players[1].board.spellTrapZones[0]!.instanceId;
      const trap = mySet(r.views[0], 'SMP-209');
      const res = await manager.submitAction(
        'duel-1',
        0,
        act(activation(r.legalActionsByViewer[0], trap)),
      );
      for (const viewer of [0, 1] as const) {
        const seen = res.eventsByViewer[viewer];
        expect(seen, `viewer ${viewer}`).toContainEqual({
          type: 'LifePointsPaid',
          playerIndex: 0,
          amount: 1000,
        });
        expect(seen, `viewer ${viewer}`).toContainEqual(
          expect.objectContaining({
            type: 'ChainLinkNegated',
            playerIndex: 1,
            instanceId: spell,
            definitionId: 'SMP-114',
            effectId: 'activate',
            byInstanceId: trap,
          }),
        );
      }
      // The negated link never resolves; its card is sent to the graveyard right after the event.
      const i = res.events.findIndex((e) => e.type === 'ChainLinkNegated');
      expect(res.events[i + 1]).toMatchObject({
        type: 'CardSentToGraveyard',
        ownerIndex: 1,
        instanceId: spell,
        definitionId: 'SMP-114',
      });
      expect(res.events.some((e) => e.type === 'EffectResolved' && e.instanceId === spell)).toBe(
        false,
      );
      for (const viewer of [0, 1] as const) {
        const view = await manager.getView('duel-1', viewer);
        expect(view.players[1].board.spellTrapZones.every((c) => c === null)).toBe(true);
        expect(gyIds(view, 1)).toContain(spell);
        expect([atk(view, 1, 1), atk(view, 1, 3)]).toEqual([1200, 1600]);
        expect(view.players[0].lifePoints).toBe(7000);
        expect(gyIds(view, 0)).toEqual([trap]);
      }
      await noLeaks(manager, res);
    });

    it('passing instead: the Continuous Spell resolves and stays, the bonus holds', async () => {
      const { manager } = await load('counter-spell-real');
      const res = await manager.submitAction('duel-1', 0, act(pass));
      expect(types(res.events)).not.toContain('ChainLinkNegated');
      const view = await manager.getView('duel-1', 0);
      expect(view.players[1].board.spellTrapZones[0]).toMatchObject({ definitionId: 'SMP-114' });
      expect(view.players[0].lifePoints).toBeLessThanOrEqual(8000);
    });
  });

  it('chain-basic (older scenario, SMP-201 Set on both sides): an AI attack now opens a reaction window for me', async () => {
    const { manager, r } = await load('chain-basic');
    const end: PlayerAction = { type: 'EndPhase', payload: { playerIndex: 0 } };
    let legal = r.legalActionsByViewer[0];
    let res: SubmitActionResult | undefined;
    // End my turn; the AI plays its own until something needs me.
    for (let i = 0; i < 6 && legal.some((a) => a.type === 'EndPhase'); i++) {
      res = await manager.submitAction('duel-1', 0, act(end));
      legal = res.legalActions;
      if (res.view.chainWindow !== null) break;
    }
    expect(res?.view.chainWindow).toMatchObject({
      priorityPlayer: 0,
      reactionTo: { kind: 'Attack' },
    });
    const trap = mySet(res!.view, 'SMP-201');
    const negated = await manager.submitAction('duel-1', 0, act(activation(legal, trap)));
    for (const viewer of [0, 1] as const) {
      expect(types(negated.eventsByViewer[viewer])).toContain('AttackNegated');
    }
    await noLeaks(manager, negated);
  });
});
