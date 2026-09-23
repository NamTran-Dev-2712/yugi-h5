import type { CardDefinition, RulesetConfig } from '@yugi/shared';
import type { CardPosition } from '../state/types.js';

export interface StartDuelAction {
  readonly type: 'StartDuel';
  readonly payload: {
    readonly matchId: string;
    readonly seed: string;
    readonly playerIds: readonly [string, string];
    /** Card definition ids in deck order (pre-shuffle), one list per player. */
    readonly deckLists: readonly [readonly string[], readonly string[]];
    /** Overrides applied on top of the default (early Master Rule) ruleset. */
    readonly ruleset?: Partial<RulesetConfig>;
    /** C2 [DECISION]: per-side starting LP; wins over `ruleset.startingLP`. Each value is an integer >= 1. */
    readonly startingLP?: readonly [number, number];
  };
}

export interface DrawAction {
  readonly type: 'Draw';
  readonly payload: {
    readonly playerIndex: 0 | 1;
    readonly count: number;
  };
}

/** Advances to the next phase; leaving `End` passes the turn. Only the turn player may send it. */
export interface EndPhaseAction {
  readonly type: 'EndPhase';
  readonly payload: {
    readonly playerIndex: 0 | 1;
  };
}

interface MonsterFromHandPayload {
  readonly playerIndex: 0 | 1;
  /** `CardInstance.instanceId` of a card in the caller's hand. */
  readonly cardInstanceId: string;
  /** Target monster zone, 0-4 (matches the drag-and-drop slot). */
  readonly zoneIndex: number;
  /**
   * Monsters on the caller's own field (face-up or face-down) to Tribute. Defaults to none.
   * The count must match the monster's Level: 1-4 → 0, 5-6 → 1, 7+ → 2 [RULE].
   * `zoneIndex` may point at a tributed monster's zone (it counts as empty after the Tribute).
   */
  readonly tributeInstanceIds?: readonly string[];
}

/** Face-up Attack Position Normal Summon (Tribute Summon for Level 5+). Uses the turn's Normal Summon. */
export interface NormalSummonAction {
  readonly type: 'NormalSummon';
  readonly payload: MonsterFromHandPayload;
}

/** Face-down Defense Position Set (Tribute Set for Level 5+). Uses the turn's Normal Summon. */
export interface SetMonsterAction {
  readonly type: 'SetMonster';
  readonly payload: MonsterFromHandPayload;
}

/**
 * Switches a face-up monster between Attack and face-up Defense. `toPosition` is explicit (never a toggle) so a
 * client holding a stale view cannot flip a monster the wrong way. Face-down monsters are Flip Summoned instead.
 */
export interface ChangePositionAction {
  readonly type: 'ChangePosition';
  readonly payload: {
    readonly playerIndex: 0 | 1;
    /** `CardInstance.instanceId` of a monster on the caller's own field. */
    readonly cardInstanceId: string;
    readonly toPosition: Extract<CardPosition, 'Attack' | 'DefenseUp'>;
  };
}

/**
 * A face-up Attack Position monster declares an attack on an opponent's monster, or
 * directly on their life points if their field is empty. `targetInstanceId` omitted/null
 * means a direct attack; the engine still validates that a direct attack is legal (the
 * opponent must have zero monsters, face-up or face-down).
 */
export interface DeclareAttackAction {
  readonly type: 'DeclareAttack';
  readonly payload: {
    readonly playerIndex: 0 | 1;
    /** `CardInstance.instanceId` of a face-up Attack Position monster on the caller's own field. */
    readonly attackerInstanceId: string;
    /** `CardInstance.instanceId` of a monster on the opponent's field; omitted/null = direct attack. */
    readonly targetInstanceId?: string | null;
  };
}

/** Concede the duel; the opponent wins. Legal for either player in any phase while the duel is running. */
export interface SurrenderAction {
  readonly type: 'Surrender';
  readonly payload: {
    readonly playerIndex: 0 | 1;
  };
}

/**
 * Answers `state.pendingPrompt` (must match `promptId` and `playerIndex`). `cardInstanceIds` is the answer to a
 * `DiscardToHandLimit` prompt: exactly `payload.count` distinct cards from the caller's hand. Later prompt kinds
 * will add their own answer fields.
 */
export interface ResolvePendingPromptAction {
  readonly type: 'ResolvePendingPrompt';
  readonly payload: {
    readonly playerIndex: 0 | 1;
    readonly promptId: string;
    readonly cardInstanceIds: readonly string[];
  };
}

/**
 * Skeleton union — grows through M1/M2 with
 * ActivateEffect, PassPriority, etc.
 * See docs/design/engine.md for the full target list.
 */
export type Action =
  | StartDuelAction
  | DrawAction
  | EndPhaseAction
  | NormalSummonAction
  | SetMonsterAction
  | ChangePositionAction
  | DeclareAttackAction
  | SurrenderAction
  | ResolvePendingPromptAction;

export interface ActionContext {
  /** Reserved for cross-cutting concerns injected by the caller (e.g. logging hooks). Never a source of nondeterminism. */
  readonly now?: never;
  /** Resolves card content (level, kind...) from packages/shared data; the engine never hardcodes cards. Required; must be a pure lookup. */
  readonly cardDefinitions: (definitionId: string) => CardDefinition | undefined;
}
