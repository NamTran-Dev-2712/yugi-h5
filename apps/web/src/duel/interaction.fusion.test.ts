import type { PlayerAction, StateView, ViewResponse } from '@yugi/shared';
import { describe, expect, it, vi } from 'vitest';
import type { DuelApi } from '../api/duel-api';
import { describeAiAction } from '../debug/describe-ai-action';
import { setLang } from '../i18n/i18n';
import { createDuelController } from './duel-controller';
import { loadFixture } from './fixtures';
import { canConfirm, overlayFor, reduce, type InteractionState } from './interaction';
import {
  centre,
  click,
  feed,
  fixtureCtx,
  layout,
  lookup,
  makeCtx,
  sends,
  start,
  toasts,
  type Run,
} from './interaction.harness';
import { PICKER_LABEL_H, pickerPanel, pickerSlots } from './layout';
import { pickerCards, present } from './presenter';
import { strings } from './strings';

/*
 * Task 4.5b — the two Fusion prompts on the duel screen: "Chọn mục tiêu dung hợp" (+ "Chọn") then "Chọn N nguyên liệu
 * dung hợp" (+ "Đồng ý", a source label under each material). The selection is made over the candidates of the prompt
 * payload and the answer is built from them — not looked up in legalActions (the engine caps its list at 200
 * combinations). No rule lives in the client: it never checks which materials make which monster.
 */

const CONFIRM = centre(layout.overlay.confirm);
const CANCEL = centre(layout.overlay.cancel);

/** The machine after the view arrived (a prompt for me opens its selection). */
const opened = (ctx: ReturnType<typeof fixtureCtx>): Run =>
  feed(start(), { type: 'viewChanged' }, ctx);

const slot = (run: Run, ctx: ReturnType<typeof fixtureCtx>, id: string) => {
  const found = overlayFor(run.state, ctx).picker.find((p) => p.id === id);
  if (!found) throw new Error(`no picker slot for ${id}`);
  return centre(found.rect);
};

const selecting = (state: InteractionState) => {
  if (state.kind !== 'selecting-tribute') throw new Error(`state is ${state.kind}`);
  return state;
};

describe('SelectFusionMonster — "Chọn mục tiêu dung hợp"', () => {
  const ctx = fixtureCtx('fusion-monster');

  it('opens a selection over the candidates of the payload: one to choose, no Cancel, button off', () => {
    const run = opened(ctx);
    const s = selecting(run.state);
    expect(s.purpose).toBe('fusion-monster');
    expect(s.candidates).toEqual(['p0-x0', 'p0-x2']);
    expect(s.count).toBe(1);
    expect(s.actions).toEqual([]);
    const o = overlayFor(run.state, ctx);
    expect(o.confirm).toEqual({
      enabled: false,
      showCancel: false,
      purpose: 'fusion-monster',
      count: 1,
    });
    expect(canConfirm(run.state)).toBe(false);
  });

  it('every candidate is in the picker row (Extra Deck cards are not on the board), without a source label', () => {
    const run = opened(ctx);
    const o = overlayFor(run.state, ctx);
    expect(o.picker.map((p) => p.id)).toEqual(['p0-x0', 'p0-x2']);
    for (const p of o.picker) expect('source' in p).toBe(false);
    const cards = pickerCards(ctx.view, o.picker, lookup);
    expect(cards.map((c) => c.id)).toEqual(['p0-x0', 'p0-x2']);
    expect(cards.every((c) => !c.faceDown && c.label !== null)).toBe(true);
    // SMP-046 is in my Extra Deck but the server did not offer it: it is not drawn.
    expect(JSON.stringify(cards)).not.toContain('p0-x1');
  });

  it('a tap chooses, a tap on the other one REPLACES the choice, a tap on the chosen one clears it', () => {
    let run = opened(ctx);
    run = click(run, slot(run, ctx, 'p0-x0'), ctx);
    expect(selecting(run.state).selected).toEqual(['p0-x0']);
    expect(canConfirm(run.state)).toBe(true);
    run = click(run, slot(run, ctx, 'p0-x2'), ctx);
    expect(selecting(run.state).selected).toEqual(['p0-x2']);
    run = click(run, slot(run, ctx, 'p0-x2'), ctx);
    expect(selecting(run.state).selected).toEqual([]);
    expect(canConfirm(run.state)).toBe(false);
  });

  it('"Chọn" sends ResolvePendingPrompt with the chosen monster', () => {
    let run = opened(ctx);
    run = click(run, CONFIRM, ctx);
    expect(sends(run)).toEqual([]); // nothing chosen yet: the button does nothing
    run = click(run, slot(run, ctx, 'p0-x2'), ctx);
    run = click(run, CONFIRM, ctx);
    expect(sends(run)).toEqual([
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'fusion-5-31', cardInstanceIds: ['p0-x2'] },
      },
    ]);
    expect(run.state.kind).toBe('pending-server');
  });

  it('cannot be cancelled: Esc and a press where Cancel would be keep the selection open', () => {
    let run = opened(ctx);
    run = click(run, slot(run, ctx, 'p0-x0'), ctx);
    run = feed(run, { type: 'cancel' }, ctx);
    expect(selecting(run.state).selected).toEqual(['p0-x0']);
    run = click(run, CANCEL, ctx);
    expect(selecting(run.state).selected).toEqual(['p0-x0']);
    expect(sends(run)).toEqual([]);
  });

  it('a tap on the board (my hand, my monsters) chooses nothing: the choice is made in the row', () => {
    let run = opened(ctx);
    for (const id of ['p0-1', 'p0-10']) {
      const card = ctx.model.cards.find((c) => c.id === id)!;
      run = click(run, centre(card.rect), ctx);
    }
    expect(selecting(run.state).selected).toEqual([]);
  });
});

