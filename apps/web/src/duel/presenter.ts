import {
  staysOnField,
  type CardDefinition,
  type CardView,
  type EffectiveStatsView,
  type PlayerAction,
  type PlayerIndex,
  type StateView,
  type ViewCardPosition,
  type ViewPhase,
} from '@yugi/shared';
import { computeLayout, handSlots, type BoardLayout, type Rect, type Side } from './layout';
import { cardName, cardEffectText } from './card-text';
import { fusionPromptOf } from './fusion-prompt';
import { activatableSetCards, passAction } from './legal-index';
import { t } from '../i18n/i18n';
import { strings } from './strings';

/**
 * StateView (already filtered by the server for this viewer) + legalActions -> everything the scene must draw.
 * Pure: no Phaser, no I/O. It only ever sees what the server let the viewer see, and it never turns a hidden
 * card into a name: a card the viewer must not know has `label: null`, `detail: null`, no definitionId.
 */

export type CardLookup = (definitionId: string) => CardDefinition | undefined;

export type FrameKind = 'monster' | 'spell' | 'trap';
export type ZoneKind = 'hand' | 'monster' | 'spellTrap' | 'field';

export interface CardLabel {
  readonly name: string;
  readonly level: number | null;
  /** Printed ATK/DEF (card data). */
  readonly atk: number | null;
  readonly def: number | null;
  /**
   * ATK/DEF after Continuous modifiers (server `effectiveStats`), only when it differs from the printed value; null
   * otherwise (no modifier, not a face-up monster).
   */
  readonly effAtk: number | null;
  readonly effDef: number | null;
}

export interface CardDetail extends CardLabel {
  readonly kind: FrameKind;
  readonly effectText: string | null;
  readonly position: ViewCardPosition | null;
  /** Task 4.3b: a Field / Continuous Spell or Trap resting face-up on the field (see `CardRender.active`). */
  readonly active: boolean;
}

export interface CardRender {
  /** instanceId: stable across renders so the scene can reuse objects later (animation, 2.9). */
  readonly id: string;
  readonly side: Side;
  readonly zone: ZoneKind;
  readonly rect: Rect;
  readonly faceDown: boolean;
  /** Frame to draw when face up; null when face down. */
  readonly frame: FrameKind | null;
  /** Drawn sideways (Defense Position). */
  readonly defense: boolean;
  /** Text drawn on the face; null when face down. */
  readonly label: CardLabel | null;
  /** Shown in the detail panel on hover/click; null when the viewer may not know the card. */
  readonly detail: CardDetail | null;
  /** Action sent when this card is clicked (only cards the server says can be acted on); else null. */
  readonly action: PlayerAction | null;
  readonly highlight: boolean;
  /** One of my Set cards the server lists an ActivateEffect for: a tap activates it (C13, task 3.7). */
  readonly activatable: boolean;
  /** Task 4.2d: a face-up Equip card's monster (server `equippedTo`); null for every other card. */
  readonly equippedTo: string | null;
  /**
   * Task 4.3b: a Field Spell the viewer knows (card data `subType`) — it is dropped on the Field Zone, not on a
   * Spell/Trap Zone. Never true for a card the viewer may not know. What may be done with it still comes from
   * `legalActions` only.
   */
  readonly fieldCard: boolean;
  /**
   * Task 4.3b: drawn with the "in force" mark — a card that stays on the field (card data: Field / Continuous Spell,
   * Continuous Trap), face-up in a Spell/Trap Zone or the Field Zone. It follows the server: the engine applies the
   * Continuous effect as soon as the card is face-up, so the mark is on while its activation link still waits too.
   */
  readonly active: boolean;
}

export interface PileRender {
  readonly kind: 'deck' | 'graveyard' | 'extraDeck';
  readonly side: Side;
  readonly rect: Rect;
  readonly count: number;
  readonly caption: string;
}

/** `pass` ("Bỏ qua", PassPriority) takes the spot of `nextPhase` while the server lists it (task 3.7). */
export type ButtonId = 'nextPhase' | 'pass' | 'endTurn' | 'surrender';

