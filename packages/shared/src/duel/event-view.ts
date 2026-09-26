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

/** No definitionId, for both viewers: the Spell/Trap is Set face-down. */
export interface SpellTrapSetEventView {
  readonly type: 'SpellTrapSet';
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly zoneIndex: number;
}

/** Activating a card reveals it, so `definitionId` is public. */
export interface EffectActivatedEventView {
  readonly type: 'EffectActivated';
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly effectId: string;
}

export interface EffectResolvedEventView {
  readonly type: 'EffectResolved';
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly effectId: string;
}

/** A used (already revealed) Spell went to its owner's graveyard. */
export interface CardSentToGraveyardEventView {
  readonly type: 'CardSentToGraveyard';
  readonly ownerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly from: 'Hand';
}

export interface LifePointsRecoveredEventView {
  readonly type: 'LifePointsRecovered';
  readonly playerIndex: PlayerIndex;
  readonly amount: number;
}

export interface LifePointsPaidEventView {
  readonly type: 'LifePointsPaid';
  readonly playerIndex: PlayerIndex;
  readonly amount: number;
}

/** The destroyed Spell/Trap goes to the (public) graveyard, so `definitionId` is shown even if it was Set. */
export interface SpellTrapDestroyedEventView {
  readonly type: 'SpellTrapDestroyed';
  readonly ownerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
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
  | SpellTrapSetEventView
  | EffectActivatedEventView
  | EffectResolvedEventView
  | CardSentToGraveyardEventView
  | LifePointsRecoveredEventView
  | LifePointsPaidEventView
  | SpellTrapDestroyedEventView
  | DuelEndedEventView;
