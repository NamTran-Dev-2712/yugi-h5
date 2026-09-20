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

/**
 * Skeleton union — grows through M1/M2 with CardSummoned, AttackDeclared,
 * DamageDealt, PositionChanged, ChainLinkAdded, etc. FE animates purely from
 * this stream; it never re-derives game logic client-side.
 */
export type GameEvent = DuelStartedEvent | CardDrawnEvent | DeckOutEvent;
