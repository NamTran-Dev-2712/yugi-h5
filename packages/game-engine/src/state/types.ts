import type { RulesetConfig } from '@yugi/shared';
import type { RngState } from '../rng/seeded-rng.js';

export type Phase = 'Draw' | 'Standby' | 'Main1' | 'Battle' | 'Main2' | 'End';

export type CardPosition = 'Attack' | 'DefenseUp' | 'DefenseDown';

/**
 * Runtime instance of a card in play. `definitionId` points at a CardDefinition
 * in @yugi/shared — the engine never embeds card content, only references it.
 */
export interface CardInstance {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly position: CardPosition | null;
  readonly ownerIndex: 0 | 1;
  /*
   * Per-monster turn stamps: the `GameState.turnCount` in which the event happened. "This turn"
   * means stamp === state.turnCount, so they expire on their own (no reset). Only meaningful on the field.
   */
  /** Turn this monster was Normal/Tribute Summoned or Set. */
  readonly summonedTurn?: number;
  /** Turn this monster last had its battle position changed by ChangePosition. */
  readonly positionChangedTurn?: number;
  /** Turn this monster last attacked (written by DeclareAttack, task 1.6). */
  readonly attackedTurn?: number;
  /** Turn this Spell/Trap was Set (written by SetSpellTrap; task 3.4 reads it for `trapSetTurnDelay`). */
  readonly setTurn?: number;
}

export type PlayerZoneKey = 'hand' | 'deck' | 'graveyard' | 'banished' | 'extraDeck';

/**
 * Fixed-size board zones. `null` = empty slot. Field zone is modeled now (per
 * design decision to avoid a later state-shape migration) but stays unused
 * (always null) until Field Spell support lands.
 */
export interface BoardZones {
  readonly monsterZones: readonly [
    CardInstance | null,
    CardInstance | null,
    CardInstance | null,
    CardInstance | null,
    CardInstance | null,
  ];
  readonly spellTrapZones: readonly [
    CardInstance | null,
    CardInstance | null,
    CardInstance | null,
    CardInstance | null,
    CardInstance | null,
  ];
  readonly fieldZone: CardInstance | null;
}

export interface PlayerState {
  readonly playerId: string;
  readonly lifePoints: number;
  readonly board: BoardZones;
  readonly hand: readonly CardInstance[];
  readonly deck: readonly CardInstance[];
  readonly graveyard: readonly CardInstance[];
  readonly banished: readonly CardInstance[];
  readonly extraDeck: readonly CardInstance[];
  readonly hasNormalSummonedThisTurn: boolean;
}

/**
 * Engine asks the client for input (target selection, tribute choice, chain
 * response...) via a PendingPrompt instead of blocking. The action for the
 * prompted player must match `promptId`; other actions are rejected until
 * it's resolved. See docs/design/engine.md.
 */
export interface PendingPrompt {
  readonly promptId: string;
  readonly playerIndex: 0 | 1;
  readonly kind: string;
  readonly payload: unknown;
}

/**
 * One activation waiting on the chain (task 3.3). Cost was paid and targets were chosen when it was added; its
 * operations run only when the chain resolves (LIFO). The activated Spell lives here (face-up, public: activating it
 * revealed it) from the moment it leaves the hand until it is sent to the graveyard.
 */
export interface ChainLink {
  /** Deterministic: `link-<turnCount>-<version of the state it was activated in>`. */
  readonly linkId: string;
  readonly playerIndex: 0 | 1;
  readonly card: CardInstance;
  readonly effectId: string;
  /** 1 = Normal Spell, 2 = Quick-Play; 3 (Counter Trap) arrives with task 3.4. */
  readonly spellSpeed: 1 | 2 | 3;
  /** Cards already paid as cost (Discard/Tribute), in cost order. */
  readonly costInstanceIds: readonly string[];
  /** LP already paid as cost. */
  readonly lpPaid: number;
  /** Targets chosen at activation; re-checked at resolution. */
  readonly targetInstanceIds: readonly string[];
}

/**
 * Open response window: `priorityPlayer` may activate a chainable effect or `PassPriority`. `passCount` counts
 * consecutive passes since the last link was added; the second one resolves the whole chain. Non-null ⇔ chainStack
 * is non-empty.
 */
export interface ChainWindow {
  readonly priorityPlayer: 0 | 1;
  readonly passCount: 0 | 1;
}

export interface GameState {
  readonly matchId: string;
  readonly rng: RngState;
  /** Resolved at StartDuel; rules read this, never module constants, so replays reproduce. */
  readonly ruleset: RulesetConfig;
  readonly turnCount: number;
  readonly turnPlayerIndex: 0 | 1;
  readonly phase: Phase;
  readonly players: readonly [PlayerState, PlayerState];
  /** Bottom (index 0, chain link 1) → top. Empty outside a chain. */
  readonly chainStack: readonly ChainLink[];
  /** null = no chain in progress. */
  readonly chainWindow: ChainWindow | null;
  readonly pendingPrompt: PendingPrompt | null;
  /** null = duel ongoing; 'draw' = both players' life points hit 0 in the same action. */
  readonly winnerIndex: 0 | 1 | 'draw' | null;
  /** Bumped on every applyAction call — lets clients detect desync. See docs/design/protocol.md. */
  readonly version: number;
}
