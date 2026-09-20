import type { RulesetConfig } from '@yugi/shared';

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

/**
 * Skeleton union — grows through M1/M2 with NormalSummon, SetMonster,
 * ChangePosition, DeclareAttack, ActivateEffect, PassPriority, etc.
 * See docs/design/engine.md for the full target list.
 */
export type Action = StartDuelAction | DrawAction | EndPhaseAction;

export interface ActionContext {
  /** Reserved for cross-cutting concerns injected by the caller (e.g. logging hooks). Never a source of nondeterminism. */
  readonly now?: never;
}
