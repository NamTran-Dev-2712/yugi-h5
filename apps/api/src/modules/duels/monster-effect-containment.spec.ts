import { applyAction, getLegalActions, type Action, type GameState } from '@yugi/game-engine';
import {
  ScenarioSchema,
  type CardDefinition,
  type PlayerAction,
  type Scenario,
} from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { scenarioToState } from '../dev-sandbox/scenario-to-state';
import { lookupCard } from './card-pool';
import { DuelServiceError } from './duel-errors';
import { DuelManager } from './duel-manager';
import { InMemoryDuelStore } from './duel-store';
import { ENGINE_ONLY_RULESET_KEYS, wireRuleset } from './wire-ruleset';

/**
 * Task 4.8 — containment. The engine can let a monster on the field activate its Ignition effect, behind the ruleset key
 * `allowMonsterEffectActivation`. Nothing of that is on the wire yet (task 4.8b: actions the client can build, UI, real
 * cards), so NO duel the API creates ever has the key — not through `createDuel`, not through a Sandbox scenario that
 * asks for it. A monster's effect is then never listed, never accepted, and the AI never picks it.
 * The monster used here is a test-only card: no real card has such an effect.
 */

const IGNITION_MONSTER = 'T48-IGN';
const TEST_CARDS: Record<string, CardDefinition> = {
  [IGNITION_MONSTER]: {
    id: IGNITION_MONSTER,
    kind: 'Monster',
    name: { vi: 'Thử nghiệm 4.8', en: 'Task 4.8 test monster' },
    category: 'Effect',
    attribute: 'FIRE',
    race: 'Pyro',
    level: 4,
    atk: 1500,
    def: 1000,
    effects: [
      {
        id: 'burn',
        trigger: { kind: 'Ignition' },
        oncePerTurn: true,
        cost: [{ kind: 'PayLP', amount: 500 }],
        operations: [{ kind: 'Damage', amount: 500, target: 'opponent' }],
      },
    ],
  },
};
const cards = (id: string): CardDefinition | undefined => TEST_CARDS[id] ?? lookupCard(id);

const makeManager = () =>
  new DuelManager({
    store: new InMemoryDuelStore(),
    cardDefinitions: cards,
    newDuelId: () => 'duel-1',
  });

const DECK = Array.from({ length: 40 }, () => IGNITION_MONSTER);
const endPhase = (playerIndex: 0 | 1): Action => ({ type: 'EndPhase', payload: { playerIndex } });
const activations = (legal: readonly PlayerAction[]) =>
  legal.filter((a) => a.type === 'ActivateEffect');

/** A scenario that ASKS for the flag: seat `owner` has the test monster face-up, it is their Main Phase 1. */
const scenario = (owner: 0 | 1): Scenario => {
  const plain = {
    lp: 8000,
    hand: ['SMP-001'],
    deck: ['SMP-004', 'SMP-005', 'SMP-006', 'SMP-007'],
    field: { monsters: [], spellTraps: [] },
    gy: [],
  };
  const withMonster = {
    ...plain,
    field: {
      monsters: [{ card: IGNITION_MONSTER, zone: 0, position: 'Attack' as const }],
      spellTraps: [],
    },
  };
  return ScenarioSchema.parse({
    name: 'monster-effect-containment',
    ruleset: { allowMonsterEffectActivation: true, handLimit: 5 },
    seed: 'containment-1',
    players: owner === 0 ? [withMonster, plain] : [plain, withMonster],
    turn: { count: 3, player: owner },
    phase: 'Main1',
  });
};

describe('wireRuleset (task 4.8)', () => {
  it('drops the engine-only keys and nothing else; returns undefined when nothing is left', () => {
    expect(ENGINE_ONLY_RULESET_KEYS).toEqual(['allowMonsterEffectActivation']);
    expect(wireRuleset({ allowMonsterEffectActivation: true, handLimit: 5 })).toEqual({
      handLimit: 5,
    });
    expect(wireRuleset({ allowMonsterEffectActivation: true })).toBeUndefined();
    expect(wireRuleset({ allowMonsterEffectActivation: false })).toBeUndefined();
    expect(wireRuleset({ startingLP: 4000 })).toEqual({ startingLP: 4000 });
    expect(wireRuleset(undefined)).toBeUndefined();
  });
});

describe('the engine really has the feature (so the tests below would see it if it got through)', () => {
  it('with the key on, the engine lists and accepts the monster effect of this very scenario', () => {
    const state = scenarioToState(scenario(0), { matchId: 'raw', playerIds: ['a', 'b'] }, cards);
    const on: GameState = {
      ...state,
      ruleset: { ...state.ruleset, allowMonsterEffectActivation: true },
    };
    const listed = getLegalActions(on, 0, { cardDefinitions: cards }).filter(
      (a) => a.type === 'ActivateEffect',
    );
    expect(listed).toHaveLength(1);
    const done = applyAction(on, listed[0]!, { cardDefinitions: cards });
    expect(done.state.players[1].lifePoints).toBe(7500);
  });
});

