import type { PlayerAction, StateView } from '@yugi/shared';
import {
  attackers,
  attackTargets,
  draggableHandCards,
  isListed,
  positionOptions,
  promptAnswers,
  summonOptions,
  type ZoneOption,
} from './legal-index';
import {
  hitTest,
  optionRects,
  pointInRect,
  zoneIndexAt,
  type BoardLayout,
  type Point,
  type Rect,
} from './layout';
import type { RenderModel } from './presenter';
import { strings } from './strings';

/**
 * The interaction state machine of the duel screen: pointer events in, "send this action" / "show this toast" out.
 * Pure (no Phaser, no I/O, no clock). It contains NO game rules: what can be dragged, where it can be dropped, what
 * can be attacked and what a choice sends are all read from `legalActions`, and the only actions it ever emits are
 * elements of that list (`emit` re-checks). The board is never changed here: it changes only when the server answers
 * (no optimistic update), so a refusal just returns the machine to `idle`.
 */

export type InteractionState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'dragging-card';
      readonly cardId: string;
      /** False for a hand card the server lists no Summon/Set for: it does not follow the pointer. */
      readonly draggable: boolean;
      readonly origin: Point;
      readonly pointer: Point;
      readonly moved: boolean;
    }
  | {
      readonly kind: 'dragging-attack';
      readonly attackerId: string;
      readonly origin: Point;
      readonly pointer: Point;
      readonly moved: boolean;
    }
  | {
      readonly kind: 'choosing-option';
      readonly anchor: Point;
      readonly options: readonly {
        readonly label: string;
        readonly actions: readonly PlayerAction[];
      }[];
    }
  | {
      /** Tributes for a Summon/Set, or the cards of a multi-card discard (`purpose`). */
      readonly kind: 'selecting-tribute';
      readonly purpose: 'tribute' | 'discard';
      /** Listed actions this selection can end in; Confirm sends the one whose card set equals `selected`. */
      readonly actions: readonly PlayerAction[];
      readonly candidates: readonly string[];
      readonly selected: readonly string[];
    }
  | { readonly kind: 'pending-server' };

export type InteractionEvent =
  | { readonly type: 'pointerDown'; readonly point: Point }
  | { readonly type: 'pointerMove'; readonly point: Point }
  | { readonly type: 'pointerUp'; readonly point: Point }
  | { readonly type: 'cancel' }
  | { readonly type: 'serverOk' }
  | { readonly type: 'serverRejected'; readonly message: string }
  /** The controller got a new view/legalActions. */
  | { readonly type: 'viewChanged' };

export type InteractionEffect =
  | { readonly type: 'send'; readonly action: PlayerAction }
  | { readonly type: 'toast'; readonly text: string };

export interface InteractionContext {
  readonly view: StateView;
  readonly legalActions: readonly PlayerAction[];
  readonly model: RenderModel;
  readonly layout: BoardLayout;
  /** A request is in flight elsewhere (controller busy, e.g. the AI is playing): input is ignored. */
  readonly busy: boolean;
}

export interface Transition {
  readonly state: InteractionState;
  readonly effects: readonly InteractionEffect[];
}

export const initialInteraction: InteractionState = { kind: 'idle' };

/** A press that moves less than this (logical px) is a click, not a drag. */
export const DRAG_THRESHOLD = 8;

const IDLE: InteractionState = { kind: 'idle' };
const toast = (text: string): InteractionEffect => ({ type: 'toast', text });
const stay = (state: InteractionState): Transition => ({ state, effects: [] });
const toIdle = (...effects: InteractionEffect[]): Transition => ({ state: IDLE, effects });

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** The one place a request is produced: it must be in the list the server sent. */
function emit(action: PlayerAction, ctx: InteractionContext): Transition {
  if (!isListed(ctx.legalActions, action)) return toIdle(toast(strings.toastNotAllowed));
  return { state: { kind: 'pending-server' }, effects: [{ type: 'send', action }] };
}

/** Card ids an action asks the person to choose (tributes, or the cards to discard). */
function chosenIds(action: PlayerAction): readonly string[] {
  if (action.type === 'ResolvePendingPrompt') return action.payload.cardInstanceIds;
  if (action.type === 'NormalSummon' || action.type === 'SetMonster') {
    return action.payload.tributeInstanceIds ?? [];
  }
  return [];
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));

