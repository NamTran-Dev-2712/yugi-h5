import { describe, expect, it } from 'vitest';
import type { PlayerAction } from '@yugi/shared';
import { createDuelController } from '../duel/duel-controller';
import { createInteractionDriver, type InteractionDriver } from '../duel/interaction-driver';
import { canConfirm, type InteractionState } from '../duel/interaction';
import {
  attackers,
  attackTargets,
  draggableHandCards,
  positionOptions,
  promptAnswers,
  summonOptions,
} from '../duel/legal-index';
import { computeLayout, hitTest, type Point } from '../duel/layout';
import { cardLookup } from '../duel/services';
import { createRealApi } from './real-api';

/**
 * A whole duel against the AI, played THROUGH the UI layer without a browser: real fetch -> DuelController ->
 * interaction driver (state machine + hit-testing). Every move is a pointer gesture computed from the layout
 * rectangles (press on a card, drag onto a zone, click a menu item, click Confirm...). The policy only picks WHICH
 * legal thing to do from `legalActions`; any toast or server refusal means a UI bug and fails the test.
 */
const MAX_HUMAN_TURNS = Number(process.env.E2E_TURNS ?? 30);
const layout = computeLayout();

const centre = (r: { x: number; y: number; w: number; h: number }): Point => ({
  x: r.x + r.w / 2,
  y: r.y + r.h / 2,
});

async function press(d: InteractionDriver, p: Point): Promise<void> {
  await d.dispatch({ type: 'pointerDown', point: p });
  await d.dispatch({ type: 'pointerUp', point: p });
}

async function dragTo(d: InteractionDriver, from: Point, to: Point): Promise<void> {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  await d.dispatch({ type: 'pointerDown', point: from });
  await d.dispatch({ type: 'pointerMove', point: mid });
  await d.dispatch({ type: 'pointerMove', point: to });
  await d.dispatch({ type: 'pointerUp', point: to });
}

/** A point where `hitTest` really returns this card (hand cards overlap when the hand is full). */
function pointOn(d: InteractionDriver, id: string): Point {
  const ctx = d.getContext()!;
  const card = ctx.model.cards.find((c) => c.id === id);
  if (!card) throw new Error(`card ${id} is not on screen`);
  const r = card.rect;
  for (let x = r.x + 2; x < r.x + r.w; x += 3) {
    const p = { x, y: r.y + r.h / 2 };
    const hit = hitTest(layout, ctx.model, p);
    if (hit.kind === 'card' && hit.id === id) return p;
  }
  throw new Error(`no visible point on card ${id}`);
}

const stateKind = (d: InteractionDriver): InteractionState['kind'] => d.getState().kind;

interface Strategy {
  readonly name: string;
  /** Drag attack arrows whenever the server lists an attack. */
  readonly attack: boolean;
  /** Click own monsters (up to twice) to change position through the menu. */
  readonly positionChange: boolean;
  /** Which hand card to play (undefined = play nothing this turn, so the hand can overflow). */
  readonly pick: (
    turn: number,
    ids: string[],
    levelOf: (id: string) => number,
  ) => string | undefined;
  readonly turns: number;
}

const byLevel = (ids: string[], levelOf: (id: string) => number, dir: 1 | -1): string | undefined =>
  [...ids].sort((a, b) => dir * (levelOf(a) - levelOf(b)))[0];

type Stats = Record<
  'summon' | 'set' | 'tribute' | 'attack' | 'direct' | 'discard' | 'position' | 'phase' | 'menu',
  number
>;