describe('SelectFusionMaterials — "Chọn N nguyên liệu dung hợp"', () => {
  const ctx = fixtureCtx('fusion-material');

  it('opens over the candidates of the payload, each with the label of where it is', () => {
    const run = opened(ctx);
    const s = selecting(run.state);
    expect(s.purpose).toBe('fusion-material');
    expect(s.count).toBe(2);
    const o = overlayFor(run.state, ctx);
    expect(o.picker.map((p) => [p.id, p.source])).toEqual([
      ['p0-1', 'hand'],
      ['p0-2', 'hand'],
      ['p0-11', 'field'],
    ]);
    expect(o.confirm).toMatchObject({ enabled: false, purpose: 'fusion-material', count: 2 });
  });

  it('the row draws my own cards face-up — the face-down material on my field too — and nothing of the opponent', () => {
    const run = opened(ctx);
    const cards = pickerCards(ctx.view, overlayFor(run.state, ctx).picker, lookup);
    expect(cards.map((c) => c.id)).toEqual(['p0-1', 'p0-2', 'p0-11']);
    expect(cards.every((c) => !c.faceDown && !c.defense && c.label !== null)).toBe(true);
    // A forged slot pointing at an opponent card / a hidden hand card / an unknown id draws nothing.
    const rect = pickerSlots(1)[0]!;
    for (const id of ['p1-12', 'p1-h1', 'nope']) {
      expect(pickerCards(ctx.view, [{ id, rect }], lookup)).toEqual([]);
    }
  });

  it('a tap on the REAL card (my hand, my field) chooses nothing, even for a candidate: the choice is made in the row', () => {
    // Added after the mutation run: the same test on the monster prompt only tapped cards that were no candidates.
    let run = opened(ctx);
    for (const id of ['p0-1', 'p0-2', 'p0-11']) {
      expect(selecting(run.state).candidates).toContain(id);
      const card = ctx.model.cards.find((c) => c.id === id)!;
      run = click(run, centre(card.rect), ctx);
    }
    expect(selecting(run.state).selected).toEqual([]);
    // The very same cards are chosen through their slot in the row.
    run = click(run, slot(run, ctx, 'p0-1'), ctx);
    expect(selecting(run.state).selected).toEqual(['p0-1']);
  });

  it('"Đồng ý" lights up only with exactly `count` cards chosen', () => {
    let run = opened(ctx);
    expect(overlayFor(run.state, ctx).confirm?.enabled).toBe(false);
    run = click(run, slot(run, ctx, 'p0-1'), ctx);
    expect(overlayFor(run.state, ctx).confirm?.enabled).toBe(false);
    run = click(run, slot(run, ctx, 'p0-11'), ctx);
    expect(overlayFor(run.state, ctx).confirm?.enabled).toBe(true);
    run = click(run, slot(run, ctx, 'p0-2'), ctx);
    expect(selecting(run.state).selected).toEqual(['p0-1', 'p0-11', 'p0-2']);
    expect(overlayFor(run.state, ctx).confirm?.enabled).toBe(false); // one too many
    run = click(run, CONFIRM, ctx);
    expect(sends(run)).toEqual([]);
    run = click(run, slot(run, ctx, 'p0-11'), ctx);
    expect(overlayFor(run.state, ctx).confirm?.enabled).toBe(true);
  });

  it('sends the chosen materials in the order they were chosen', () => {
    let run = opened(ctx);
    run = click(run, slot(run, ctx, 'p0-11'), ctx);
    run = click(run, slot(run, ctx, 'p0-1'), ctx);
    run = click(run, CONFIRM, ctx);
    expect(sends(run)).toEqual([
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'fusion-5-32', cardInstanceIds: ['p0-11', 'p0-1'] },
      },
    ]);
  });

  it('does NOT depend on legalActions: with no answer listed at all, the same choice is still sent', () => {
    const f = loadFixture('fusion-material');
    const bare = makeCtx(
      f.view,
      f.legalActions.filter((a) => a.type !== 'ResolvePendingPrompt'),
    );
    let run = opened(bare);
    expect(selecting(run.state).candidates).toEqual(['p0-1', 'p0-2', 'p0-11']);
    run = click(run, slot(run, bare, 'p0-2'), bare);
    run = click(run, slot(run, bare, 'p0-11'), bare);
    run = click(run, CONFIRM, bare);
    expect(sends(run)).toHaveLength(1);
    expect(toasts(run)).toEqual([]);
  });

  it('no rule in the client: a pair the server would refuse is sent as chosen; the refusal re-opens the selection', () => {
    // Two copies of the same material: the engine refuses it, the client does not know why.
    let run = opened(ctx);
    run = click(run, slot(run, ctx, 'p0-2'), ctx);
    run = click(run, slot(run, ctx, 'p0-11'), ctx);
    run = click(run, CONFIRM, ctx);
    expect(sends(run).at(-1)).toMatchObject({ payload: { cardInstanceIds: ['p0-2', 'p0-11'] } });
    run = feed(run, { type: 'serverRejected', message: 'Mục tiêu không hợp lệ.' }, ctx);
    expect(toasts(run)).toEqual(['Mục tiêu không hợp lệ.']);
    const s = selecting(run.state);
    expect(s.purpose).toBe('fusion-material');
    expect(s.selected).toEqual([]);
  });

  it('a malformed payload opens nothing (the machine stays idle, nothing can be sent)', () => {
    const f = loadFixture('fusion-material');
    const broken: StateView = {
      ...f.view,
      pendingPrompt: { ...f.view.pendingPrompt!, payload: null },
    };
    const ctx2 = makeCtx(broken, f.legalActions);
    const run = opened(ctx2);
    expect(run.state.kind).toBe('idle');
  });

  it('input is dead while the controller is busy', () => {
    const busy = fixtureCtx('fusion-material', true);
    const run0 = opened(fixtureCtx('fusion-material'));
    const t = reduce(run0.state, { type: 'pointerDown', point: slot(run0, ctx, 'p0-1') }, busy);
    expect(t.state).toBe(run0.state);
  });
});

