import type { Action, CardInstance, GameState } from '@yugi/game-engine';
import type { CardDefinition, CardView, EventView, StateView } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { DuelManager, type SubmitActionResult } from './duel-manager';
import { InMemoryDuelStore } from './duel-store';

/** Original placeholder monsters; no official card data. */
const monster = (id: string, level: number, atk: number, def: number): [string, CardDefinition] => [
  id,
  {
    id,
    kind: 'Monster',
    name: id,
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level,
    atk,
    def,
  } as CardDefinition,
];

const DEFS = new Map<string, CardDefinition>([
  monster('TST-A', 3, 1500, 500),
  monster('TST-B', 3, 1000, 2000),
  monster('TST-HI', 6, 2000, 1000),
  monster('TST-SECRET-MON', 3, 100, 500),
]);

async function setup() {
  const store = new InMemoryDuelStore();
  let n = 0;
  const manager = new DuelManager({
    store,
    cardDefinitions: (id) => DEFS.get(id),
    newDuelId: () => `duel-${++n}`,
    newSeed: () => `seed-${n}`,
  });
  const { duelId } = await manager.createDuel({
    playerIds: ['alice', 'bob'],
    deckLists: [Array(20).fill('TST-A'), Array(20).fill('TST-B')],
  });
  return { manager, store, duelId };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

const inst = (
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1,
  position: CardInstance['position'],
): CardInstance => ({ instanceId, definitionId, ownerIndex, position });

async function patch(ctx: Ctx, fn: (s: GameState) => GameState): Promise<void> {
  const session = (await ctx.store.get(ctx.duelId))!;
  await ctx.store.save({ ...session, state: fn(session.state) });
}

const endPhase = (playerIndex: 0 | 1): Action => ({ type: 'EndPhase', payload: { playerIndex } });

/** Every card the view shows in full, and the instanceIds it shows as hidden. */
function cardsIn(view: StateView): { visible: Map<string, string>; hidden: Set<string> } {
  const visible = new Map<string, string>();
  const hidden = new Set<string>();
  const add = (c: CardView | null) => {
    if (!c) return;
    if (c.hidden) hidden.add(c.instanceId);
    else visible.set(c.instanceId, c.definitionId);
  };
  for (const p of view.players) {
    [...p.hand, ...p.graveyard, ...p.banished].forEach(add);
    [...p.board.monsterZones, ...p.board.spellTrapZones, p.board.fieldZone].forEach(add);
  }
  return { visible, hidden };
}

/** Every (instanceId, definitionId) an event view reveals, plus the ids it shows as hidden cards. */
function revealed(events: readonly EventView[]) {
  const pairs: { instanceId: string; definitionId: string }[] = [];
  const hiddenIds: string[] = [];
  for (const e of events) {
    if (e.type === 'CardDrawn') {
      if (e.card.hidden) hiddenIds.push(e.card.instanceId);
      else pairs.push({ instanceId: e.card.instanceId, definitionId: e.card.definitionId });
      continue;
    }
    const flat = e as { instanceId?: string; definitionId?: string };
    if (flat.instanceId !== undefined && flat.definitionId !== undefined) {
      pairs.push({ instanceId: flat.instanceId, definitionId: flat.definitionId });
    }
  }
  return { pairs, hiddenIds };
}

/**
 * Cross-check: after an accepted action, nothing in a viewer's events may contradict what that viewer's
 * StateView shows: revealed cards must be visible there, hidden ones must still be hidden there.
 */
async function assertConsistent(ctx: Ctx, result: SubmitActionResult): Promise<void> {
  for (const viewer of [0, 1] as const) {
    const { visible, hidden } = cardsIn(await ctx.manager.getView(ctx.duelId, viewer));
    const { pairs, hiddenIds } = revealed(result.eventsByViewer[viewer]);
    for (const p of pairs)
      expect(visible.get(p.instanceId), `viewer ${viewer} ${p.instanceId}`).toBe(p.definitionId);
    for (const id of hiddenIds) {
      expect(hidden.has(id), `viewer ${viewer} hidden ${id}`).toBe(true);
      expect(visible.has(id)).toBe(false);
    }
  }
}

async function act(ctx: Ctx, actor: 0 | 1, action: Action, log: SubmitActionResult[]) {
  const result = await ctx.manager.submitAction(ctx.duelId, actor, action);
  await assertConsistent(ctx, result);
  log.push(result);
  return result;
}

const typesOf = (log: SubmitActionResult[], viewer: 0 | 1) =>
  new Set(log.flatMap((r) => r.eventsByViewer[viewer].map((e) => e.type)));
const jsonOf = (log: SubmitActionResult[], viewer: 0 | 1) =>
  JSON.stringify(log.map((r) => r.eventsByViewer[viewer]));

describe('submitAction result shape', () => {
  it('exposes only filtered events: view, events (sender) and eventsByViewer', async () => {
    const ctx = await setup();
    const result = await ctx.manager.submitAction(ctx.duelId, 0, endPhase(0));
    expect(Object.keys(result).sort()).toEqual([
      'aiActions',
      'events',
      'eventsByViewer',
      'legalActions',
      'view',
    ]);
    expect(result.events).toBe(result.eventsByViewer[0]);
    expect(result.eventsByViewer[0].map((e) => e.type)).toEqual(['PhaseChanged']);
    expect(result.eventsByViewer[1]).toEqual(result.eventsByViewer[0]);
  });
});

describe('event views never contradict the state view', () => {
  it('opening turns: draw, summon, set, phases and turn change', async () => {
    const ctx = await setup();
    // Secrets that only their owner may ever learn about.
    await patch(ctx, (s) => {
      const [p0, p1] = s.players;
      return {
        ...s,
        players: [
          p0,
          {
            ...p1,
            hand: [inst('p1-secret-hand', 'TST-SECRET-HAND', 1, null), ...p1.hand.slice(1)],
            deck: [inst('p1-secret-draw', 'TST-SECRET-DRAW', 1, null), ...p1.deck.slice(1)],
          },
        ],
      };
    });
    const log: SubmitActionResult[] = [];
    await act(ctx, 0, endPhase(0), log);
    await act(ctx, 0, endPhase(0), log);
    const hand0 = (await ctx.manager.getDuel(ctx.duelId)).state.players[0].hand[0]!;
    await act(
      ctx,
      0,
      {
        type: 'NormalSummon',
        payload: { playerIndex: 0, cardInstanceId: hand0.instanceId, zoneIndex: 0 },
      },
      log,
    );
    for (let i = 0; i < 4; i++) await act(ctx, 0, endPhase(0), log);
    await act(ctx, 1, endPhase(1), log); // Draw phase -> draws the secret card
    await act(ctx, 1, endPhase(1), log);
    const hand1 = (await ctx.manager.getDuel(ctx.duelId)).state.players[1].hand[1]!;
    await act(
      ctx,
      1,
      {
        type: 'SetMonster',
        payload: { playerIndex: 1, cardInstanceId: hand1.instanceId, zoneIndex: 0 },
      },
      log,
    );

    for (const t of ['CardDrawn', 'NormalSummoned', 'MonsterSet', 'PhaseChanged', 'TurnChanged']) {
      expect(typesOf(log, 0).has(t as EventView['type']), t).toBe(true);
    }
    // Player 0 never learns the secrets; player 1 sees their own draw.
    expect(jsonOf(log, 0)).not.toContain('TST-SECRET-DRAW');
    expect(jsonOf(log, 0)).not.toContain('TST-SECRET-HAND');
    expect(jsonOf(log, 1)).toContain('TST-SECRET-DRAW');
  });

  it('battle: attacking a face-down monster flips it and reveals it to both', async () => {
    const ctx = await setup();
    await patch(ctx, (s) => {
      const [p0, p1] = s.players;
      return {
        ...s,
        turnCount: 3,
        phase: 'Battle',
        players: [
          {
            ...p0,
            board: {
              ...p0.board,
              monsterZones: [inst('a1', 'TST-A', 0, 'Attack'), null, null, null, null],
            },
          },
          {
            ...p1,
            board: {
              ...p1.board,
              monsterZones: [
                inst('b1', 'TST-SECRET-MON', 1, 'DefenseDown'),
                null,
                null,
                null,
                null,
              ],
            },
          },
        ],
      };
    });
    const log: SubmitActionResult[] = [];
    await act(
      ctx,
      0,
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'a1', targetInstanceId: 'b1' },
      },
      log,
    );
    expect([...typesOf(log, 0)]).toEqual(
      expect.arrayContaining(['AttackDeclared', 'MonsterFlipped', 'MonsterDestroyed']),
    );
    expect(jsonOf(log, 0)).toContain('TST-SECRET-MON');
  });

  it('battle: lethal direct attack ends the duel', async () => {
    const ctx = await setup();
    await patch(ctx, (s) => {
      const [p0, p1] = s.players;
      return {
        ...s,
        turnCount: 3,
        phase: 'Battle',
        players: [
          {
            ...p0,
            board: {
              ...p0.board,
              monsterZones: [inst('a1', 'TST-A', 0, 'Attack'), null, null, null, null],
            },
          },
          {
            ...p1,
            lifePoints: 100,
            board: { ...p1.board, monsterZones: [null, null, null, null, null] },
          },
        ],
      };
    });
    const log: SubmitActionResult[] = [];
    await act(
      ctx,
      0,
      { type: 'DeclareAttack', payload: { playerIndex: 0, attackerInstanceId: 'a1' } },
      log,
    );
    expect([...typesOf(log, 1)]).toEqual(expect.arrayContaining(['DamageDealt', 'DuelEnded']));
  });

  it('tribute of a face-down monster, position change and hand-limit discard', async () => {
    const ctx = await setup();
    await patch(ctx, (s) => {
      const [p0, p1] = s.players;
      return {
        ...s,
        phase: 'Main1',
        players: [
          {
            ...p0,
            hand: [inst('hi', 'TST-HI', 0, null), ...p0.hand.slice(1)],
            board: {
              ...p0.board,
              monsterZones: [
                inst('t1', 'TST-SECRET-MON', 0, 'DefenseDown'),
                inst('t2', 'TST-A', 0, 'Attack'),
                null,
                null,
                null,
              ],
            },
          },
          p1,
        ],
      };
    });
    const log: SubmitActionResult[] = [];
    await act(
      ctx,
      0,
      {
        type: 'NormalSummon',
        payload: { playerIndex: 0, cardInstanceId: 'hi', zoneIndex: 2, tributeInstanceIds: ['t1'] },
      },
      log,
    );
    await act(
      ctx,
      0,
      {
        type: 'ChangePosition',
        payload: { playerIndex: 0, cardInstanceId: 't2', toPosition: 'DefenseUp' },
      },
      log,
    );
    await patch(ctx, (s) => {
      const [p0, p1] = s.players;
      const extra = [0, 1, 2].map((i) => inst(`x${i}`, 'TST-A', 0, null));
      return { ...s, phase: 'Main2', players: [{ ...p0, hand: [...p0.hand, ...extra] }, p1] };
    });
    await act(ctx, 0, endPhase(0), log); // opens the DiscardToHandLimit prompt
    const state = (await ctx.manager.getDuel(ctx.duelId)).state;
    const prompt = state.pendingPrompt!;
    const count = (prompt.payload as { count: number }).count;
    await act(
      ctx,
      0,
      {
        type: 'ResolvePendingPrompt',
        payload: {
          playerIndex: 0,
          promptId: prompt.promptId,
          cardInstanceIds: state.players[0].hand.slice(0, count).map((c) => c.instanceId),
        },
      },
      log,
    );
    expect([...typesOf(log, 1)]).toEqual(
      expect.arrayContaining([
        'MonsterTributed',
        'NormalSummoned',
        'PositionChanged',
        'CardDiscarded',
      ]),
    );
  });
});