export interface ButtonRender {
  readonly id: ButtonId;
  readonly label: string;
  readonly rect: Rect;
  readonly enabled: boolean;
  readonly danger: boolean;
  /** The exact action from `legalActions` this button sends; null when disabled. */
  readonly action: PlayerAction | null;
}

export interface LpRender {
  readonly side: Side;
  readonly rect: Rect;
  readonly value: number;
  /** 0..1 against the starting LP, for the bar. */
  readonly ratio: number;
  readonly caption: string;
}

export interface RenderModel {
  readonly viewerIndex: PlayerIndex;
  readonly cards: readonly CardRender[];
  readonly piles: readonly PileRender[];
  readonly lp: readonly LpRender[];
  readonly phase: {
    readonly turnCount: number;
    readonly phase: ViewPhase;
    readonly phaseLabel: string;
    readonly turnOwner: Side;
    readonly text: string;
  };
  readonly buttons: readonly ButtonRender[];
  readonly banner: { readonly kind: 'win' | 'lose' | 'draw'; readonly text: string } | null;
  readonly prompt: { readonly text: string } | null;
  /** An open chain / reaction window: what it waits for; `mine` = I hold priority. */
  readonly chain: { readonly text: string; readonly mine: boolean } | null;
  /** Task 4.2d: Equip card → monster, only when both are drawn (the scene draws a line between them). */
  readonly equipLinks: readonly { readonly equipId: string; readonly monsterId: string }[];
}

export interface PresentContext {
  readonly lookup: CardLookup;
  /** The person pressed "Đầu hàng" once; the button now asks for confirmation. */
  readonly surrenderArmed?: boolean;
  readonly layout?: BoardLayout;
}

function frameOf(def: CardDefinition): FrameKind {
  return def.kind === 'Monster' ? 'monster' : def.kind === 'Spell' ? 'spell' : 'trap';
}

/** The effective value only when the server sent one that differs from the printed value. */
const changed = (printed: number | null, effective: number | undefined): number | null =>
  printed !== null && effective !== undefined && effective !== printed ? effective : null;

function describeKnown(
  definitionId: string,
  position: ViewCardPosition | null,
  lookup: CardLookup,
  effective: EffectiveStatsView | undefined,
): { frame: FrameKind; label: CardLabel; detail: CardDetail } {
  const def = lookup(definitionId);
  if (!def) {
    const label: CardLabel = {
      name: definitionId,
      level: null,
      atk: null,
      def: null,
      effAtk: null,
      effDef: null,
    };
    return {
      frame: 'monster',
      label,
      detail: { ...label, kind: 'monster', effectText: null, position, active: false },
    };
  }
  const monster = def.kind === 'Monster';
  const atk = monster ? def.atk : null;
  const dfn = monster ? def.def : null;
  const label: CardLabel = {
    name: cardName(def),
    level: monster ? def.level : null,
    atk,
    def: dfn,
    effAtk: changed(atk, effective?.atk),
    effDef: changed(dfn, effective?.def),
  };
  return {
    frame: frameOf(def),
    label,
    detail: {
      ...label,
      kind: frameOf(def),
      effectText: cardEffectText(def),
      position,
      active: false,
    },
  };
}