describe('presenter + layout for the Fusion prompts', () => {
  it('the prompt line says what is asked ("Chọn mục tiêu dung hợp" / "Chọn 2 nguyên liệu dung hợp")', () => {
    const m = loadFixture('fusion-monster');
    const mat = loadFixture('fusion-material');
    expect(present(m.view, m.legalActions, { lookup, layout }).prompt?.text).toBe(
      'Chọn mục tiêu dung hợp',
    );
    expect(present(mat.view, mat.legalActions, { lookup, layout }).prompt?.text).toBe(
      'Chọn 2 nguyên liệu dung hợp',
    );
  });

  it('the Extra Deck piles show the count the server sent: mine 3, the opponent’s 5 (never its cards)', () => {
    const f = loadFixture('fusion-monster');
    const model = present(f.view, f.legalActions, { lookup, layout });
    const pile = (side: 'self' | 'opp') =>
      model.piles.find((p) => p.kind === 'extraDeck' && p.side === side)!.count;
    expect(pile('self')).toBe(3);
    expect(pile('opp')).toBe(5);
    // My Extra Deck cards are not on the board, and nothing in the model names an opponent Extra Deck card.
    expect(model.cards.some((c) => c.id.startsWith('p0-x'))).toBe(false);
    expect(JSON.stringify(model)).not.toContain('p1-x');
  });

  it('a labelled picker row sits one label line higher and its panel still ends above the turn / phase line', () => {
    const plain = pickerSlots(3);
    const labelled = pickerSlots(3, true);
    expect(labelled.map((r) => r.x)).toEqual(plain.map((r) => r.x));
    for (const [i, r] of labelled.entries()) expect(r.y).toBe(plain[i]!.y - PICKER_LABEL_H);
    for (const n of [1, 2, 3, 6]) {
      const panel = pickerPanel(n, true)!;
      const slots = pickerSlots(n, true);
      const bottom = Math.max(...slots.map((r) => r.y + r.h)) + PICKER_LABEL_H;
      expect(panel.y + panel.h).toBeGreaterThanOrEqual(bottom);
      expect(panel.y + panel.h).toBeLessThanOrEqual(layout.phaseLine.y);
      expect(panel.y).toBeGreaterThanOrEqual(0);
      // Wide enough for the title even over a single card.
      expect(panel.w).toBeGreaterThanOrEqual(300);
    }
    expect(pickerPanel(2)).toEqual(pickerPanel(2, false)); // the graveyard picker is unchanged
  });

  it('the words of the original: "Chọn" / "Đồng ý", "Bài trên tay" / "Trên sân" (and "Bộ bài" kept ready)', () => {
    expect(strings.fusionChoose).toBe('Chọn');
    expect(strings.fusionAgree).toBe('Đồng ý');
    expect(strings.fusionSourceHand).toBe('Bài trên tay');
    expect(strings.fusionSourceField).toBe('Trên sân');
    expect(strings.fusionSourceDeck).toBe('Bộ bài');
    expect(strings.fusionMaterialTitle(3)).toBe('Chọn 3 nguyên liệu dung hợp');
    setLang('en');
    try {
      expect(strings.fusionMonsterTitle).toBe('Choose the Fusion target');
      expect(strings.fusionMaterialTitle(2)).toBe('Choose 2 fusion materials');
      expect(strings.fusionSourceHand).toBe('In hand');
    } finally {
      setLang('vi');
    }
  });
});

