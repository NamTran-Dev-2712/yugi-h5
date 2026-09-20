export interface StartDuelAction {
  readonly type: 'StartDuel';
  readonly payload: {
    readonly matchId: string;
    readonly seed: string;
    readonly playerIds: readonly [string, string];
    /** Card definition ids in deck order (pre-shuffle), one list per player. */
    readonly deckLists: readonly [readonly string[], readonly string[]];
  };
}

export interface DrawAction {
  readonly type: 'Draw';
  readonly payload: {
    readonly playerIndex: 0 | 1;
    readonly count: number;
  };
}

/**
 * Skeleton union — grows through M1/M2 with NormalSummon, SetMonster,
 * ChangePosition, DeclareAttack, ActivateEffect, PassPriority, EndPhase, etc.
 * See docs/design/engine.md for the full target list.
 */
export type Action = StartDuelAction | DrawAction;

export interface ActionContext {
  /** Reserved for cross-cutting concerns injected by the caller (e.g. logging hooks). Never a source of nondeterminism. */
  readonly now?: never;
}