function renderCard(
  card: CardView,
  side: Side,
  zone: ZoneKind,
  rect: Rect,
  viewer: PlayerIndex,
  lookup: CardLookup,
): CardRender {
  const base = {
    id: card.instanceId,
    side,
    zone,
    rect,
    action: null,
    highlight: false,
    activatable: false,
    equippedTo: null,
    fieldCard: false,
    active: false,
  } as const;
  // Hidden for the viewer: a `hidden` card, or (defence in depth against a server bug) an opponent's card that is
  // face-down. Nothing about it is kept.
  const opponentFaceDown =
    !card.hidden && card.ownerIndex !== viewer && card.position === 'DefenseDown';
  if (card.hidden || opponentFaceDown) {
    return {
      ...base,
      faceDown: true,
      frame: null,
      defense: !card.hidden && card.position === 'DefenseDown',
      label: null,
      detail: null,
    };
  }
  const known = describeKnown(card.definitionId, card.position, lookup, card.effectiveStats);
  const faceDown = card.position === 'DefenseDown';
  const def = lookup(card.definitionId);
  // Card data only (which cards rest on the field: Field / Continuous), never a rule: what may be DONE is in
  // legalActions. The mark follows what the server shows: the engine applies a Continuous effect as soon as its card
  // is face-up on the field (the `effectiveStats` it sends change at once, even while the activation link still waits).
  const active =
    !faceDown &&
    card.position !== null &&
    (zone === 'spellTrap' || zone === 'field') &&
    def !== undefined &&
    staysOnField(def);
  return {
    ...base,
    faceDown,
    frame: faceDown ? null : known.frame,
    // Only monsters have a battle position; a Set Spell/Trap is face-down but upright.
    defense: zone === 'monster' && (card.position === 'DefenseUp' || faceDown),
    label: faceDown ? null : known.label,
    // The owner knows their own face-down card, so the panel may name it.
    detail: { ...known.detail, active },
    equippedTo: !faceDown && card.equippedTo !== undefined ? card.equippedTo : null,
    fieldCard: def?.kind === 'Spell' && def.subType === 'Field',
    active,
  };
}

function findAction(
  legal: readonly PlayerAction[],
  viewer: PlayerIndex,
  type: PlayerAction['type'],
): PlayerAction | null {
  return legal.find((a) => a.type === type && a.payload.playerIndex === viewer) ?? null;
}

