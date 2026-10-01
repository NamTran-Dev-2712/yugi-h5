import type { CardPosition, Phase } from '../state/types.js';

export interface DuelStartedEvent {
  readonly type: 'DuelStarted';
  readonly matchId: string;
  readonly turnPlayerIndex: 0 | 1;
}

export interface CardDrawnEvent {
  readonly type: 'CardDrawn';
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
}

export interface DeckOutEvent {
  readonly type: 'DeckOut';
  readonly playerIndex: 0 | 1;
}

export interface PhaseChangedEvent {
  readonly type: 'PhaseChanged';
  readonly from: Phase;
  readonly to: Phase;
  readonly turnPlayerIndex: 0 | 1;
}

export interface TurnChangedEvent {
  readonly type: 'TurnChanged';
  readonly turnCount: number;
  readonly turnPlayerIndex: 0 | 1;
}

export interface NormalSummonedEvent {
  readonly type: 'NormalSummoned';
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
}

/** Deliberately carries no `definitionId`: the card is face-down, so the event must not leak it. */
export interface MonsterSetEvent {
  readonly type: 'MonsterSet';
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly zoneIndex: number;
}

/** A monster Tributed for a Tribute Summon/Set, sent to its owner's graveyard. Public zone, so `definitionId` is included even if it was face-down. */
export interface MonsterTributedEvent {
  readonly type: 'MonsterTributed';
  readonly ownerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  /** Monster zone the card was Tributed from. */
  readonly zoneIndex: number;
}

/** Face-up monster switched between Attack and Defense. Only face-up cards can change, so `definitionId` leaks nothing. */
export interface PositionChangedEvent {
  readonly type: 'PositionChanged';
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
  readonly from: Extract<CardPosition, 'Attack' | 'DefenseUp'>;
  readonly to: Extract<CardPosition, 'Attack' | 'DefenseUp'>;
}

/** A face-down monster flipped face-up because it was declared as an attack target (stays in Defense Position). Public zone, so `definitionId` is included. */
export interface MonsterFlippedEvent {
  readonly type: 'MonsterFlipped';
  readonly ownerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
}

export interface AttackDeclaredEvent {
  readonly type: 'AttackDeclared';
  readonly playerIndex: 0 | 1;
  readonly attackerInstanceId: string;
  /** null = direct attack. */
  readonly targetInstanceId: string | null;
}

/** Task 4.2c: an Equip Spell (face-up in its controller's Spell/Trap Zone) was equipped to a face-up monster. */
export interface CardEquippedEvent {
  readonly type: 'CardEquipped';
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly targetInstanceId: string;
}

/** Task 4.2b: a face-down monster was Flip Summoned (now face-up in Attack Position, so `definitionId` is public). */
export interface FlipSummonedEvent {
  readonly type: 'FlipSummoned';
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
}

/**
 * Task 4.2a: an effect Special Summoned a monster from its controller's hand or graveyard, always face-up (so
 * `definitionId` leaks nothing). Does not use the Normal Summon of the turn.
 */
export interface MonsterSpecialSummonedEvent {
  readonly type: 'MonsterSpecialSummoned';
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
  readonly from: 'Hand' | 'Graveyard';
  readonly position: Extract<CardPosition, 'Attack' | 'DefenseUp'>;
}

/** A monster destroyed by battle, sent to its owner's graveyard. Public zone, so `definitionId` is included even if it was face-down. */
export interface MonsterDestroyedEvent {
  readonly type: 'MonsterDestroyed';
  readonly ownerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
}

export interface DamageDealtEvent {
  readonly type: 'DamageDealt';
  /** Recipient of the damage. */
  readonly playerIndex: 0 | 1;
  readonly amount: number;
}

/** A card left the hand for the graveyard (hand limit). The graveyard is public, so `definitionId` is shown. */
export interface CardDiscardedEvent {
  readonly type: 'CardDiscarded';
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
}

/** Deliberately carries no `definitionId`: the card is Set face-down. */
export interface SpellTrapSetEvent {
  readonly type: 'SpellTrapSet';
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly zoneIndex: number;
}

/**
 * Task 4.3: a Field Spell was Set face-down in its controller's Field Zone (one slot, so no `zoneIndex`; no
 * `definitionId`: the card is face-down). Not a `SpellTrapSet`: that one names a Spell/Trap Zone.
 */
export interface FieldSpellSetEvent {
  readonly type: 'FieldSpellSet';
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
}

