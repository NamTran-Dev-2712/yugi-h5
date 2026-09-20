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

export interface GameState {
  readonly matchId: string;
  readonly rng: RngState;
  /** Resolved at StartDuel; rules read this, never module constants, so replays reproduce. */
  readonly ruleset: RulesetConfig;
  readonly turnCount: number;
  readonly turnPlayerIndex: 0 | 1;
  readonly phase: Phase;
  readonly players: readonly [PlayerState, PlayerState];
  readonly chainStack: readonly unknown[];
  readonly pendingPrompt: PendingPrompt | null;
  readonly winnerIndex: 0 | 1 | null;
  /** Bumped on every applyAction call — lets clients detect desync. See docs/design/protocol.md. */
  readonly version: number;
}