function matchingAction(
  state: Extract<InteractionState, { kind: 'selecting-tribute' }>,
): PlayerAction | undefined {
  return state.actions.find((a) => sameSet(chosenIds(a), state.selected));
}

/** True when the tribute/discard selection matches exactly one listed action. */
export function canConfirm(state: InteractionState): boolean {
  return state.kind === 'selecting-tribute' && matchingAction(state) !== undefined;
}

/** A group of listed actions the person just picked (e.g. all "Summon" actions for one zone). */
function resolveGroup(actions: readonly PlayerAction[], ctx: InteractionContext): Transition {
  const direct = actions.find((a) => chosenIds(a).length === 0);
  if (direct) return emit(direct, ctx);
  if (actions.length === 0) return toIdle(toast(strings.toastNotAllowed));
  const candidates = [...new Set(actions.flatMap((a) => chosenIds(a)))];
  return {
    state: { kind: 'selecting-tribute', purpose: 'tribute', actions, candidates, selected: [] },
    effects: [],
  };
}

function dropCard(
  option: ZoneOption | undefined,
  point: Point,
  ctx: InteractionContext,
): Transition {
  if (!option) return toIdle(toast(strings.toastNoZone));
  const groups = [
    { label: strings.summonOption, actions: option.normal },
    { label: strings.setOption, actions: option.set },
  ].filter((g) => g.actions.length > 0);
  if (groups.length === 0) return toIdle(toast(strings.toastNoZone));
  if (groups.length === 1) return resolveGroup(groups[0]!.actions, ctx);
  return { state: { kind: 'choosing-option', anchor: point, options: groups }, effects: [] };
}

/** After returning to idle: a multi-card discard prompt opens its own selection (a one-card one is a plain click). */
function settle(ctx: InteractionContext, effects: InteractionEffect[]): Transition {
  const prompt = ctx.view.pendingPrompt;
  if (
    prompt &&
    prompt.playerIndex === ctx.view.viewerIndex &&
    prompt.kind === 'DiscardToHandLimit' &&
    ctx.view.winnerIndex === null
  ) {
    const answers = promptAnswers(ctx.legalActions, ctx.view.viewerIndex, prompt.promptId);
    if (answers.length > 0 && answers.every((a) => a.payload.cardInstanceIds.length > 1)) {
      return {
        state: {
          kind: 'selecting-tribute',
          purpose: 'discard',
          actions: answers,
          candidates: [...new Set(answers.flatMap((a) => a.payload.cardInstanceIds))],
          selected: [],
        },
        effects,
      };
    }
  }
  return { state: IDLE, effects };
}

function onDown(point: Point, ctx: InteractionContext): Transition {
  const hit = hitTest(ctx.layout, ctx.model, point);
  if (hit.kind !== 'card') return stay(IDLE);
  const card = ctx.model.cards.find((c) => c.id === hit.id);
  if (!card || card.side !== 'self') return stay(IDLE);
  const viewer = ctx.view.viewerIndex;
  if (card.zone === 'hand') {
    return {
      state: {
        kind: 'dragging-card',
        cardId: card.id,
        draggable: draggableHandCards(ctx.legalActions, viewer).includes(card.id),
        origin: point,
        pointer: point,
        moved: false,
      },
      effects: [],
    };
  }
  if (
    card.zone === 'monster' &&
    (attackers(ctx.legalActions, viewer).includes(card.id) ||
      positionOptions(ctx.legalActions, viewer, card.id).length > 0)
  ) {
    return {
      state: {
        kind: 'dragging-attack',
        attackerId: card.id,
        origin: point,
        pointer: point,
        moved: false,
      },
      effects: [],
    };
  }
  return stay(IDLE);
}

function onMove(
  state: Extract<InteractionState, { kind: 'dragging-card' | 'dragging-attack' }>,
  point: Point,
): Transition {
  return stay({
    ...state,
    pointer: point,
    moved: state.moved || dist(state.origin, point) >= DRAG_THRESHOLD,
  });
}