export function present(
  view: StateView,
  legalActions: readonly PlayerAction[],
  ctx: PresentContext,
): RenderModel {
  const layout = ctx.layout ?? computeLayout();
  const viewer = view.viewerIndex;
  const opp: PlayerIndex = viewer === 0 ? 1 : 0;
  const seatOf: Record<Side, PlayerIndex> = { self: viewer, opp };
  const cards: CardRender[] = [];
  const piles: PileRender[] = [];
  const lp: LpRender[] = [];

  const prompt =
    view.pendingPrompt && view.pendingPrompt.playerIndex === viewer ? view.pendingPrompt : null;

  for (const side of ['self', 'opp'] as const) {
    const player = view.players[seatOf[side]];
    const sl = layout[side];

    player.board.monsterZones.forEach((c, i) => {
      if (c) cards.push(renderCard(c, side, 'monster', sl.monsterZones[i]!, viewer, ctx.lookup));
    });
    const spellTraps = player.board.spellTrapZones;
    const field = player.board.fieldZone;
    // My Set cards the server lets me activate right now (C13: a tap activates them) — the Field Zone card included.
    const activatable =
      side === 'self'
        ? new Set(
            activatableSetCards(legalActions, viewer, [
              ...spellTraps.flatMap((c) => (c ? [c.instanceId] : [])),
              ...(field ? [field.instanceId] : []),
            ]),
          )
        : new Set<string>();
    spellTraps.forEach((c, i) => {
      if (!c) return;
      const r = renderCard(c, side, 'spellTrap', sl.spellTrapZones[i]!, viewer, ctx.lookup);
      cards.push(activatable.has(c.instanceId) ? { ...r, activatable: true } : r);
    });
    if (field) {
      const r = renderCard(field, side, 'field', sl.fieldZone, viewer, ctx.lookup);
      cards.push(activatable.has(field.instanceId) ? { ...r, activatable: true } : r);
    }

    const slots = handSlots(player.hand.length, side);
    player.hand.forEach((c, i) => {
      const r = renderCard(c, side, 'hand', slots[i]!, viewer, ctx.lookup);
      if (side === 'self' && prompt) {
        // The server lists one ResolvePendingPrompt per legal answer; a one-card answer is a click on that card.
        const answer = legalActions.find(
          (a) =>
            a.type === 'ResolvePendingPrompt' &&
            a.payload.promptId === prompt.promptId &&
            a.payload.cardInstanceIds.length === 1 &&
            a.payload.cardInstanceIds[0] === c.instanceId,
        );
        if (answer) cards.push({ ...r, action: answer, highlight: true });
        else cards.push(r);
      } else {
        cards.push(r);
      }
    });

    piles.push(
      { kind: 'deck', side, rect: sl.deck, count: player.deckCount, caption: strings.deck },
      {
        kind: 'graveyard',
        side,
        rect: sl.graveyard,
        count: player.graveyard.length,
        caption: strings.graveyard,
      },
      {
        kind: 'extraDeck',
        side,
        rect: sl.extraDeck,
        count: player.extraDeckCount,
        caption: strings.extraDeck,
      },
    );

    const start = Math.max(1, view.ruleset.startingLP);
    lp.push({
      side,
      rect: sl.lp,
      value: player.lifePoints,
      ratio: Math.max(0, Math.min(1, player.lifePoints / start)),
      caption: side === 'self' ? strings.you : strings.opponent,
    });
  }

  const endPhase = findAction(legalActions, viewer, 'EndPhase');
  const surrender = findAction(legalActions, viewer, 'Surrender');
  const pass = passAction(legalActions, viewer);
  const buttons: ButtonRender[] = [
    // While a chain / reaction window waits for me, EndPhase is never listed, so "Bỏ qua" takes its spot.
    pass
      ? {
          id: 'pass',
          label: strings.pass,
          rect: layout.buttons.nextPhase,
          enabled: true,
          danger: false,
          action: pass,
        }
      : {
          id: 'nextPhase',
          label: strings.nextPhase,
          rect: layout.buttons.nextPhase,
          enabled: endPhase !== null,
          danger: false,
          action: endPhase,
        },
    {
      id: 'endTurn',
      label: strings.endTurn,
      rect: layout.buttons.endTurn,
      enabled: endPhase !== null,
      danger: false,
      action: endPhase,
    },
    {
      id: 'surrender',
      label: ctx.surrenderArmed && surrender ? strings.surrenderConfirm : strings.surrender,
      rect: layout.buttons.surrender,
      enabled: surrender !== null,
      danger: true,
      action: surrender,
    },
  ];

  const turnOwner: Side = view.turnPlayerIndex === viewer ? 'self' : 'opp';
  const phaseLabel = strings.phase[view.phase];
  const banner =
    view.winnerIndex === null
      ? null
      : view.winnerIndex === 'draw'
        ? ({ kind: 'draw', text: strings.draw } as const)
        : view.winnerIndex === viewer
          ? ({ kind: 'win', text: strings.win } as const)
          : ({ kind: 'lose', text: strings.lose } as const);

  let promptModel: RenderModel['prompt'] = null;
  if (prompt && view.winnerIndex === null) {
    const anySingle = cards.some((c) => c.action !== null);
    promptModel = {
      text:
        prompt.kind === 'DiscardToHandLimit'
          ? anySingle
            ? strings.discardPrompt
            : strings.discardNeedsDrag
          : prompt.kind === 'SelectEffectTarget'
            ? strings.targetPrompt
            : prompt.kind === 'SelectFusionMonster'
              ? strings.fusionMonsterTitle
              : prompt.kind === 'SelectFusionMaterials'
                ? strings.fusionMaterialTitle(fusionPromptOf(view)?.count ?? 0)
                : prompt.kind === 'TriggerActivation'
                  ? triggerPromptText(prompt.payload, ctx.lookup)
                  : strings.promptOther,
    };
  }

  return {
    viewerIndex: viewer,
    cards,
    piles,
    lp,
    phase: {
      turnCount: view.turnCount,
      phase: view.phase,
      phaseLabel,
      turnOwner,
      text: `${strings.turn} ${view.turnCount} · ${
        turnOwner === 'self' ? strings.yourTurn : strings.opponentTurn
      } · ${phaseLabel}`,
    },
    buttons,
    banner,
    prompt: promptModel,
    chain: view.winnerIndex === null ? chainBanner(view, ctx.lookup) : null,
    equipLinks: cards.flatMap((c) =>
      c.equippedTo !== null && cards.some((m) => m.id === c.equippedTo && m.zone === 'monster')
        ? [{ equipId: c.id, monsterId: c.equippedTo }]
        : [],
    ),
  };
}

