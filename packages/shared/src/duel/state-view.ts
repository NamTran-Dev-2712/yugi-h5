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

/** ATK/DEF a face-up monster has right now, after every Continuous modifier (never below 0). */
export interface EffectiveStatsView {
  readonly atk: number;
  readonly def: number;
}

export interface VisibleCardView {
  readonly hidden: false;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly position: ViewCardPosition | null;
  readonly ownerIndex: PlayerIndex;
  /**
   * Task 3.4b: only on a FACE-UP monster in a Monster Zone. The printed ATK/DEF stay in the card data (show both);
   * absent everywhere else (hand, graveyard, face-down monsters, Spell/Traps).
   */
  readonly effectiveStats?: EffectiveStatsView;
  /**
   * Task 4.2d: only on a FACE-UP Equip card in a Spell/Trap Zone — the instanceId of the face-up monster it is equipped
   * to (either side of the table). Absent everywhere else.
   */
  readonly equippedTo?: string;
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
  /** Deck contents are never sent to anyone, only the count. */
  readonly deckCount: number;
  readonly extraDeckCount: number;
  /**
   * Task 4.5b: the cards of the Extra Deck, in order — present ONLY in the view of the player who owns it (a player may
   * look at their own Extra Deck). The opponent's view has no such key at all, only `extraDeckCount`.
   */
  readonly extraDeck?: readonly VisibleCardView[];
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

/** `payload` of a `TriggerActivation` prompt (task 3.5; only the prompted player receives it). */
export interface TriggerActivationPromptPayload {
  readonly trigger: PendingTriggerView;
  /** false = mandatory (asked only to choose targets): the answer cannot be `decline`. */
  readonly optional: boolean;
  readonly candidateInstanceIds: readonly string[];
  /** Exactly this many ids must be chosen (0 = no target). */
  readonly count: number;
  /** Triggers still to handle after this one, in chain order. */
  readonly remaining: readonly PendingTriggerView[];
  readonly afterward: { readonly kind: 'SummonReaction'; readonly responder: PlayerIndex } | null;
}

/**
 * `payload` of a `SelectFusionMonster` prompt (task 4.5b; only the prompted player receives it): which Fusion Monsters
 * of THEIR Extra Deck can be made right now. The engine's bookkeeping (link id, owed triggers, link count) stays
 * server-side.
 */
export interface SelectFusionMonsterPromptPayload {
  /** Ids in the prompted player's own Extra Deck; the answer is `ResolvePendingPrompt` with exactly `count` of them. */
  readonly candidateInstanceIds: readonly string[];
  readonly count: number;
}

/** `payload` of a `SelectFusionMaterials` prompt (task 4.5b; only the prompted player receives it). */
export interface SelectFusionMaterialsPromptPayload {
  /** The Fusion Monster chosen in the previous step (still in the prompted player's Extra Deck). */
  readonly fusionInstanceId: string;
  /** The prompted player's own cards (hand / Monster Zones) that may serve as a material. */
  readonly candidateInstanceIds: readonly string[];
  /** Exactly this many must be chosen (the number of materials the Fusion Monster names). */
  readonly count: number;
}

/** A trigger that fired: its card is face-up in a Monster Zone or in the (public) graveyard. */
export interface PendingTriggerView {
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly definitionId: string;
  readonly effectId: string;
  readonly source:
    { readonly zone: 'MonsterZone'; readonly zoneIndex: number } | { readonly zone: 'Graveyard' };
}

/**
 * Where a chain link's card was activated from (engine `ChainLinkSource`). `FieldZone` (on the wire since task 4.3b): a
 * Field Spell — from the hand it is placed face-up in its controller's Field Zone at activation, a Set one flips there.
 */
export type ChainLinkSourceView =
  | { readonly zone: 'Hand' }
  | { readonly zone: 'SpellTrapZone'; readonly zoneIndex: number }
  | { readonly zone: 'FieldZone' }
  | { readonly zone: 'MonsterZone'; readonly zoneIndex: number }
  | { readonly zone: 'Graveyard' };

/**
 * One link of the chain (task 3.4b). Public for both seats: activating revealed the card (from the hand: it now lives
 * in the link; a Set card: flipped face-up in its zone; a trigger: face-up monster or graveyard card).
 */
export interface ChainLinkView {
  readonly linkId: string;
  readonly playerIndex: PlayerIndex;
  readonly card: VisibleCardView;
  readonly source: ChainLinkSourceView;
  readonly effectId: string;
  readonly spellSpeed: 1 | 2 | 3;
  readonly targetInstanceIds: readonly string[];
}

/** What an (empty) reaction window was opened for (task 3.4c). */
export type ReactionToView =
  | { readonly kind: 'Summon' }
  | {
      readonly kind: 'Attack';
      readonly playerIndex: PlayerIndex;
      readonly attackerInstanceId: string;
      readonly targetInstanceId: string | null;
    };

/**
 * Open response window: `priorityPlayer` may activate a chainable effect or `PassPriority`. Non-null ⇔ the chain is
 * non-empty, or an empty reaction window (`reactionTo` set) waits for the opponent of the turn player.
 */
export interface ChainWindowView {
  readonly priorityPlayer: PlayerIndex;
  readonly passCount: 0 | 1;
  readonly reactionTo?: ReactionToView;
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
  /** Chain links, bottom (link 1, resolves last) → top. Empty outside a chain. */
  readonly chain: readonly ChainLinkView[];
  readonly chainWindow: ChainWindowView | null;
  readonly players: readonly [PlayerView, PlayerView];
}
