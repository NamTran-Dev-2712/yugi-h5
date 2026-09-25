import type { EngineErrorCode } from '@yugi/game-engine';

/** Stable, machine-readable reason a DuelService call failed. Controllers (2.3) map these to HTTP/socket errors. */
export type DuelErrorCode =
  | 'DUEL_NOT_FOUND'
  | 'INVALID_CONFIG'
  | 'UNKNOWN_CARD'
  | 'INVALID_SCENARIO'
  | 'PLAYER_MISMATCH'
  | 'FORBIDDEN_ACTION'
  | 'NOT_OWNER'
  | 'ACTION_REJECTED'
  | 'AI_LOOP_LIMIT'
  | 'INTERNAL_ERROR';

export class DuelServiceError extends Error {
  readonly code: DuelErrorCode;
  /** Set only for `ACTION_REJECTED`: the game-engine's own reason (e.g. `NOT_TURN_PLAYER`). */
  readonly engineCode?: EngineErrorCode;

  constructor(code: DuelErrorCode, message: string, engineCode?: EngineErrorCode) {
    super(message);
    this.name = 'DuelServiceError';
    this.code = code;
    if (engineCode !== undefined) this.engineCode = engineCode;
  }
}
