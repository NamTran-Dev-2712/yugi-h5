import {
  applyAction,
  getLegalActions,
  type Action,
  type GameEvent,
  type GameState,
} from '@yugi/game-engine';
import { SAMPLE_CARDS, type CardDefinition, type PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { DuelManager } from './duel-manager';
import { DuelServiceError } from './duel-errors';
import { InMemoryDuelStore } from './duel-store';
import { toEventView } from './event-view';
import { toStateView } from './state-view';
import { findLeaks } from './testing/leak-check';
import { hiddenIdsFor } from './visibility';
import { toPlayerActions } from './wire-actions';

/*
 * Task 4.5b — Fusion on the wire. Replaces `fusion-containment.spec.ts` (task 4.5), keeping its opponent-seat coverage.
 * The rule (owner decision, brief 4.5b (a), ADR 069): a player may see and be pointed at THEIR OWN Extra Deck; the
 * opponent only ever learns its size; the Main Decks stay closed to both.
 *  - part 1 drives the engine with the real cards (SMP-116 fuses SMP-045 from SMP-001 + SMP-007) and checks what the
 *    view layer sends to each seat at every step;
 *  - part 2 pins the per-seat oracle itself (`findLeaks`);
 *  - part 3 goes through `DuelManager` (the path HTTP uses): Extra Decks are loaded, the AI seat never has one, and a
 *    prompt answer built from `candidateInstanceIds` (not picked from `legalActions`) is accepted.
 */

const DEFS = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const defs = (id: string) => DEFS.get(id);
const ctx = { cardDefinitions: defs };

const DECK = Array.from({ length: 40 }, (_, i) => ['SMP-116', 'SMP-001', 'SMP-007'][i % 3]!);
const EXTRA = ['SMP-045', 'SMP-046', 'SMP-045'];
const FUSION_HAND = ['SMP-116', 'SMP-001', 'SMP-007'];

/** A duel whose first player opens with the fusion Spell and both materials (first seed that deals them). */
function start(): GameState {
  for (let n = 0; n < 50; n++) {
    const { state } = applyAction(null, {
      type: 'StartDuel',
      payload: {
        matchId: 'fusion-wire',
        seed: `fc-${n}`,
        playerIds: ['p0', 'p1'],
        deckLists: [DECK, DECK],
        extraDeckLists: [EXTRA, EXTRA],
      },
    });
    const hand = state.players[0].hand.map((c) => c.definitionId);
    if (FUSION_HAND.every((id) => hand.includes(id))) return state;
  }
  throw new Error('no seed deals the fusion hand');
}

interface Step {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/** Everything seat `viewer` would receive for this step: its view, its events and its own legal actions. */
function payloadFor(step: Step, viewer: 0 | 1): unknown {
  const hidden = hiddenIdsFor(step.state, viewer);
  return {
    view: toStateView(step.state, viewer, defs),
    events: step.events.flatMap((e) => {
      const view = toEventView(e, viewer, hidden);
      return view === null ? [] : [view];
    }),
    legalActions: toPlayerActions(getLegalActions(step.state, viewer, ctx)),
  };
}

/** Plays the whole Fusion Summon of seat 0 and returns every step (the start included). */
function fuse(): Step[] {
  let state = start();
  const steps: Step[] = [{ state, events: [] }];
  const apply = (action: Action): void => {
    const out = applyAction(state, action, ctx);
    state = out.state;
    steps.push(out);
  };
  const inHand = (definitionId: string): string =>
    state.players[0].hand.find((c) => c.definitionId === definitionId)!.instanceId;
  const answer = (cardInstanceIds: string[]): Action => ({
    type: 'ResolvePendingPrompt',
    payload: { playerIndex: 0, promptId: state.pendingPrompt!.promptId, cardInstanceIds },
  });

  apply({ type: 'EndPhase', payload: { playerIndex: 0 } });
  apply({ type: 'EndPhase', payload: { playerIndex: 0 } });
  apply({
    type: 'ActivateEffect',
    payload: { playerIndex: 0, cardInstanceId: inHand('SMP-116'), effectId: 'merging-crucible' },
  });
  expect(state.pendingPrompt?.kind).toBe('SelectFusionMonster');
  apply(answer(['p0-x0']));
  expect(state.pendingPrompt?.kind).toBe('SelectFusionMaterials');
  apply(answer([inHand('SMP-001'), inHand('SMP-007')]));
  expect(state.players[0].board.monsterZones[0]?.definitionId).toBe('SMP-045');
  return steps;
}

describe('Fusion on the wire (task 4.5b) — what each seat receives', () => {
  it('the real cards fuse: SMP-116 Fusion Summons SMP-045 from SMP-001 + SMP-007', () => {
    const last = fuse().at(-1)!;
    expect(last.events.map((e) => e.type)).toEqual([
      'FusionMaterialSent',
      'FusionMaterialSent',
      'MonsterFusionSummoned',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(last.state.players[0].extraDeck.map((c) => c.instanceId)).toEqual(['p0-x1', 'p0-x2']);
  });

  it('the OWNER sees their own Extra Deck (face-up to them, in order); it shrinks when the monster leaves it', () => {
    const steps = fuse();
    for (const [i, step] of steps.entries()) {
      for (const seat of [0, 1] as const) {
        const own = toStateView(step.state, seat, defs).players[seat];
        expect(own.extraDeck, `step ${i} seat ${seat}`).toEqual(
          step.state.players[seat].extraDeck.map((c) => ({
            hidden: false,
            instanceId: c.instanceId,
            definitionId: c.definitionId,
            position: null,
            ownerIndex: seat,
          })),
        );
        expect(own.extraDeckCount).toBe(step.state.players[seat].extraDeck.length);
      }
    }
    expect(toStateView(steps[0]!.state, 0, defs).players[0].extraDeck).toHaveLength(3);
    expect(toStateView(steps.at(-1)!.state, 0, defs).players[0].extraDeck).toHaveLength(2);
  });

  it('the OPPONENT gets no Extra Deck list at all — only its size — for either seat', () => {
    for (const [i, step] of fuse().entries()) {
      for (const viewer of [0, 1] as const) {
        const other = viewer === 0 ? 1 : 0;
        const seen = toStateView(step.state, viewer, defs).players[other];
        expect('extraDeck' in seen, `step ${i} viewer ${viewer}`).toBe(false);
        expect(seen.extraDeckCount).toBe(step.state.players[other].extraDeck.length);
      }
    }
  });

  it('BOTH seats pass the leak oracle at every step of a Fusion Summon', () => {
    for (const [i, step] of fuse().entries()) {
      for (const viewer of [0, 1] as const) {
        expect(
          findLeaks(step.state, viewer, payloadFor(step, viewer)),
          `step ${i} viewer ${viewer}`,
        ).toEqual([]);
      }
    }
  });

  it('nothing the opponent receives names or points at a card still in the owner’s Extra Deck', () => {
    for (const [i, step] of fuse().entries()) {
      const json = JSON.stringify(payloadFor(step, 1));
      for (const c of step.state.players[0].extraDeck) {
        expect(json.includes(`"${c.instanceId}"`), `step ${i}: ${c.instanceId}`).toBe(false);
      }
      // SMP-046 never leaves seat 0's Extra Deck and seat 1 has its own copy only in ITS Extra Deck list.
      const view = toStateView(step.state, 1, defs);
      expect(JSON.stringify(view.players[0]).includes('SMP-046'), `step ${i}`).toBe(false);
    }
  });

  it('the opponent gets the two Fusion prompts WITHOUT their payload', () => {
    const prompts = fuse()
      .map((s) => toStateView(s.state, 1, defs).pendingPrompt)
      .filter((p) => p !== null);
    expect(prompts.map((p) => p.kind)).toEqual(['SelectFusionMonster', 'SelectFusionMaterials']);
    for (const p of prompts) expect(p.payload).toBeNull();
  });

  it('the owner gets a wire payload: candidates + count only, none of the engine’s bookkeeping', () => {
    const steps = fuse();
    const monster = steps.find((s) => s.state.pendingPrompt?.kind === 'SelectFusionMonster')!;
    const materials = steps.find((s) => s.state.pendingPrompt?.kind === 'SelectFusionMaterials')!;
    const hand = (definitionId: string): string[] =>
      materials.state.players[0].hand
        .filter((c) => c.definitionId === definitionId)
        .map((c) => c.instanceId);

    const p1 = toStateView(monster.state, 0, defs).pendingPrompt!;
    expect(p1.playerIndex).toBe(0);
    // Both copies of SMP-045 can be made; SMP-046 (p0-x1) cannot.
    expect(p1.payload).toEqual({ candidateInstanceIds: ['p0-x0', 'p0-x2'], count: 1 });

    const p2 = toStateView(materials.state, 0, defs).pendingPrompt!;
    const payload = p2.payload as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      'candidateInstanceIds',
      'count',
      'fusionInstanceId',
    ]);
    expect(payload['fusionInstanceId']).toBe('p0-x0');
    expect(payload['count']).toBe(2);
    expect([...(payload['candidateInstanceIds'] as string[])].sort()).toEqual(
      [...hand('SMP-001'), ...hand('SMP-007')].sort(),
    );

    // The engine keeps more in its own payload; none of it is sent.
    const raw = monster.state.pendingPrompt!.payload as Record<string, unknown>;
    expect(Object.keys(raw)).toEqual(
      expect.arrayContaining(['linkId', 'owedTriggers', 'linkCount']),
    );
    for (const key of ['linkId', 'owedTriggers', 'linkCount']) {
      expect(JSON.stringify(p1).includes(key), key).toBe(false);
      expect(JSON.stringify(p2).includes(key), key).toBe(false);
    }
  });

  it('the two Fusion events reach BOTH seats, identical, with exactly the public fields', () => {
    const last = fuse().at(-1)!;
    const seen = ([0, 1] as const).map((viewer) => {
      const hidden = hiddenIdsFor(last.state, viewer);
      return last.events.flatMap((e) => {
        const view = toEventView(e, viewer, hidden);
        return view === null ? [] : [view];
      });
    });
    expect(seen[0]).toEqual(seen[1]);
    expect(seen[0]!.map((e) => e.type)).toEqual(last.events.map((e) => e.type));
    const [m1, m2, summoned] = seen[0]!;
    for (const m of [m1!, m2!]) {
      expect(Object.keys(m).sort()).toEqual([
        'definitionId',
        'from',
        'instanceId',
        'ownerIndex',
        'type',
      ]);
      expect(m).toMatchObject({ type: 'FusionMaterialSent', ownerIndex: 0, from: 'Hand' });
    }
    expect(Object.keys(summoned!).sort()).toEqual([
      'definitionId',
      'instanceId',
      'materialInstanceIds',
      'playerIndex',
      'position',
      'type',
      'zoneIndex',
    ]);
    expect(summoned).toMatchObject({
      type: 'MonsterFusionSummoned',
      playerIndex: 0,
      instanceId: 'p0-x0',
      definitionId: 'SMP-045',
      zoneIndex: 0,
      position: 'Attack',
    });
  });

  it('a material from the field keeps its zoneIndex; a field an engine event may grow later is NOT forwarded', () => {
    const none = new Set<string>();
    const fromField = {
      type: 'FusionMaterialSent',
      ownerIndex: 1,
      instanceId: 'p1-4',
      definitionId: 'SMP-001',
      from: 'MonsterZone',
      zoneIndex: 3,
      internalNote: 'server-side only',
    } as unknown as GameEvent;
    expect(toEventView(fromField, 0, none)).toEqual({
      type: 'FusionMaterialSent',
      ownerIndex: 1,
      instanceId: 'p1-4',
      definitionId: 'SMP-001',
      from: 'MonsterZone',
      zoneIndex: 3,
    });
    const summoned = {
      type: 'MonsterFusionSummoned',
      playerIndex: 1,
      instanceId: 'p1-x0',
      definitionId: 'SMP-045',
      zoneIndex: 2,
      position: 'Attack',
      materialInstanceIds: ['p1-4', 'p1-9'],
      owedTriggers: [{ instanceId: 'p0-3', definitionId: 'SMP-011' }],
    } as unknown as GameEvent;
    const view = toEventView(summoned, 0, none);
    expect(view).toEqual({
      type: 'MonsterFusionSummoned',
      playerIndex: 1,
      instanceId: 'p1-x0',
      definitionId: 'SMP-045',
      zoneIndex: 2,
      position: 'Attack',
      materialInstanceIds: ['p1-4', 'p1-9'],
    });
  });

  it('hiddenIdsFor is per seat: the opponent’s Extra Deck is hidden, the viewer’s own is not; both Main Decks stay hidden', () => {
    const state = start();
    for (const viewer of [0, 1] as const) {
      const other = viewer === 0 ? 1 : 0;
      const hidden = hiddenIdsFor(state, viewer);
      for (const c of state.players[viewer].extraDeck) expect(hidden.has(c.instanceId)).toBe(false);
      for (const c of state.players[other].extraDeck) expect(hidden.has(c.instanceId)).toBe(true);
      for (const p of state.players) {
        for (const c of p.deck) expect(hidden.has(c.instanceId)).toBe(true);
      }
      for (const c of state.players[other].hand) expect(hidden.has(c.instanceId)).toBe(true);
      for (const c of state.players[viewer].hand) expect(hidden.has(c.instanceId)).toBe(false);
    }
  });
});

describe('the leak oracle is per seat for the Extra Deck only (task 4.5b)', () => {
  const state = start();
  const ownDeckCard = state.players[0].deck[0]!;

  it('naming an Extra Deck card: fine for its owner, a leak for the opponent', () => {
    const payload = { card: { instanceId: 'p0-x0', definitionId: 'SMP-045' } };
    expect(findLeaks(state, 0, payload)).toEqual([]);
    const leaks = findLeaks(state, 1, payload);
    expect(leaks).toHaveLength(1);
    expect(leaks[0]).toMatchObject({ viewer: 1, instanceId: 'p0-x0', definitionId: 'SMP-045' });
  });

  it('pointing at an Extra Deck card: fine for its owner, a leak for the opponent', () => {
    const payload = { candidateInstanceIds: ['p0-x0'], fusionInstanceId: 'p0-x2' };
    expect(findLeaks(state, 0, payload)).toEqual([]);
    const leaks = findLeaks(state, 1, payload);
    expect(leaks.map((l) => l.instanceId).sort()).toEqual(['p0-x0', 'p0-x2']);
    for (const l of leaks)
      expect(l.reason).toBe('an id list points at a card hidden from the viewer');
  });

  it('a wrong definitionId for an own Extra Deck card is still caught', () => {
    const leaks = findLeaks(state, 0, { card: { instanceId: 'p0-x0', definitionId: 'SMP-046' } });
    expect(leaks).toHaveLength(1);
    expect(leaks[0]!.reason).toMatch(/^wrong definitionId/);
  });

  it('NOT relaxed: a Main Deck card is never named nor pointed at — not even for its owner', () => {
    for (const viewer of [0, 1] as const) {
      expect(
        findLeaks(state, viewer, {
          card: { instanceId: ownDeckCard.instanceId, definitionId: ownDeckCard.definitionId },
        }),
        `named, viewer ${viewer}`,
      ).toHaveLength(1);
      expect(
        findLeaks(state, viewer, { targetInstanceIds: [ownDeckCard.instanceId] }),
        `pointed, viewer ${viewer}`,
      ).toHaveLength(1);
    }
  });

  it('NOT relaxed: the opponent’s hand is still hidden from the viewer', () => {
    const theirs = state.players[1].hand[0]!;
    expect(
      findLeaks(state, 0, {
        card: { instanceId: theirs.instanceId, definitionId: theirs.definitionId },
      }),
    ).toHaveLength(1);
    expect(findLeaks(state, 0, { cardInstanceIds: [theirs.instanceId] })).toHaveLength(1);
  });
});

describe('DuelManager loads Extra Decks (task 4.5b)', () => {
  const manager = (): DuelManager =>
    new DuelManager({ store: new InMemoryDuelStore(), cardDefinitions: defs });

  const code = async (run: () => Promise<unknown>): Promise<string> => {
    try {
      await run();
    } catch (e) {
      if (e instanceof DuelServiceError) return e.code;
      throw e;
    }
    return 'no error';
  };

  it('createDuel passes extraDeckLists to the engine; each seat’s view lists its own Extra Deck only', async () => {
    const m = manager();
    const created = await m.createDuel({
      playerIds: ['a', 'b'],
      deckLists: [DECK, DECK],
      extraDeckLists: [EXTRA, ['SMP-046']],
      mode: 'solo-debug',
      ownerId: 'a',
      seed: 'ew-1',
    });
    const raw = (await m.getDuel(created.duelId)).state;
    expect(raw.players[0].extraDeck.map((c) => c.definitionId)).toEqual(EXTRA);
    expect(raw.players[1].extraDeck.map((c) => c.definitionId)).toEqual(['SMP-046']);
    expect(created.views[0].players[0].extraDeck?.map((c) => c.definitionId)).toEqual(EXTRA);
    expect('extraDeck' in created.views[0].players[1]).toBe(false);
    expect(created.views[0].players[1].extraDeckCount).toBe(1);
    expect(created.views[1].players[1].extraDeck?.map((c) => c.definitionId)).toEqual(['SMP-046']);
    expect('extraDeck' in created.views[1].players[0]).toBe(false);
  });

  it('a duel created without extraDeckLists is the same duel as before (empty Extra Decks)', async () => {
    const m = manager();
    const config = {
      playerIds: ['a', 'b'] as const,
      deckLists: [DECK, DECK] as const,
      mode: 'solo-debug' as const,
      ownerId: 'a',
      seed: 'ew-same',
    };
    const plain = await m.createDuel(config);
    const empty = await m.createDuel({ ...config, extraDeckLists: [[], []] });
    const a = (await m.getDuel(plain.duelId)).state;
    const b = (await m.getDuel(empty.duelId)).state;
    expect({ ...b, matchId: a.matchId }).toEqual(a);
    expect(plain.views[0].players[0].extraDeck).toEqual([]);
  });

  it('solo-vs-ai: the AI seat ALWAYS starts with an empty Extra Deck, whatever the config says', async () => {
    const m = manager();
    const created = await m.createDuel({
      playerIds: ['human', 'ai'],
      deckLists: [DECK, DECK],
      extraDeckLists: [EXTRA, EXTRA],
      mode: 'solo-vs-ai',
      ownerId: 'human',
      aiSeat: 1,
      seed: 'ew-ai',
    });
    const raw = (await m.getDuel(created.duelId)).state;
    expect(raw.players[1].extraDeck).toEqual([]);
    expect(raw.players[0].extraDeck).toHaveLength(3);
    expect(created.views[0].players[1].extraDeckCount).toBe(0);
  });

  it('refuses an unknown card (UNKNOWN_CARD) and an Extra Deck over the ruleset size (INVALID_CONFIG)', async () => {
    const m = manager();
    const base = {
      playerIds: ['a', 'b'] as const,
      deckLists: [DECK, DECK] as const,
      mode: 'solo-debug' as const,
      ownerId: 'a',
    };
    expect(await code(() => m.createDuel({ ...base, extraDeckLists: [['NOPE'], []] }))).toBe(
      'UNKNOWN_CARD',
    );
    const many = Array.from({ length: 21 }, () => 'SMP-045');
    expect(await code(() => m.createDuel({ ...base, extraDeckLists: [[], many] }))).toBe(
      'INVALID_CONFIG',
    );
  });

  it('a whole Fusion Summon through submitAction: answers built from candidateInstanceIds, both seats’ events filtered', async () => {
    const m = manager();
    let duelId = '';
    let state: GameState | undefined;
    for (let n = 0; n < 50 && !state; n++) {
      const created = await m.createDuel({
        playerIds: ['a', 'b'],
        deckLists: [DECK, DECK],
        extraDeckLists: [EXTRA, EXTRA],
        mode: 'solo-debug',
        ownerId: 'a',
        seed: `ew-play-${n}`,
      });
      const raw = (await m.getDuel(created.duelId)).state;
      const hand = raw.players[0].hand.map((c) => c.definitionId);
      if (FUSION_HAND.every((id) => hand.includes(id))) {
        duelId = created.duelId;
        state = raw;
      }
    }
    if (!state) throw new Error('no seed deals the fusion hand');
    const send = (action: PlayerAction) => m.submitAction(duelId, 0, action as unknown as Action);
    await send({ type: 'EndPhase', payload: { playerIndex: 0 } });
    await send({ type: 'EndPhase', payload: { playerIndex: 0 } });
    const spell = state.players[0].hand.find((c) => c.definitionId === 'SMP-116')!.instanceId;
    let out = await send({
      type: 'ActivateEffect',
      payload: { playerIndex: 0, cardInstanceId: spell, effectId: 'merging-crucible' },
    });

    type Wire = { candidateInstanceIds: string[]; count: number };
    let prompt = out.view.pendingPrompt!;
    expect(prompt.kind).toBe('SelectFusionMonster');
    const first = prompt.payload as Wire;
    out = await send({
      type: 'ResolvePendingPrompt',
      payload: {
        playerIndex: 0,
        promptId: prompt.promptId,
        cardInstanceIds: first.candidateInstanceIds.slice(0, first.count),
      },
    });

    prompt = out.view.pendingPrompt!;
    expect(prompt.kind).toBe('SelectFusionMaterials');
    const second = prompt.payload as Wire;
    const own = out.view.players[0];
    const idOf = (definitionId: string): string =>
      second.candidateInstanceIds.find((id) =>
        own.hand.some((c) => !c.hidden && c.instanceId === id && c.definitionId === definitionId),
      )!;
    out = await send({
      type: 'ResolvePendingPrompt',
      payload: {
        playerIndex: 0,
        promptId: prompt.promptId,
        cardInstanceIds: [idOf('SMP-001'), idOf('SMP-007')],
      },
    });

    expect(out.view.pendingPrompt).toBeNull();
    const zone = out.view.players[0].board.monsterZones[0];
    expect(zone && !zone.hidden ? zone.definitionId : null).toBe('SMP-045');
    for (const viewer of [0, 1] as const) {
      expect(out.eventsByViewer[viewer].map((e) => e.type)).toEqual([
        'FusionMaterialSent',
        'FusionMaterialSent',
        'MonsterFusionSummoned',
        'EffectResolved',
        'CardSentToGraveyard',
        'ChainResolved',
      ]);
    }
    const raw = (await m.getDuel(duelId)).state;
    expect(
      findLeaks(raw, 0, { view: out.view, events: out.events, legal: out.legalActions }),
    ).toEqual([]);
    expect(
      findLeaks(raw, 1, { view: await m.getView(duelId, 1), events: out.eventsByViewer[1] }),
    ).toEqual([]);
  });
});
