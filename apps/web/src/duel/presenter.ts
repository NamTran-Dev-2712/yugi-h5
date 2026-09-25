import type {
  CardDefinition,
  CardView,
  PlayerAction,
  PlayerIndex,
  StateView,
  ViewCardPosition,
  ViewPhase,
} from '@yugi/shared';
import { computeLayout, handSlots, type BoardLayout, type Rect, type Side } from './layout';
import { cardName, cardEffectText } from './card-text';
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
  readonly atk: number | null;
  readonly def: number | null;
}

export interface CardDetail extends CardLabel {
  readonly kind: FrameKind;
  readonly effectText: string | null;
  readonly position: ViewCardPosition | null;
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
}

export interface PileRender {
  readonly kind: 'deck' | 'graveyard' | 'extraDeck';
  readonly side: Side;
  readonly rect: Rect;
  readonly count: number;
  readonly caption: string;
}

export type ButtonId = 'nextPhase' | 'endTurn' | 'surrender';

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

function describeKnown(
  definitionId: string,
  position: ViewCardPosition | null,
  lookup: CardLookup,
): { frame: FrameKind; label: CardLabel; detail: CardDetail } {
  const def = lookup(definitionId);
  if (!def) {
    const label: CardLabel = { name: definitionId, level: null, atk: null, def: null };
    return {
      frame: 'monster',
      label,
      detail: { ...label, kind: 'monster', effectText: null, position },
    };
  }
  const monster = def.kind === 'Monster';
  const label: CardLabel = {
    name: cardName(def),
    level: monster ? def.level : null,
    atk: monster ? def.atk : null,
    def: monster ? def.def : null,
  };
  return {
    frame: frameOf(def),
    label,
    detail: { ...label, kind: frameOf(def), effectText: cardEffectText(def), position },
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
  const base = { id: card.instanceId, side, zone, rect, action: null, highlight: false } as const;
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
  const known = describeKnown(card.definitionId, card.position, lookup);
  const faceDown = card.position === 'DefenseDown';
  return {
    ...base,
    faceDown,
    frame: faceDown ? null : known.frame,
    defense: card.position === 'DefenseUp' || faceDown,
    label: faceDown ? null : known.label,
    // The owner knows their own face-down card, so the panel may name it.
    detail: known.detail,
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
    player.board.spellTrapZones.forEach((c, i) => {
      if (c)
        cards.push(renderCard(c, side, 'spellTrap', sl.spellTrapZones[i]!, viewer, ctx.lookup));
    });
    if (player.board.fieldZone) {
      cards.push(
        renderCard(player.board.fieldZone, side, 'field', sl.fieldZone, viewer, ctx.lookup),
      );
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
  const buttons: ButtonRender[] = [
    {
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
  };
}
