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
 * Task 4.5b — Fusion on the wire, through the three Sandbox scenarios built on the real cards SMP-116 (the fusion
 * Spell), SMP-045 / SMP-047 (Fusion Monsters), SMP-202 (destroys a monster) and SMP-209 (Counter Trap): the same
 * DuelManager path as HTTP, in `solo-vs-ai` (the server AI plays seat 1). Engine rules are not re-tested here, only
 * what each seat receives. The prompt answers are built from the prompt payload, as the screen does.
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
const pass: PlayerAction = { type: 'PassPriority', payload: { playerIndex: 0 } };

type Known = CardView & { hidden: false };
const inHand = (view: StateView, definitionId: string): string => {
  const found = view.players[0].hand.find(
    (c): c is Known => !c.hidden && c.definitionId === definitionId,
  );
  if (!found) throw new Error(`${definitionId} is not in my hand`);
  return found.instanceId;
};
const inExtra = (view: StateView, definitionId: string): string => {
  const found = view.players[0].extraDeck?.find((c) => c.definitionId === definitionId);
  if (!found) throw new Error(`${definitionId} is not in my Extra Deck`);
  return found.instanceId;
};
const onField = (view: StateView, seat: 0 | 1, zone: number): Known | null => {
  const c = view.players[seat].board.monsterZones[zone];
  return c && !c.hidden ? c : null;
};
const mySet = (view: StateView, definitionId: string): string => {
  const found = view.players[0].board.spellTrapZones.find(
    (c): c is Known => c !== null && !c.hidden && c.definitionId === definitionId,
  );
  if (!found) throw new Error(`${definitionId} is not Set on my side`);
  return found.instanceId;
};
const activation = (legal: readonly PlayerAction[], cardInstanceId: string): PlayerAction => {
  const found = legal.find(
    (a) => a.type === 'ActivateEffect' && a.payload.cardInstanceId === cardInstanceId,
  );
  if (!found) throw new Error(`no ActivateEffect listed for ${cardInstanceId}`);
  return found;
};
interface Wire {
  readonly candidateInstanceIds: readonly string[];
  readonly count: number;
  readonly fusionInstanceId?: string;
}
const answer = (view: StateView, cardInstanceIds: string[]): PlayerAction => ({
  type: 'ResolvePendingPrompt',
  payload: { playerIndex: 0, promptId: view.pendingPrompt!.promptId, cardInstanceIds },
});

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

