import {
  SAMPLE_CARDS,
  type CardDefinition,
  type CardView,
  type EventView,
  type PlayerAction,
  type PlayerIndex,
  type PlayerView,
  type SoloMode,
  type StateView,
} from '@yugi/shared';
import type { DuelApi } from '../api/duel-api';
import {
  applyLegality,
  buildActionButtons,
  cardLabel,
  pickViewer,
  shouldContinueEndTurn,
  toAction,
  type AnnotatedButton,
  type ChosenValues,
} from './build-actions';
import {
  applyActionError,
  applyActionSuccess,
  initialDebugState,
  logLinesFor,
  type DebugState,
} from './debug-state';
import { describeAiAction } from './describe-ai-action';
import { describeEvent } from './describe-event';

/** DOM glue for the debug page. All decisions live in the pure modules next to this file. */

const CARDS = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const lookup = (id: string): CardDefinition | undefined => CARDS.get(id);

interface El {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
  onClick?: () => void;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: El = {},
  ...children: (Node | string | null)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (opts.class) el.className = opts.class;
  if (opts.text !== undefined) el.textContent = opts.text;
  for (const [k, v] of Object.entries(opts.attrs ?? {})) el.setAttribute(k, v);
  if (opts.onClick) el.addEventListener('click', opts.onClick);
  for (const c of children) if (c !== null) el.append(c);
  return el;
}

function cardText(card: CardView | null): { text: string; cls: string } {
  if (card === null) return { text: '—', cls: 'zone' };
  if (card.hidden) return { text: `? [${card.instanceId}]`, cls: 'zone hiddencard' };
  const def = lookup(card.definitionId);
  const stats = def?.kind === 'Monster' ? ` Lv${def.level} ${def.atk}/${def.def}` : '';
  return {
    text: `${def?.name ?? card.definitionId}${stats}\n${card.position ?? ''} [${card.instanceId}]`,
    cls: 'zone up',
  };
}

function instanceLabelIn(view: StateView, instanceId: string): string {
  for (const p of view.players) {
    const pool: CardView[] = [
      ...p.hand,
      ...p.graveyard,
      ...p.banished,
      ...p.board.monsterZones.filter((c): c is CardView => c !== null),
    ];
    const found = pool.find((c) => c.instanceId === instanceId);
    if (found) return cardLabel(found, lookup);
  }
  return instanceId;
}

export interface DebugPageDeps {
  readonly api: DuelApi;
  readonly root: HTMLElement;
}

