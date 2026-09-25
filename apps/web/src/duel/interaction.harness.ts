import { SAMPLE_CARDS, type PlayerAction, type StateView } from '@yugi/shared';
import { type FixtureName, loadFixture } from './fixtures';
import {
  initialInteraction,
  reduce,
  type InteractionContext,
  type InteractionEffect,
  type InteractionEvent,
  type InteractionState,
} from './interaction';
import { computeLayout, type Point, type Rect } from './layout';
import { present, type CardLookup } from './presenter';

/** Test helpers (not shipped): build a machine context from a fixture and drive it with pointer gestures. */

const byId = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));
export const lookup: CardLookup = (id) => byId.get(id);
export const layout = computeLayout();

export const centre = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function makeCtx(
  view: StateView,
  legalActions: readonly PlayerAction[],
  busy = false,
): InteractionContext {
  return {
    view,
    legalActions,
    model: present(view, legalActions, { lookup, layout }),
    layout,
    busy,
  };
}

export function fixtureCtx(name: FixtureName, busy = false): InteractionContext {
  const f = loadFixture(name);
  return makeCtx(f.view, f.legalActions, busy);
}

export function cardRect(ctx: InteractionContext, id: string): Rect {
  const c = ctx.model.cards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id} in the render model`);
  return c.rect;
}
export const selfZone = (i: number): Rect => layout.self.monsterZones[i]!;
export const oppZone = (i: number): Rect => layout.opp.monsterZones[i]!;

export interface Run {
  state: InteractionState;
  effects: InteractionEffect[];
}

export function start(): Run {
  return { state: initialInteraction, effects: [] };
}

export function feed(run: Run, event: InteractionEvent, ctx: InteractionContext): Run {
  const t = reduce(run.state, event, ctx);
  return { state: t.state, effects: [...run.effects, ...t.effects] };
}

export function feedAll(
  run: Run,
  events: readonly InteractionEvent[],
  ctx: InteractionContext,
): Run {
  return events.reduce((r, e) => feed(r, e, ctx), run);
}

export const down = (point: Point): InteractionEvent => ({ type: 'pointerDown', point });
export const move = (point: Point): InteractionEvent => ({ type: 'pointerMove', point });
export const up = (point: Point): InteractionEvent => ({ type: 'pointerUp', point });

/** Press on `from`, move away in two steps, release on `to`. */
export function dragEvents(from: Point, to: Point): InteractionEvent[] {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return [down(from), move(mid), move(to), up(to)];
}

export function drag(run: Run, from: Point, to: Point, ctx: InteractionContext): Run {
  return feedAll(run, dragEvents(from, to), ctx);
}

/** Quick press + release on the same spot. */
export function click(run: Run, at: Point, ctx: InteractionContext): Run {
  return feedAll(run, [down(at), up(at)], ctx);
}

export const sends = (run: Run): PlayerAction[] =>
  run.effects.flatMap((e) => (e.type === 'send' ? [e.action] : []));
export const toasts = (run: Run): string[] =>
  run.effects.flatMap((e) => (e.type === 'toast' ? [e.text] : []));

/** The same duel as seen from seat 1 (seats swapped, every playerIndex/ownerIndex mirrored). */
export function asViewer1(view: StateView, legal: readonly PlayerAction[]) {
  const flipCard = <T extends { ownerIndex: 0 | 1 }>(c: T): T => ({
    ...c,
    ownerIndex: c.ownerIndex === 0 ? 1 : 0,
  });
  const flipPlayer = (p: StateView['players'][0]): StateView['players'][0] => ({
    ...p,
    hand: p.hand.map(flipCard),
    graveyard: p.graveyard.map(flipCard),
    board: {
      ...p.board,
      monsterZones: p.board.monsterZones.map((c) =>
        c ? flipCard(c) : null,
      ) as unknown as typeof p.board.monsterZones,
    },
  });
  const flipped: StateView = {
    ...view,
    viewerIndex: 1,
    turnPlayerIndex: view.turnPlayerIndex === 0 ? 1 : 0,
    players: [flipPlayer(view.players[1]), flipPlayer(view.players[0])],
  };
  const legalActions = legal.map(
    (a): PlayerAction => ({ ...a, payload: { ...a.payload, playerIndex: 1 } }) as PlayerAction,
  );
  return { view: flipped, legalActions };
}