function onUpDraggingCard(
  state: Extract<InteractionState, { kind: 'dragging-card' }>,
  point: Point,
  ctx: InteractionContext,
): Transition {
  if (!state.moved) {
    // A click: only a hand card the server turned into a one-click answer (discard) does anything.
    const card = ctx.model.cards.find((c) => c.id === state.cardId);
    return card?.action ? emit(card.action, ctx) : stay(IDLE);
  }
  if (!state.draggable) return toIdle(toast(strings.toastCardLocked));
  const zone = zoneIndexAt(ctx.layout, 'self', point);
  const option =
    zone === null
      ? undefined
      : summonOptions(ctx.legalActions, ctx.view.viewerIndex, state.cardId).find(
          (o) => o.zoneIndex === zone,
        );
  return dropCard(option, point, ctx);
}

function onUpDraggingAttack(
  state: Extract<InteractionState, { kind: 'dragging-attack' }>,
  point: Point,
  ctx: InteractionContext,
): Transition {
  const viewer = ctx.view.viewerIndex;
  const canAttack = attackers(ctx.legalActions, viewer).includes(state.attackerId);
  if (!state.moved || !canAttack) {
    if (state.moved) return stay(IDLE);
    // A click: open the position menu with what the server listed.
    const options = positionOptions(ctx.legalActions, viewer, state.attackerId);
    if (options.length === 0) return stay(IDLE);
    return {
      state: {
        kind: 'choosing-option',
        anchor: point,
        options: options.map((a) => ({
          label:
            a.payload.toPosition === 'Attack' ? strings.toAttackOption : strings.toDefenseOption,
          actions: [a],
        })),
      },
      effects: [],
    };
  }
  const hit = hitTest(ctx.layout, ctx.model, point);
  const targets = attackTargets(ctx.legalActions, viewer, state.attackerId);
  let chosen: PlayerAction | undefined;
  if (hit.kind === 'card') {
    const card = ctx.model.cards.find((c) => c.id === hit.id);
    if (card && card.side === 'opp' && card.zone === 'monster') {
      chosen = targets.find((t) => t.targetInstanceId === card.id)?.action;
    }
  } else if (hit.kind === 'lp' && hit.side === 'opp') {
    chosen = targets.find((t) => t.targetInstanceId === null)?.action;
  }
  return chosen ? emit(chosen, ctx) : toIdle(toast(strings.toastBadTarget));
}

function onUpChoosing(
  state: Extract<InteractionState, { kind: 'choosing-option' }>,
  point: Point,
  ctx: InteractionContext,
): Transition {
  const rects = optionRects(state.anchor, state.options.length);
  const i = rects.findIndex((r) => pointInRect(r, point));
  return i === -1 ? stay(IDLE) : resolveGroup(state.options[i]!.actions, ctx);
}

function onUpSelecting(
  state: Extract<InteractionState, { kind: 'selecting-tribute' }>,
  point: Point,
  ctx: InteractionContext,
): Transition {
  if (pointInRect(ctx.layout.overlay.confirm, point)) {
    const action = matchingAction(state);
    return action ? emit(action, ctx) : stay(state);
  }
  if (state.purpose === 'tribute' && pointInRect(ctx.layout.overlay.cancel, point))
    return stay(IDLE);
  const hit = hitTest(ctx.layout, ctx.model, point);
  if (hit.kind === 'card' && state.candidates.includes(hit.id)) {
    const selected = state.selected.includes(hit.id)
      ? state.selected.filter((id) => id !== hit.id)
      : [...state.selected, hit.id];
    return stay({ ...state, selected });
  }
  return stay(state);
}

