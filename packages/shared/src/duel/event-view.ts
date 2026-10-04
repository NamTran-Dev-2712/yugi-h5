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

/**
 * Task 4.3 (on the wire since 4.3b): a Field Spell was Set face-down in `playerIndex`'s Field Zone. No `zoneIndex` (one
 * slot per player) and no `definitionId`, for both viewers.
 */
export interface FieldSpellSetEventView {
  readonly type: 'FieldSpellSet';
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
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

/**
 * A used (already revealed) Spell/Trap went to its owner's graveyard: `Hand` = activated from the hand, `SpellTrapZone`
 * = a Set card that was flipped face-up to activate (task 3.4). `FieldZone` (task 4.3, on the wire since 4.3b) = a Field
 * Spell replaced by its controller's new one: sent, not destroyed; the graveyard is public, so the `definitionId` is
 * shown even if the replaced card was still face-down.
 */
export interface CardSentToGraveyardEventView {
  readonly type: 'CardSentToGraveyard';
  readonly ownerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly from: 'Hand' | 'SpellTrapZone' | 'FieldZone';
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

/**
 * Task 4.3 (on the wire since 4.3b): the card in `ownerIndex`'s Field Zone was destroyed by an effect and went to the
 * (public) graveyard, so `definitionId` is shown even if it was Set.
 */
export interface FieldSpellDestroyedEventView {
  readonly type: 'FieldSpellDestroyed';
  readonly ownerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
}

/** Chain (task 3.3, on the wire since 3.4b). The linked card was revealed by EffectActivated: public. */
export interface ChainLinkAddedEventView {
  readonly type: 'ChainLinkAdded';
  readonly linkId: string;
  /** 1-based position on the chain (1 = first activated, resolves last). */
  readonly chainIndex: number;
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly effectId: string;
  readonly spellSpeed: 1 | 2 | 3;
  readonly targetInstanceIds: readonly string[];
}

/** A link resolved with no effect: all of its targets left their zone first. */
export interface ChainLinkFizzledEventView {
  readonly type: 'ChainLinkFizzled';
  readonly linkId: string;
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly effectId: string;
  readonly reason: 'TARGET_GONE';
}

/**
 * Task 4.4 (on the wire since 4.4b): the activation of the link right below the answering card was negated. The negated
 * card was revealed when it was activated and is now in its owner's (public) graveyard; `byInstanceId` is the card that
 * negated it (on the chain, revealed too). The link never resolves.
 */
export interface ChainLinkNegatedEventView {
  readonly type: 'ChainLinkNegated';
  readonly linkId: string;
  /** The player whose activation was negated. */
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly effectId: string;
  readonly byInstanceId: string;
}

/**
 * Task 4.4 (on the wire since 4.4b): the declared attack was negated (no flip, no destruction, no damage). Ids only, like
 * `AttackDeclared`: the target may be a face-down monster, so this event never carries a `definitionId`.
 */
export interface AttackNegatedEventView {
  readonly type: 'AttackNegated';
  /** The attacking player. */
  readonly playerIndex: PlayerIndex;
  readonly attackerInstanceId: string;
  /** null = it was a direct attack. */
  readonly targetInstanceId: string | null;
}

/**
 * Task 4.4 (on the wire since 4.4b): a Normal / Flip Summon was negated; the (face-up) monster left `zoneIndex` for its
 * owner's public graveyard — sent, not destroyed.
 */
export interface SummonNegatedEventView {
  readonly type: 'SummonNegated';
  /** The player whose Summon was negated. */
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
}

/** Every link resolved (LIFO); the window is closed. */
export interface ChainResolvedEventView {
  readonly type: 'ChainResolved';
  readonly linkCount: number;
}

export interface DuelEndedEventView {
  readonly type: 'DuelEnded';
  readonly winnerIndex: PlayerIndex | null;
  readonly reason: 'LP_ZERO' | 'SURRENDER' | 'DECK_OUT';
}

/** Task 4.2a: an effect Special Summoned a monster from its controller's hand or graveyard, always face-up. */
export interface MonsterSpecialSummonedEventView {
  readonly type: 'MonsterSpecialSummoned';
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
  readonly from: 'Hand' | 'Graveyard';
  readonly position: Extract<ViewCardPosition, 'Attack' | 'DefenseUp'>;
}

/** Task 4.2b: a face-down monster was Flip Summoned (now face-up in Attack Position). */
export interface FlipSummonedEventView {
  readonly type: 'FlipSummoned';
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
}

/** Task 4.2c: a face-up Equip Spell was equipped to the face-up monster `targetInstanceId`. */
export interface CardEquippedEventView {
  readonly type: 'CardEquipped';
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly targetInstanceId: string;
}

/**
 * Task 4.5 (on the wire since 4.5b): a fusion material left its owner's hand or Monster Zone for the (public) graveyard —
 * sent, not destroyed. The graveyard is public, so `definitionId` is shown even for a material that was face-down or in
 * the hand. `from` never says `Deck` on the wire: no real card takes materials from the Deck (ADR 069).
 */
export interface FusionMaterialSentEventView {
  readonly type: 'FusionMaterialSent';
  readonly ownerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly from: 'Hand' | 'MonsterZone' | 'Deck';
  /** Only when `from` is `MonsterZone`. */
  readonly zoneIndex?: number;
}

/**
 * Task 4.5 (on the wire since 4.5b): a Fusion Monster left its controller's Extra Deck and is now face-up in
 * `zoneIndex`. `materialInstanceIds` are the cards just sent to the graveyard (public).
 */
export interface MonsterFusionSummonedEventView {
  readonly type: 'MonsterFusionSummoned';
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
  readonly position: Extract<ViewCardPosition, 'Attack' | 'DefenseUp'>;
  readonly materialInstanceIds: readonly string[];
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
  | FieldSpellSetEventView
  | EffectActivatedEventView
  | EffectResolvedEventView
  | CardSentToGraveyardEventView
  | LifePointsRecoveredEventView
  | LifePointsPaidEventView
  | SpellTrapDestroyedEventView
  | FieldSpellDestroyedEventView
  | ChainLinkAddedEventView
  | ChainLinkFizzledEventView
  | ChainLinkNegatedEventView
  | AttackNegatedEventView
  | SummonNegatedEventView
  | ChainResolvedEventView
  | MonsterSpecialSummonedEventView
  | FlipSummonedEventView
  | CardEquippedEventView
  | FusionMaterialSentEventView
  | MonsterFusionSummonedEventView
  | DuelEndedEventView;
