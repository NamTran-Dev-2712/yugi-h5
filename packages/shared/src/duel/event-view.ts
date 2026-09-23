import type { CardView, PlayerIndex, ViewCardPosition, ViewPhase } from './state-view.js';

/**
 * EventView = GameEvent filtered for ONE viewer (see docs/design/event-visibility.md). Types only: the filter
 * lives in apps/api. Public events keep exactly the engine shape (clients read the same fields); the only
 * event that needs a hidden form today is CardDrawn (owner sees the card, the opponent sees a hidden card).
 */

export interface DuelStartedEventView {
  readonly type: 'DuelStarted';
  readonly matchId: string;
  readonly turnPlayerIndex: PlayerIndex;
}

/** `card` is a VisibleCardView for the drawer and a HiddenCardView (no definitionId) for the opponent. */
export interface CardDrawnEventView {
  readonly type: 'CardDrawn';
  readonly playerIndex: PlayerIndex;
  readonly card: CardView;
}

export interface DeckOutEventView {
  readonly type: 'DeckOut';
  readonly playerIndex: PlayerIndex;
}

export interface CardDiscardedEventView {
  readonly type: 'CardDiscarded';
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
}

export interface PhaseChangedEventView {
  readonly type: 'PhaseChanged';
  readonly from: ViewPhase;
  readonly to: ViewPhase;
  readonly turnPlayerIndex: PlayerIndex;
}

export interface TurnChangedEventView {
  readonly type: 'TurnChanged';
  readonly turnCount: number;
  readonly turnPlayerIndex: PlayerIndex;
}

export interface NormalSummonedEventView {
  readonly type: 'NormalSummoned';
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
}

/** No definitionId, for both viewers: the card is face-down. */
export interface MonsterSetEventView {
  readonly type: 'MonsterSet';
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly zoneIndex: number;
}

export interface MonsterTributedEventView {
  readonly type: 'MonsterTributed';
  readonly ownerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
}

export interface PositionChangedEventView {
  readonly type: 'PositionChanged';
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
  readonly from: Extract<ViewCardPosition, 'Attack' | 'DefenseUp'>;
  readonly to: Extract<ViewCardPosition, 'Attack' | 'DefenseUp'>;
}

export interface MonsterFlippedEventView {
  readonly type: 'MonsterFlipped';
  readonly ownerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
}

export interface AttackDeclaredEventView {
  readonly type: 'AttackDeclared';
  readonly playerIndex: PlayerIndex;
  readonly attackerInstanceId: string;
  /** null = direct attack. */
  readonly targetInstanceId: string | null;
}

export interface MonsterDestroyedEventView {
  readonly type: 'MonsterDestroyed';
  readonly ownerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
}

export interface DamageDealtEventView {
  readonly type: 'DamageDealt';
  readonly playerIndex: PlayerIndex;
  readonly amount: number;
}

export interface DuelEndedEventView {
  readonly type: 'DuelEnded';
  readonly winnerIndex: PlayerIndex | null;
  readonly reason: 'LP_ZERO' | 'SURRENDER' | 'DECK_OUT';
}

export type EventView =
  | DuelStartedEventView
  | CardDrawnEventView
  | DeckOutEventView
  | CardDiscardedEventView
  | PhaseChangedEventView
  | TurnChangedEventView
  | NormalSummonedEventView
  | MonsterSetEventView
  | MonsterTributedEventView
  | PositionChangedEventView
  | MonsterFlippedEventView
  | AttackDeclaredEventView
  | MonsterDestroyedEventView
  | DamageDealtEventView
  | DuelEndedEventView;