export function mountDebugPage({ api, root }: DebugPageDeps): void {
  let state: DebugState = initialDebugState;
  let autoSwitch = true;
  let showRaw = false;
  let allowIllegal = false;
  let busy = false;
  let modeChoice: SoloMode = 'solo-debug';

  const describeAll = (events: readonly EventView[], view: StateView): string[] =>
    events.map((e) =>
      describeEvent(e, {
        cardName: (id) => lookup(id)?.name ?? id,
        instanceLabel: (id) => instanceLabelIn(view, id),
      }),
    );

  const describeAi = (action: PlayerAction, view: StateView): string =>
    describeAiAction(action, { instanceLabel: (id) => instanceLabelIn(view, id) });

  async function run(task: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    render();
    try {
      await task();
    } catch (err) {
      state = applyActionError(state, err);
    } finally {
      busy = false;
      render();
    }
  }

  async function fetchViewer(seat: PlayerIndex): Promise<void> {
    if (state.duelId === null) return;
    const res = await api.getView(state.duelId, seat);
    state = { ...state, view: res.view, legalActions: res.legalActions, raw: res, error: null };
  }

  async function follow(): Promise<void> {
    const view = state.view;
    // vs-ai: the viewer stays on the human seat (the AI seat is not viewable; the server answers 403).
    if (!autoSwitch || view === null || state.mode === 'solo-vs-ai') return;
    const target = pickViewer(view);
    if (target !== view.viewerIndex) await fetchViewer(target);
  }

  async function send(action: PlayerAction): Promise<void> {
    if (state.duelId === null) return;
    const res = await api.submitAction(state.duelId, action.payload.playerIndex, action);
    state = applyActionSuccess(state, res, describeAll, describeAi);
  }

  const newDuel = () =>
    run(async () => {
      const res = await api.createSolo({ viewer: 0, mode: modeChoice });
      state = {
        ...initialDebugState,
        duelId: res.duelId,
        mode: res.mode,
        aiSeat: res.aiSeat ?? null,
        view: res.view,
        legalActions: res.legalActions,
        log: logLinesFor(res, describeAll, describeAi),
        raw: res,
      };
    });

  const endTurn = (seat: PlayerIndex) =>
    run(async () => {
      const start = state.view?.turnCount;
      if (start === undefined) return;
      for (let i = 0; i < 12; i++) {
        await send({ type: 'EndPhase', payload: { playerIndex: seat } });
        if (state.view === null || !shouldContinueEndTurn(start, state.view)) break;
      }
      await follow();
    });

  function actionRow({ button, legal }: AnnotatedButton): HTMLElement {
    const getters: Array<() => [string, string | string[]]> = [];
    const inputs = h('div', { class: 'inputs' });
    for (const spec of button.inputs) {
      const box = h('div', {}, h('label', { text: spec.label }));
      if (spec.multiple) {
        const list = h('div', { class: 'checks' });
        const boxes = spec.options.map((o) => {
          const cb = h('input', { attrs: { type: 'checkbox', value: o.value } });
          list.append(h('label', {}, cb, ` ${o.label}`));
          return cb;
        });
        if (spec.options.length === 0)
          list.append(h('span', { class: 'muted', text: '(không có lá)' }));
        getters.push(() => [spec.name, boxes.filter((b) => b.checked).map((b) => b.value)]);
        box.append(list);
      } else {
        const sel = h('select');
        for (const o of spec.options)
          sel.append(h('option', { text: o.label, attrs: { value: o.value } }));
        getters.push(() => [spec.name, sel.value]);
        box.append(h('br'), sel);
      }
      inputs.append(box);
    }
    const go = h('button', {
      text: button.label,
      onClick: () => {
        const chosen: Record<string, string | string[]> = Object.fromEntries(
          getters.map((g) => g()),
        );
        if (button.type === 'EndTurn') {
          void endTurn(button.playerIndex);
          return;
        }
        void run(async () => {
          await send(toAction(button, chosen as ChosenValues));
          await follow();
        });
      },
    });
    // Not in the server's legalActions: dimmed, and only clickable when the tester turned "allow illegal" on.
    go.disabled = busy || (!legal && !allowIllegal);
    if (!legal) go.title = 'Server: không có trong legalActions (bật công tắc để thử, sẽ nhận 409)';
    return h('div', { class: legal ? 'action' : 'action illegal' }, go, inputs);
  }

  function playerPanel(view: StateView, seat: PlayerIndex): HTMLElement {
    const p: PlayerView = view.players[seat];
    const isViewer = seat === view.viewerIndex;
    const zones = h('div', { class: 'zones' });
    for (const card of p.board.monsterZones) {
      const t = cardText(card);
      zones.append(
        h('div', {
          class: t.cls,
          text: t.text,
          attrs: { style: 'white-space: pre-line' },
        }),
      );
    }
    const yard = p.graveyard.map((c) => cardLabel(c, lookup)).join(', ') || '—';
    const panel = h(
      'div',
      { class: `panel${isViewer ? ' viewer' : ''}` },
      h('h2', {
        text: `P${seat}${seat === state.aiSeat ? ' 🤖 AI' : isViewer ? ' (bạn đang xem)' : ' (đối thủ)'}${view.turnPlayerIndex === seat ? ' — đến lượt' : ''}`,
      }),
      h(
        'div',
        { class: 'stats' },
        h('span', { text: `LP ${p.lifePoints}` }),
        h('span', { text: `Deck ${p.deckCount}` }),
        h('span', { text: `Tay ${p.handCount}` }),
        h('span', { text: `Extra ${p.extraDeckCount}` }),
        h('span', { text: `Mộ ${p.graveyard.length}` }),
        h('span', { text: `Đã Normal Summon: ${p.hasNormalSummonedThisTurn ? 'rồi' : 'chưa'}` }),
      ),
      zones,
      h('div', { text: `Mộ: ${yard}`, class: 'muted' }),
    );
    if (isViewer || p.hand.some((c) => !c.hidden)) {
      panel.append(
        h('div', { text: `Tay: ${p.hand.map((c) => cardLabel(c, lookup)).join(', ') || '—'}` }),
      );
    } else {
      panel.append(h('div', { class: 'muted', text: `Tay: ${p.handCount} lá (ẩn)` }));
    }
    return panel;
  }

  function render(): void {
    const view = state.view;
    const top = h(
      'div',
      { class: 'bar' },
      Object.assign(
        h(
          'select',
          {},
          h('option', { text: 'Solo debug (tự chơi cả 2 bên)', attrs: { value: 'solo-debug' } }),
          h('option', { text: 'Đấu với AI (bạn = P0)', attrs: { value: 'solo-vs-ai' } }),
        ),
        {
          value: modeChoice,
          onchange: (e: Event) => {
            modeChoice = (e.target as HTMLSelectElement).value as SoloMode;
          },
        },
      ),
      h('button', { text: 'Tạo duel mới (guest + starter deck)', onClick: () => void newDuel() }),
      ...(view && state.mode === 'solo-debug'
        ? ([0, 1] as const).map((seat) =>
            h('button', {
              text: `Xem là P${seat}`,
              onClick: () => void run(() => fetchViewer(seat)),
              attrs: view.viewerIndex === seat ? { style: 'font-weight:bold' } : {},
            }),
          )
        : []),
      ...(state.mode === 'solo-vs-ai'
        ? [h('span', { class: 'muted', text: 'viewer khoá ở P0 (không xem được AI)' })]
        : [
            h(
              'label',
              {},
              Object.assign(h('input', { attrs: { type: 'checkbox' } }), {
                checked: autoSwitch,
                onchange: (e: Event) => {
                  autoSwitch = (e.target as HTMLInputElement).checked;
                },
              }),
              ' tự chuyển viewer theo bên có quyền',
            ),
          ]),
      h(
        'label',
        {},
        Object.assign(h('input', { attrs: { type: 'checkbox' } }), {
          checked: showRaw,
          onchange: (e: Event) => {
            showRaw = (e.target as HTMLInputElement).checked;
            render();
          },
        }),
        ' Raw JSON',
      ),
      h(
        'label',
        {},
        Object.assign(h('input', { attrs: { type: 'checkbox' } }), {
          checked: allowIllegal,
          onchange: (e: Event) => {
            allowIllegal = (e.target as HTMLInputElement).checked;
            render();
          },
        }),
        ' Cho phép thử hành động sai luật (nút mờ vẫn bấm được → xem 409)',
      ),
      h('span', { class: 'muted', text: state.duelId ? `duel ${state.duelId}` : 'chưa có duel' }),
      busy ? h('span', { text: '⏳ đang gửi…' }) : null,
    );

    const out: (Node | null)[] = [top];
    if (state.error) out.push(h('div', { class: 'error', text: state.error }));

    if (view) {
      if (view.winnerIndex !== null) {
        out.push(
          h('div', {
            class: 'winner',
            text:
              view.winnerIndex === 'draw'
                ? 'Trận kết thúc: HÒA'
                : state.aiSeat !== null
                  ? view.winnerIndex === state.aiSeat
                    ? 'Trận kết thúc: AI THẮNG 🤖'
                    : 'Trận kết thúc: BẠN THẮNG 🎉'
                  : `Trận kết thúc: P${view.winnerIndex} THẮNG`,
          }),
        );
      }
      out.push(
        h('div', {
          class: 'panel stats',
          text: `Lượt ${view.turnCount} · lượt của P${view.turnPlayerIndex} · phase ${view.phase} · version ${view.version}${
            view.pendingPrompt
              ? ` · PROMPT ${view.pendingPrompt.kind} cho P${view.pendingPrompt.playerIndex}: ${JSON.stringify(view.pendingPrompt.payload)}`
              : ''
          }`,
        }),
      );
      const opp = (1 - view.viewerIndex) as PlayerIndex;
      out.push(playerPanel(view, opp), playerPanel(view, view.viewerIndex));
      const actions = h(
        'div',
        { class: 'panel' },
        h('h2', {
          text:
            state.aiSeat !== null
              ? `Hành động của bạn (P${view.viewerIndex})`
              : `Hành động của P${view.viewerIndex}`,
        }),
      );
      // Narrow the choice lists only while illegal attempts are off; otherwise the tester may pick anything.
      const buttons = applyLegality(
        buildActionButtons(view, lookup),
        state.legalActions,
        !allowIllegal,
      );
      if (buttons.length === 0)
        actions.append(h('div', { class: 'muted', text: '(không có — trận đã kết thúc)' }));
      for (const b of buttons) actions.append(actionRow(b));
      out.push(actions);
    }

    const log = h('div', { class: 'log' });
    for (const line of state.log)
      log.append(h('div', { class: line.startsWith('✗') ? 'err' : '', text: line }));
    out.push(
      h(
        'div',
        { class: 'panel' },
        h('h2', { text: 'Nhật ký event (từ góc nhìn người gửi action)' }),
        log,
      ),
    );
    if (showRaw) {
      out.push(
        h(
          'div',
          { class: 'panel' },
          h('h2', { text: 'Raw JSON — phản hồi thành công gần nhất' }),
          h('pre', { text: JSON.stringify(state.raw, null, 2) }),
        ),
      );
    }
    root.replaceChildren(...out.filter((n): n is Node => n !== null));
    log.scrollTop = log.scrollHeight;
  }

  render();
}