describe('createDuel never passes the key on (task 4.8)', () => {
  async function started() {
    const manager = makeManager();
    const { duelId } = await manager.createDuel({
      playerIds: ['alice', 'bob'],
      deckLists: [DECK, DECK],
      ruleset: { allowMonsterEffectActivation: true, handLimit: 5 },
      seed: 'containment-2',
      mode: 'solo-debug',
      ownerId: 'alice',
    });
    return { manager, duelId };
  }

  it('the stored state, the recorded start action and both views have no such key; other overrides stay', async () => {
    const { manager, duelId } = await started();
    const session = await manager.getDuel(duelId);
    expect('allowMonsterEffectActivation' in session.state.ruleset).toBe(false);
    expect(session.state.ruleset.handLimit).toBe(5);
    expect(JSON.stringify(session)).not.toContain('allowMonsterEffectActivation');
    for (const seat of [0, 1] as const) {
      const view = await manager.getView(duelId, seat);
      expect(JSON.stringify(view)).not.toContain('allowMonsterEffectActivation');
      expect(view.ruleset.handLimit).toBe(5);
    }
  });

  it('a Summoned monster with an Ignition effect: nothing listed, the action is refused, the state is untouched', async () => {
    const { manager, duelId } = await started();
    await manager.submitAction(duelId, 0, endPhase(0));
    await manager.submitAction(duelId, 0, endPhase(0));
    const hand = (await manager.getView(duelId, 0)).players[0].hand;
    const cardInstanceId = hand[0]!.instanceId;
    await manager.submitAction(duelId, 0, {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId, zoneIndex: 0 },
    });
    expect(activations(await manager.getLegalActions(duelId, 0))).toEqual([]);

    const before = (await manager.getDuel(duelId)).state;
    const refused = await manager
      .submitAction(duelId, 0, {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId, effectId: 'burn' },
      })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(refused).toBeInstanceOf(DuelServiceError);
    expect((refused as DuelServiceError).engineCode).toBe('CARD_NOT_IN_HAND');
    expect((await manager.getDuel(duelId)).state).toEqual(before);
  });
});

describe('a Sandbox scenario that asks for the key does not get it (task 4.8)', () => {
  it('the scenario schema accepts the key (it mirrors the ruleset schema) — the manager is what stops it', () => {
    expect(scenario(0).ruleset).toEqual({ allowMonsterEffectActivation: true, handLimit: 5 });
  });

  it('two seats: no key in the state or the views, no monster effect listed, the action is refused', async () => {
    const manager = makeManager();
    const s = scenario(0);
    const { duelId } = await manager.createDuelFromState({
      state: scenarioToState(s, { matchId: 'duel-1', playerIds: ['owner', 'owner'] }, cards),
      seed: s.seed,
      mode: 'solo-debug',
      ownerId: 'owner',
    });
    const session = await manager.getDuel(duelId);
    expect(JSON.stringify(session)).not.toContain('allowMonsterEffectActivation');
    expect(session.state.ruleset.handLimit).toBe(5);
    expect(JSON.stringify(await manager.getView(duelId, 0))).not.toContain(
      'allowMonsterEffectActivation',
    );
    expect(activations(await manager.getLegalActions(duelId, 0))).toEqual([]);

    const monster = session.state.players[0].board.monsterZones[0]!;
    await expect(
      manager.submitAction(duelId, 0, {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: monster.instanceId, effectId: 'burn' },
      }),
    ).rejects.toMatchObject({ engineCode: 'CARD_NOT_IN_HAND' });
  });

  it('solo-vs-ai, the AI controls the monster and moves first: it never activates it', async () => {
    const manager = makeManager();
    const s = scenario(1);
    const created = await manager.createDuelFromState({
      state: scenarioToState(s, { matchId: 'duel-1', playerIds: ['owner', 'owner:ai'] }, cards),
      seed: s.seed,
      mode: 'solo-vs-ai',
      ownerId: 'owner',
      aiSeat: 1,
    });
    const aiActions = created.aiActions ?? [];
    expect(aiActions.length).toBeGreaterThan(0);
    expect(aiActions.filter((a) => a.action.type === 'ActivateEffect')).toEqual([]);
    const state = (await manager.getDuel(created.duelId)).state;
    expect(state.players[0].lifePoints + state.players[1].lifePoints).toBeLessThanOrEqual(16000);
    expect(JSON.stringify(state.ruleset)).not.toContain('allowMonsterEffectActivation');
    // Nothing was paid for an effect: the AI's Life Points are intact.
    expect(state.players[1].lifePoints).toBe(8000);
  });
});
