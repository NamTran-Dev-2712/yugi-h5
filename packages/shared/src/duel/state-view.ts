import type { RulesetConfig } from '../rules/ruleset-config.js';

/**
 * StateView = GameState filtered for ONE viewer (see docs/design/protocol.md). Types only:
 * the filter itself lives in apps/api; apps/web imports these types from @yugi/shared.
 */

export type PlayerIndex = 0 | 1;
export type ViewPhase = 'Draw' | 'Standby' | 'Main1' | 'Battle' | 'Main2' | 'End';
export type ViewCardPosition = 'Attack' | 'DefenseUp' | 'DefenseDown';

/** A card exists at this spot but the viewer may not know what it is. No definitionId/position on purpose. */
export interface HiddenCardView {
  readonly hidden: true;
  readonly instanceId: string;
  readonly ownerIndex: PlayerIndex;
}

export interface VisibleCardView {
  readonly hidden: false;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly position: ViewCardPosition | null;
  readonly ownerIndex: PlayerIndex;
}

export type CardView = HiddenCardView | VisibleCardView;

type Five<T> = readonly [T, T, T, T, T];

export interface BoardView {
  readonly monsterZones: Five<CardView | null>;
  readonly spellTrapZones: Five<CardView | null>;
  readonly fieldZone: CardView | null;
}

export interface PlayerView {
  readonly playerId: string;
  readonly lifePoints: number;
  /** Own hand: visible cards. Opponent hand: all hidden (same length as handCount). */
  readonly hand: readonly CardView[];
  readonly handCount: number;
  /** Deck / Extra Deck contents are never sent to anyone, only the count. */
  readonly deckCount: number;
  readonly extraDeckCount: number;
  readonly graveyard: readonly VisibleCardView[];
  readonly banished: readonly VisibleCardView[];
  readonly board: BoardView;
  readonly hasNormalSummonedThisTurn: boolean;
}

/**
 * `payload` is the engine's prompt payload for the prompted player. The other player only gets the payload of a kind
 * classified public (today `DiscardToHandLimit`); for every other kind it is `null` (see docs/design/protocol.md).
 */
export interface PendingPromptView {
  readonly promptId: string;
  readonly playerIndex: PlayerIndex;
  readonly kind: string;
  readonly payload: unknown;
}

/** `payload` of a `DiscardToHandLimit` prompt. */
export interface DiscardToHandLimitPromptPayload {
  readonly count: number;
}

/** `payload` of a `SelectEffectTarget` prompt (only the prompted player receives it). */
export interface SelectEffectTargetPromptPayload {
  readonly cardInstanceId: string;
  readonly effectId: string;
  readonly costInstanceIds: readonly string[];
  /** Ids the player may choose from; the answer is `ResolvePendingPrompt` with exactly `count` of them. */
  readonly candidateInstanceIds: readonly string[];
  readonly count: number;
}

export interface StateView {
  readonly matchId: string;
  readonly version: number;
  readonly viewerIndex: PlayerIndex;
  readonly ruleset: RulesetConfig;
  readonly turnCount: number;
  readonly turnPlayerIndex: PlayerIndex;
  readonly phase: ViewPhase;
  readonly winnerIndex: PlayerIndex | 'draw' | null;
  readonly pendingPrompt: PendingPromptView | null;
  readonly players: readonly [PlayerView, PlayerView];
}