describe('controller.submit and the Fusion answer', () => {
  const f = loadFixture('fusion-material');

  async function started() {
    const api = {
      ensureGuest: vi.fn(async () => 't'),
      createSolo: vi.fn(async () => ({
        duelId: 'd1',
        viewer: 0 as const,
        view: f.view,
        events: [],
        // No prompt answer listed: the controller must still let the Fusion answer through.
        legalActions: f.legalActions.filter(
          (a) => a.type !== 'ResolvePendingPrompt',
        ) as PlayerAction[],
        mode: 'solo-vs-ai' as const,
        aiSeat: 1 as const,
      })),
      getView: vi.fn(),
      submitAction: vi.fn(async (): Promise<ViewResponse> => ({
        view: f.view,
        events: [],
        legalActions: [],
      })),
    };
    const c = createDuelController({ api: api as unknown as DuelApi, lookup });
    await c.start();
    return { c, api };
  }

  const answer = (ids: string[]): PlayerAction => ({
    type: 'ResolvePendingPrompt',
    payload: { playerIndex: 0, promptId: 'fusion-5-32', cardInstanceIds: ids },
  });

  it('lets an unlisted answer to the open Fusion prompt reach the server', async () => {
    const { c, api } = await started();
    expect((await c.submit(answer(['p0-2', 'p0-11']))).ok).toBe(true);
    expect(api.submitAction).toHaveBeenCalledTimes(1);
  });

  it('still refuses locally everything else that is not listed', async () => {
    const { c, api } = await started();
    for (const forged of [
      answer(['p0-1']), // wrong count
      answer(['p0-1', 'p0-3']), // not a candidate
      { ...answer(['p0-1', 'p0-2']), payload: { ...answer([]).payload, promptId: 'other' } },
      { type: 'EndPhase', payload: { playerIndex: 0 } },
    ] as PlayerAction[]) {
      expect((await c.submit(forged)).ok).toBe(false);
    }
    expect(api.submitAction).not.toHaveBeenCalled();
  });
});

describe('an AI answer to a Fusion prompt (Sandbox only) is worded from promptKind, naming no card', () => {
  const action: PlayerAction = {
    type: 'ResolvePendingPrompt',
    payload: { playerIndex: 1, promptId: 'fusion-4-9', cardInstanceIds: ['p1-12'] },
  };
  const ctx = { instanceLabel: (id: string) => `LABEL(${id})` };

  it('SelectFusionMonster / SelectFusionMaterials have their own sentences', () => {
    expect(describeAiAction(action, ctx, 'SelectFusionMonster')).toBe(
      '🤖 AI chọn quái thú Dung hợp',
    );
    expect(describeAiAction(action, ctx, 'SelectFusionMaterials')).toBe(
      '🤖 AI chọn nguyên liệu dung hợp',
    );
    for (const kind of ['SelectFusionMonster', 'SelectFusionMaterials']) {
      expect(describeAiAction(action, ctx, kind)).not.toContain('LABEL');
    }
  });
});