/** A Spell's effect is activated from the hand (the card is revealed by activating it, so `definitionId` is public). */
export interface EffectActivatedEvent {
  readonly type: 'EffectActivated';
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly effectId: string;
}

/** The activated effect finished resolving (all operations ran, or the duel ended part-way). */
export interface EffectResolvedEvent {
  readonly type: 'EffectResolved';
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly effectId: string;
}

/**
 * A used Spell/Trap went to its owner's graveyard: from the hand, or from the Spell/Trap Zone it was flipped in (3.4).
 * Task 4.3: `FieldZone` = a Field Spell replaced by its controller's new one (sent, not destroyed).
 */
export interface CardSentToGraveyardEvent {
  readonly type: 'CardSentToGraveyard';
  readonly ownerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly from: 'Hand' | 'SpellTrapZone' | 'FieldZone';
}

export interface LifePointsRecoveredEvent {
  readonly type: 'LifePointsRecovered';
  readonly playerIndex: 0 | 1;
  readonly amount: number;
}

/** LP paid as an effect cost. */
export interface LifePointsPaidEvent {
  readonly type: 'LifePointsPaid';
  readonly playerIndex: 0 | 1;
  readonly amount: number;
}

/** A Spell/Trap on the field destroyed by an effect, sent to its owner's graveyard. Public zone, so `definitionId` is included. */
export interface SpellTrapDestroyedEvent {
  readonly type: 'SpellTrapDestroyed';
  readonly ownerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly zoneIndex: number;
}

/** Task 4.3: the card in a Field Zone destroyed by an effect, sent to its owner's graveyard (public: `definitionId`). */
export interface FieldSpellDestroyedEvent {
  readonly type: 'FieldSpellDestroyed';
  readonly ownerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
}

/** An activation became a chain link (cost already paid, targets fixed). The card is public from activation on. */
export interface ChainLinkAddedEvent {
  readonly type: 'ChainLinkAdded';
  readonly linkId: string;
  /** 1-based position on the chain (1 = first activated, resolves last). */
  readonly chainIndex: number;
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly effectId: string;
  readonly spellSpeed: 1 | 2 | 3;
  readonly targetInstanceIds: readonly string[];
}

/** A chain link resolved with no effect (all of its targets left their zone before it resolved). No throw. */
export interface ChainLinkFizzledEvent {
  readonly type: 'ChainLinkFizzled';
  readonly linkId: string;
  readonly playerIndex: 0 | 1;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly effectId: string;
  readonly reason: 'TARGET_GONE';
}

/** Every link of the chain resolved (LIFO); the response window is closed. Not emitted when the duel ended mid-chain. */
export interface ChainResolvedEvent {
  readonly type: 'ChainResolved';
  readonly linkCount: number;
}

/**
 * The duel is over. `winnerIndex: null` means a draw (both players' LP hit 0 in the same action).
 * `SURRENDER` and `DECK_OUT` always have a winner: the opponent of the player who conceded / could not draw.
 */
export interface DuelEndedEvent {
  readonly type: 'DuelEnded';
  readonly winnerIndex: 0 | 1 | null;
  readonly reason: 'LP_ZERO' | 'SURRENDER' | 'DECK_OUT';
}

/**
 * Skeleton union — grows through M2+. FE animates purely from
 * this stream; it never re-derives game logic client-side.
 */
export type GameEvent =
  | DuelStartedEvent
  | CardDrawnEvent
  | DeckOutEvent
  | CardDiscardedEvent
  | PhaseChangedEvent
  | TurnChangedEvent
  | NormalSummonedEvent
  | MonsterSpecialSummonedEvent
  | FlipSummonedEvent
  | CardEquippedEvent
  | MonsterSetEvent
  | MonsterTributedEvent
  | PositionChangedEvent
  | AttackDeclaredEvent
  | MonsterFlippedEvent
  | MonsterDestroyedEvent
  | DamageDealtEvent
  | SpellTrapSetEvent
  | FieldSpellSetEvent
  | EffectActivatedEvent
  | EffectResolvedEvent
  | CardSentToGraveyardEvent
  | LifePointsRecoveredEvent
  | LifePointsPaidEvent
  | SpellTrapDestroyedEvent
  | FieldSpellDestroyedEvent
  | ChainLinkAddedEvent
  | ChainLinkFizzledEvent
  | ChainResolvedEvent
  | DuelEndedEvent;