async function play(strategy: Strategy): Promise<Stats> {
  const started = Date.now();
  const controller = createDuelController({ api: createRealApi(), lookup: cardLookup });
  await controller.start();
  expect(controller.getState().error).toBeNull();
  const driver = createInteractionDriver(controller, { lookup: cardLookup, layout });
  const seenToasts = new Set<number>();

  const stats = {
    summon: 0,
    set: 0,
    tribute: 0,
    attack: 0,
    direct: 0,
    discard: 0,
    position: 0,
    phase: 0,
    menu: 0,
  };
  const startTurn = controller.getState().view!.turnCount;
  let steps = 0;

  const finish = (): boolean => {
    const s = controller.getState();
    return s.view!.winnerIndex !== null || s.view!.turnCount - startTurn >= strategy.turns * 2;
  };

  while (!finish() && steps++ < 4000) {
    const s = controller.getState();
    const view = s.view!;
    const legal = s.legalActions as readonly PlayerAction[];
    const seat = view.viewerIndex;
    if (s.busy) throw new Error('controller stuck busy');
    const toast = driver.getToast();
    if (toast && !seenToasts.has(toast.seq)) {
      seenToasts.add(toast.seq);
      throw new Error(`unexpected toast: ${toast.text} (step ${steps})`);
    }

    // 1. A pending discard: answered by clicking cards (+ Confirm for several).
    if (view.pendingPrompt && view.pendingPrompt.playerIndex === seat) {
      if (stateKind(driver) === 'selecting-tribute') {
        const answer = promptAnswers(legal, seat, view.pendingPrompt.promptId)[0]!;
        for (const id of answer.payload.cardInstanceIds) await press(driver, pointOn(driver, id));
        expect(canConfirm(driver.getState())).toBe(true);
        await press(driver, centre(layout.overlay.confirm));
      } else {
        const one = driver.getContext()!.model.cards.find((c) => c.action !== null);
        if (!one) throw new Error('prompt without a clickable answer');
        await press(driver, pointOn(driver, one.id));
      }
      stats.discard++;
      expect(stateKind(driver)).toBe('idle');
      continue;
    }
    if (stateKind(driver) !== 'idle') throw new Error(`machine not idle: ${stateKind(driver)}`);

    // 2. Position change: click the monster, pick the first menu item.
    const mover =
      strategy.positionChange && stats.position < 2
        ? driver
            .getContext()!
            .model.cards.find(
              (c) =>
                c.side === 'self' &&
                c.zone === 'monster' &&
                positionOptions(legal, seat, c.id).length > 0,
            )
        : undefined;
    if (mover) {
      await press(driver, pointOn(driver, mover.id));
      expect(stateKind(driver)).toBe('choosing-option');
      await press(driver, centre(driver.getOverlay()!.menu!.rects[0]!));
      stats.position++;
      expect(controller.getState().error).toBeNull();
      expect(stateKind(driver)).toBe('idle');
      continue;
    }

    // 3. Attack: direct first, otherwise the first listed target, by dragging an arrow.
    const attacker = strategy.attack ? attackers(legal, seat)[0] : undefined;
    if (attacker) {
      const targets = attackTargets(legal, seat, attacker);
      const from = pointOn(driver, attacker);
      if (targets.some((t) => t.targetInstanceId === null)) {
        await dragTo(driver, from, centre(layout.opp.lp));
        stats.direct++;
      } else {
        const id = targets[0]!.targetInstanceId;
        const target = driver.getContext()!.model.cards.find((c) => c.id === id)!;
        await dragTo(driver, from, centre(target.rect));
      }
      stats.attack++;
      expect(controller.getState().error).toBeNull();
      continue;
    }

    // 4. Summon / Set a hand card by dragging it onto a zone the server listed.
    const levelOf = (id: string): number =>
      driver.getContext()!.model.cards.find((c) => c.id === id)?.label?.level ?? 0;
    const cardId = strategy.pick(view.turnCount, draggableHandCards(legal, seat), levelOf);
    if (cardId) {
      const opt = summonOptions(legal, seat, cardId)[0]!;
      await dragTo(
        driver,
        pointOn(driver, cardId),
        centre(layout.self.monsterZones[opt.zoneIndex]!),
      );
      if (stateKind(driver) === 'choosing-option') {
        await press(driver, centre(driver.getOverlay()!.menu!.rects[0]!));
        stats.menu++;
      }
      const st = driver.getState();
      if (st.kind === 'selecting-tribute') {
        const first = st.actions[0] as Extract<
          PlayerAction,
          { type: 'NormalSummon' | 'SetMonster' }
        >;
        for (const id of first.payload.tributeInstanceIds!)
          await press(driver, pointOn(driver, id));
        expect(canConfirm(driver.getState())).toBe(true);
        await press(driver, centre(layout.overlay.confirm));
        stats.tribute++;
      }
      expect(controller.getState().error).toBeNull();
      expect(stateKind(driver)).toBe('idle');
      if (opt.normal.length > 0) stats.summon++;
      else stats.set++;
      continue;
    }

    // 5. Nothing else to do: press "Phase tiếp theo" (a real button hit-test).
    const next = driver.getContext()!.model.buttons.find((b) => b.id === 'nextPhase')!;
    if (!next.enabled) throw new Error('no legal move and no phase button');
    await press(driver, centre(next.rect));
    stats.phase++;
    expect(controller.getState().error).toBeNull();
  }

  const end = controller.getState();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[${strategy.name}] winner ${String(end.view!.winnerIndex)}, turnCount ${startTurn} -> ${end.view!.turnCount}, ` +
      `steps ${steps}, gestures ${JSON.stringify(stats)}, log lines ${end.log.length}, ${seconds}s`,
  );
  expect(end.error).toBeNull();
  expect(stats.phase).toBeGreaterThan(3);
  expect(end.log.some((l) => l.includes('AI'))).toBe(true);
  return stats;
}

describe('a full duel through the UI layer against the real API', () => {
  it('aggressive: summons and attacks with pointer gestures only', async () => {
    const stats = await play({
      name: 'aggressive',
      attack: true,
      positionChange: false,
      pick: (_turn, ids) => ids[0],
      turns: MAX_HUMAN_TURNS,
    });
    expect(stats.summon + stats.set).toBeGreaterThan(0);
    expect(stats.attack).toBeGreaterThan(0);
  });

  it('turtle: changes position through the menu, never attacks', async () => {
    const stats = await play({
      name: 'turtle',
      attack: false,
      positionChange: true,
      pick: (turn, ids, levelOf) =>
        turn <= 5 ? byLevel(ids, levelOf, 1) : turn >= 13 ? byLevel(ids, levelOf, -1) : undefined,
      turns: 14,
    });
    expect(stats.position).toBeGreaterThan(0);
    expect(stats.attack).toBe(0);
  });

  it('hoarder: plays nothing, so the hand overflows and the discard prompt is answered by clicking', async () => {
    const stats = await play({
      name: 'hoarder',
      attack: false,
      positionChange: false,
      pick: () => undefined,
      turns: 5,
    });
    expect(stats.discard).toBeGreaterThan(0);
  });
});
