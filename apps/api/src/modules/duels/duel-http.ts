import type { DuelErrorCode, DuelServiceError } from './duel-errors';

export interface DuelHttpError {
  readonly status: number;
  readonly body: {
    readonly statusCode: number;
    readonly code: DuelErrorCode;
    readonly message: string;
    readonly engineCode?: string;
  };
}

const STATUS: Record<DuelErrorCode, number> = {
  DUEL_NOT_FOUND: 404,
  FORBIDDEN_ACTION: 403,
  PLAYER_MISMATCH: 403,
  NOT_OWNER: 403,
  ACTION_REJECTED: 409,
  INVALID_CONFIG: 400,
  UNKNOWN_CARD: 400,
  AI_LOOP_LIMIT: 500,
  INTERNAL_ERROR: 500,
};

/** Pure mapping of a `DuelServiceError` to the HTTP status + body (INTERNAL_ERROR carries no internals). */
export function toDuelHttpError(err: DuelServiceError): DuelHttpError {
  const status = STATUS[err.code];
  return {
    status,
    body: {
      statusCode: status,
      code: err.code,
      message: err.code === 'INTERNAL_ERROR' ? 'Internal server error' : err.message,
      ...(err.engineCode !== undefined ? { engineCode: err.engineCode } : {}),
    },
  };
}