export function reduce(
  state: InteractionState,
  event: InteractionEvent,
  ctx: InteractionContext,
): Transition {
  switch (event.type) {
    case 'serverOk':
      return state.kind === 'pending-server' ? settle(ctx, []) : stay(state);
    case 'serverRejected':
      return state.kind === 'pending-server' ? settle(ctx, [toast(event.message)]) : stay(state);
    case 'viewChanged':
      return state.kind === 'pending-server' ? stay(state) : settle(ctx, []);
    case 'cancel':
      if (state.kind === 'pending-server') return stay(state);
      if (state.kind === 'selecting-tribute' && state.purpose === 'discard') return stay(state);
      return settle(ctx, []);
    default:
      break;
  }

  // Pointer events: dead while a request is in flight or the controller is busy.
  if (state.kind === 'pending-server' || ctx.busy) return stay(state);

  switch (event.type) {
    case 'pointerDown':
      return state.kind === 'idle' ? onDown(event.point, ctx) : stay(state);
    case 'pointerMove':
      return state.kind === 'dragging-card' || state.kind === 'dragging-attack'
        ? onMove(state, event.point)
        : stay(state);
    case 'pointerUp':
      switch (state.kind) {
        case 'dragging-card':
          return onUpDraggingCard(state, event.point, ctx);
        case 'dragging-attack':
          return onUpDraggingAttack(state, event.point, ctx);
        case 'choosing-option':
          return onUpChoosing(state, event.point, ctx);
        case 'selecting-tribute':
          return onUpSelecting(state, event.point, ctx);
        default:
          return stay(state);
      }
  }
}

// ---- What the scene draws on top of the board while a gesture is in progress ----

export interface OverlayModel {
  /** Legal drop zones while dragging a hand card. */
  readonly zones: readonly Rect[];
  /** Legal attack target cards while dragging an attack arrow. */
  readonly targets: readonly Rect[];
  /** The opponent LP area is a legal (direct attack) target. */
  readonly lpTarget: Rect | null;
  readonly candidates: readonly string[];
  readonly selected: readonly string[];
  readonly ghost: { readonly cardId: string; readonly at: Point } | null;
  readonly arrow: { readonly from: Point; readonly to: Point } | null;
  readonly menu: { readonly rects: readonly Rect[]; readonly labels: readonly string[] } | null;
  readonly confirm: { readonly enabled: boolean; readonly showCancel: boolean } | null;
}

const EMPTY_OVERLAY: OverlayModel = {
  zones: [],
  targets: [],
  lpTarget: null,
  candidates: [],
  selected: [],
  ghost: null,
  arrow: null,
  menu: null,
  confirm: null,
};

const centre = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function overlayFor(state: InteractionState, ctx: InteractionContext): OverlayModel {
  const viewer = ctx.view.viewerIndex;
  switch (state.kind) {
    case 'dragging-card': {
      if (!state.draggable || !state.moved) return EMPTY_OVERLAY;
      const zones = summonOptions(ctx.legalActions, viewer, state.cardId).map(
        (o) => ctx.layout.self.monsterZones[o.zoneIndex]!,
      );
      return { ...EMPTY_OVERLAY, zones, ghost: { cardId: state.cardId, at: state.pointer } };
    }
    case 'dragging-attack': {
      if (!state.moved || !attackers(ctx.legalActions, viewer).includes(state.attackerId)) {
        return EMPTY_OVERLAY;
      }
      const attacker = ctx.model.cards.find((c) => c.id === state.attackerId);
      const targets = attackTargets(ctx.legalActions, viewer, state.attackerId);
      const rects = targets.flatMap((t) => {
        const card = t.targetInstanceId
          ? ctx.model.cards.find((c) => c.id === t.targetInstanceId)
          : undefined;
        return card ? [card.rect] : [];
      });
      return {
        ...EMPTY_OVERLAY,
        targets: rects,
        lpTarget: targets.some((t) => t.targetInstanceId === null) ? ctx.layout.opp.lp : null,
        arrow: { from: attacker ? centre(attacker.rect) : state.origin, to: state.pointer },
      };
    }
    case 'choosing-option':
      return {
        ...EMPTY_OVERLAY,
        menu: {
          rects: optionRects(state.anchor, state.options.length),
          labels: state.options.map((o) => o.label),
        },
      };
    case 'selecting-tribute':
      return {
        ...EMPTY_OVERLAY,
        candidates: state.candidates,
        selected: state.selected,
        confirm: { enabled: canConfirm(state), showCancel: state.purpose === 'tribute' },
      };
    default:
      return EMPTY_OVERLAY;
  }
}
