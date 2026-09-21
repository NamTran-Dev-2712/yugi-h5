/** Machine-readable reason an action was rejected. Stable: callers (API, tests) branch on it, never on `message`. */
export type EngineErrorCode =
  | 'NO_STATE'
  | 'UNHANDLED_ACTION'
  | 'INVALID_STARTING_LP'
  | 'DUEL_ENDED'
  | 'PENDING_PROMPT'
  | 'NOT_TURN_PLAYER'
  | 'WRONG_PHASE'
  | 'NORMAL_SUMMON_USED'
  | 'INVALID_ZONE'
  | 'CARD_NOT_IN_HAND'
  | 'NO_CARD_RESOLVER'
  | 'CARD_DEFINITION_NOT_FOUND'
  | 'NOT_A_MONSTER'
  | 'TRIBUTE_COUNT_MISMATCH'
  | 'INVALID_TRIBUTE'
  | 'ZONE_OCCUPIED';

/** Thrown by `applyAction` when an action is illegal. `message` is for humans; `code` is the contract. */
export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}