describe('Sandbox scenarios on Fusion (task 4.5b)', () => {
  describe('fusion-success-real (hand + field, then the Fusion Monster’s own trigger)', () => {
    it('loads on my Main Phase with my Extra Deck visible to me only and the fusion Spell listed', async () => {
      const { manager, r } = await load('fusion-success-real');
      const view = r.views[0];
      expect(view.players[0].extraDeck?.map((c) => c.definitionId)).toEqual([
        'SMP-045',
        'SMP-046',
        'SMP-047',
      ]);
      expect('extraDeck' in view.players[1]).toBe(false);
      expect(r.views[1].players[0].extraDeckCount).toBe(3);
      expect('extraDeck' in r.views[1].players[0]).toBe(false);
      expect(
        r.legalActionsByViewer[0].some(
          (a) =>
            a.type === 'ActivateEffect' && a.payload.cardInstanceId === inHand(view, 'SMP-116'),
        ),
      ).toBe(true);
      await noLeaks(manager, r);
    });

    it('activate → choose the monster (2 candidates) → choose the materials (hand + field) → Fusion Summon, then its 500 burn on a new chain', async () => {
      const { manager, r } = await load('fusion-success-real');
      const spell = inHand(r.views[0], 'SMP-116');
      let res = await manager.submitAction(
        'duel-1',
        0,
        act(activation(r.legalActionsByViewer[0], spell)),
      );
      // Nobody can respond (the AI has no Set card): the chain pauses on the first prompt at once.
      expect(types(res.events)).toEqual(['EffectActivated', 'ChainLinkAdded']);
      expect(res.view.pendingPrompt).toMatchObject({ kind: 'SelectFusionMonster', playerIndex: 0 });
      const first = res.view.pendingPrompt!.payload as Wire;
      // SMP-045 (hand: SMP-001 + SMP-007) and SMP-047 (hand SMP-006 + field SMP-009); SMP-046 cannot be made.
      expect([...first.candidateInstanceIds].sort()).toEqual(
        [inExtra(res.view, 'SMP-045'), inExtra(res.view, 'SMP-047')].sort(),
      );
      expect(first.count).toBe(1);
      expect((await manager.getView('duel-1', 1)).pendingPrompt).toMatchObject({
        kind: 'SelectFusionMonster',
        payload: null,
      });
      await noLeaks(manager, res);

      const fusion = inExtra(res.view, 'SMP-047');
      res = await manager.submitAction('duel-1', 0, act(answer(res.view, [fusion])));
      expect(res.events).toEqual([]);
      expect(res.view.pendingPrompt).toMatchObject({ kind: 'SelectFusionMaterials' });
      const second = res.view.pendingPrompt!.payload as Wire;
      const fromHand = inHand(res.view, 'SMP-006');
      const fromField = onField(res.view, 0, 2)!.instanceId;
      expect(second.fusionInstanceId).toBe(fusion);
      expect(second.count).toBe(2);
      expect([...second.candidateInstanceIds].sort()).toEqual([fromHand, fromField].sort());
      expect((await manager.getView('duel-1', 1)).pendingPrompt?.payload).toBeNull();
      await noLeaks(manager, res);

      res = await manager.submitAction('duel-1', 0, act(answer(res.view, [fromField, fromHand])));
      for (const viewer of [0, 1] as const) {
        const seen = res.eventsByViewer[viewer];
        expect(seen.slice(0, 3), `viewer ${viewer}`).toEqual([
          {
            type: 'FusionMaterialSent',
            ownerIndex: 0,
            instanceId: fromField,
            definitionId: 'SMP-009',
            from: 'MonsterZone',
            zoneIndex: 2,
          },
          {
            type: 'FusionMaterialSent',
            ownerIndex: 0,
            instanceId: fromHand,
            definitionId: 'SMP-006',
            from: 'Hand',
          },
          {
            type: 'MonsterFusionSummoned',
            playerIndex: 0,
            instanceId: fusion,
            definitionId: 'SMP-047',
            zoneIndex: 0,
            position: 'Attack',
            materialInstanceIds: [fromField, fromHand],
          },
        ]);
      }
      // The Fusion Monster's "when Summoned" effect: a new chain after the fusion chain, 500 damage to the AI.
      const t = types(res.events);
      expect(t.indexOf('ChainResolved')).toBeLessThan(t.lastIndexOf('ChainLinkAdded'));
      expect(res.events).toContainEqual({ type: 'DamageDealt', playerIndex: 1, amount: 500 });
      expect(res.view.players[1].lifePoints).toBe(7500);
      expect(onField(res.view, 0, 0)).toMatchObject({
        definitionId: 'SMP-047',
        position: 'Attack',
      });
      expect(onField(res.view, 0, 2)).toBeNull();
      expect(res.view.players[0].graveyard.map((c) => c.definitionId)).toEqual([
        'SMP-009',
        'SMP-006',
        'SMP-116',
      ]);
      expect(res.view.players[0].extraDeck?.map((c) => c.definitionId)).toEqual([
        'SMP-045',
        'SMP-046',
      ]);
      expect(res.view.pendingPrompt).toBeNull();
      await noLeaks(manager, res);
    });

    it('an answer the server refuses (a card that is no candidate) is a 409-style rejection and the prompt stays open', async () => {
      const { manager, r } = await load('fusion-success-real');
      let res = await manager.submitAction(
        'duel-1',
        0,
        act(activation(r.legalActionsByViewer[0], inHand(r.views[0], 'SMP-116'))),
      );
      res = await manager.submitAction(
        'duel-1',
        0,
        act(answer(res.view, [inExtra(res.view, 'SMP-047')])),
      );
      const wrong = answer(res.view, [inHand(res.view, 'SMP-006'), inHand(res.view, 'SMP-001')]);
      const error = await manager.submitAction('duel-1', 0, act(wrong)).catch((e: unknown) => e);
      expect(error).toMatchObject({ code: 'ACTION_REJECTED', engineCode: 'INVALID_EFFECT_TARGET' });
      expect((await manager.getView('duel-1', 0)).pendingPrompt?.kind).toBe(
        'SelectFusionMaterials',
      );
    });
  });

  describe('fusion-material-destroyed-real (the AI’s Set Trap destroys the material on my field)', () => {
    it('the AI answers my fusion Spell with SMP-202: the material is destroyed, the Spell resolves without effect, nobody is asked', async () => {
      const { manager, r } = await load('fusion-material-destroyed-real');
      const view = r.views[0];
      const material = onField(view, 0, 2)!.instanceId;
      const res = await manager.submitAction(
        'duel-1',
        0,
        act(activation(r.legalActionsByViewer[0], inHand(view, 'SMP-116'))),
      );
      expect(res.aiActions.map((a) => a.action.type)).toContain('ActivateEffect');
      const t = types(res.events);
      expect(t).toContain('MonsterDestroyed');
      expect(t).not.toContain('FusionMaterialSent');
      expect(t).not.toContain('MonsterFusionSummoned');
      expect(res.events).toContainEqual(
        expect.objectContaining({ type: 'MonsterDestroyed', instanceId: material }),
      );
      // The fusion Spell still resolves (no fizzle event) and goes to the graveyard; the other material stays in hand.
      expect(res.events).toContainEqual(
        expect.objectContaining({ type: 'EffectResolved', definitionId: 'SMP-116' }),
      );
      expect(res.view.pendingPrompt).toBeNull();
      expect(res.view.players[0].graveyard.map((c) => c.definitionId).sort()).toEqual([
        'SMP-009',
        'SMP-116',
      ]);
      expect(res.view.players[0].hand.some((c) => !c.hidden && c.definitionId === 'SMP-006')).toBe(
        true,
      );
      expect(res.view.players[0].extraDeck?.map((c) => c.definitionId)).toEqual(['SMP-047']);
      expect(res.view.players[0].extraDeckCount).toBe(1);
      for (const viewer of [0, 1] as const) {
        expect(types(res.eventsByViewer[viewer])).toEqual(t);
      }
      await noLeaks(manager, res);
    });
  });

  describe('fusion-negated-real (the AI seat fuses by script, I hold the Counter Trap)', () => {
    it('loads with the AI’s fusion Spell on the chain and the window held by me; I learn nothing of its Extra Deck', async () => {
      const { manager, r } = await load('fusion-negated-real');
      expect(types(r.eventsByViewer[0])).toEqual(['EffectActivated', 'ChainLinkAdded']);
      const view = r.views[0];
      expect(view.chain).toHaveLength(1);
      expect(view.chainWindow).toMatchObject({ priorityPlayer: 0 });
      expect(view.players[1].extraDeckCount).toBe(1);
      expect('extraDeck' in view.players[1]).toBe(false);
      expect(JSON.stringify({ view, events: r.eventsByViewer[0] })).not.toContain('p1-x0');
      expect(JSON.stringify({ view, events: r.eventsByViewer[0] })).not.toContain('SMP-045');
      activation(r.legalActionsByViewer[0], mySet(view, 'SMP-209'));
      await noLeaks(manager, r);
    });

    it('activating SMP-209: ChainLinkNegated reaches both seats, no material is used, the Fusion Monster stays in the Extra Deck', async () => {
      const { manager, r } = await load('fusion-negated-real');
      const trap = mySet(r.views[0], 'SMP-209');
      const res = await manager.submitAction(
        'duel-1',
        0,
        act(activation(r.legalActionsByViewer[0], trap)),
      );
      for (const viewer of [0, 1] as const) {
        expect(res.eventsByViewer[viewer], `viewer ${viewer}`).toContainEqual(
          expect.objectContaining({
            type: 'ChainLinkNegated',
            playerIndex: 1,
            definitionId: 'SMP-116',
            byInstanceId: trap,
          }),
        );
      }
      const t = types(res.events);
      expect(t).not.toContain('FusionMaterialSent');
      expect(t).not.toContain('MonsterFusionSummoned');
      const raw = (await manager.getDuel('duel-1')).state;
      expect(raw.players[1].extraDeck.map((c) => c.definitionId)).toEqual(['SMP-045']);
      expect(raw.players[1].graveyard.map((c) => c.definitionId)).toEqual(['SMP-116']);
      expect(res.view.players[1].extraDeckCount).toBe(1);
      expect(res.view.players[0].lifePoints).toBe(7000);
      await noLeaks(manager, res);
    });

    it('passing instead: the AI is asked both Fusion prompts, answers them (never stuck) and Fusion Summons — its answers reach me without the hidden ids', async () => {
      const { manager, r } = await load('fusion-negated-real');
      const res = await manager.submitAction('duel-1', 0, act(pass));
      const answers = res.aiActions.filter((a) => a.action.type === 'ResolvePendingPrompt');
      expect(answers.map((a) => a.promptKind).slice(0, 2)).toEqual([
        'SelectFusionMonster',
        'SelectFusionMaterials',
      ]);
      // The monster was in the AI's Extra Deck and the materials in its hand when it chose: at the end of the request
      // they are on the field / in the graveyard (public), so the ids are no longer hidden — checked by the oracle.
      expect(types(res.events)).toContain('MonsterFusionSummoned');
      const mine = await manager.getView('duel-1', 0);
      expect(
        mine.players[1].board.monsterZones.some(
          (c) => c && !c.hidden && c.definitionId === 'SMP-045',
        ),
      ).toBe(true);
      expect(mine.players[1].extraDeckCount).toBe(0);
      expect(mine.winnerIndex === null ? mine.pendingPrompt?.playerIndex !== 1 : true).toBe(true);
      await noLeaks(manager, res);
    });
  });
});