/** Name of the card whose trigger asks (the prompted player's payload); the generic text if it is not readable. */
function triggerPromptText(payload: unknown, lookup: CardLookup): string {
  const trigger =
    typeof payload === 'object' && payload !== null && 'trigger' in payload
      ? (payload as { trigger: unknown }).trigger
      : null;
  const id =
    typeof trigger === 'object' && trigger !== null && 'definitionId' in trigger
      ? (trigger as { definitionId: unknown }).definitionId
      : null;
  if (typeof id !== 'string') return strings.promptOther;
  const def = lookup(id);
  return t('duel.triggerPrompt', { name: def ? cardName(def) : id });
}

/**
 * What an open window waits for, read from `chainWindow`/`chain` only (no rule): a reaction to an attack or a summon,
 * or a chain to respond to (its links are public); "waiting" when the other seat holds priority.
 */
function chainBanner(view: StateView, lookup: CardLookup): RenderModel['chain'] {
  const w = view.chainWindow;
  if (!w) return null;
  if (w.priorityPlayer !== view.viewerIndex) return { text: t('chain.waitOpponent'), mine: false };
  // "The opponent attacks / summons" only while nothing is on the chain yet: once a link was added (the window keeps
  // its `reactionTo`), what I answer is the chain (task 4.3b; noted at 3.8).
  if (view.chain.length === 0) {
    if (w.reactionTo?.kind === 'Attack') return { text: t('chain.reactionAttack'), mine: true };
    if (w.reactionTo?.kind === 'Summon') return { text: t('chain.reactionSummon'), mine: true };
  }
  const top = view.chain[view.chain.length - 1];
  const def = top ? lookup(top.card.definitionId) : undefined;
  const name = def ? cardName(def) : (top?.card.definitionId ?? '?');
  return { text: t('chain.respond', { count: view.chain.length, name }), mine: true };
}

/**
 * Task 4.2d: the graveyard picker slots (`OverlayModel.picker`) as cards to draw, face-up. Only a card the view shows in
 * a graveyard is drawn (always public); any other id gets no card (never guessed).
 * Task 4.5b: the picker of a Fusion prompt also holds the VIEWER'S OWN cards — their Extra Deck (the server sends that
 * list to its owner only), their hand and their Monster Zones. A card of mine that is face-down on the field is drawn
 * face-up here (I know it; the row is only ever drawn for me). Nothing of the opponent's is looked up but the graveyard.
 */
export function pickerCards(
  view: StateView,
  picker: readonly { readonly id: string; readonly rect: Rect }[],
  lookup: CardLookup,
): CardRender[] {
  const graveyard = view.players.flatMap((p) => p.graveyard);
  const own = view.players[view.viewerIndex];
  const mine: readonly CardView[] = [
    ...(own.extraDeck ?? []),
    ...own.hand,
    ...own.board.monsterZones.flatMap((c) => (c ? [c] : [])),
  ];
  return picker.flatMap(({ id, rect }) => {
    const inGraveyard = graveyard.find((c) => c.instanceId === id);
    const card = inGraveyard ?? mine.find((c) => c.instanceId === id);
    if (!card || card.hidden) return [];
    const side: Side = card.ownerIndex === view.viewerIndex ? 'self' : 'opp';
    // Upright and face-up in the row, whatever its position on the field.
    const shown = inGraveyard ? card : { ...card, position: null };
    return [renderCard(shown, side, 'hand', rect, view.viewerIndex, lookup)];
  });
}
