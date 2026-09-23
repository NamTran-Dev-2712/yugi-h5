import { describe, expect, it } from 'vitest';
import { DuelServiceError, type DuelErrorCode } from './duel-errors';
import { toDuelHttpError } from './duel-http';

const CASES: [DuelErrorCode, number][] = [
  ['DUEL_NOT_FOUND', 404],
  ['FORBIDDEN_ACTION', 403],
  ['PLAYER_MISMATCH', 403],
  ['NOT_OWNER', 403],
  ['ACTION_REJECTED', 409],
  ['INVALID_CONFIG', 400],
  ['UNKNOWN_CARD', 400],
  ['INTERNAL_ERROR', 500],
];

describe('toDuelHttpError', () => {
  it.each(CASES)('maps %s to HTTP %i', (code, status) => {
    const { status: s, body } = toDuelHttpError(new DuelServiceError(code, 'msg'));
    expect(s).toBe(status);
    expect(body.statusCode).toBe(status);
    expect(body.code).toBe(code);
  });

  it('carries engineCode for ACTION_REJECTED', () => {
    const { body } = toDuelHttpError(
      new DuelServiceError('ACTION_REJECTED', 'not your turn', 'NOT_TURN_PLAYER'),
    );
    expect(body.engineCode).toBe('NOT_TURN_PLAYER');
  });

  it('never leaks the internal message or stack for INTERNAL_ERROR', () => {
    const err = new DuelServiceError('INTERNAL_ERROR', 'boom: secret detail');
    const { body } = toDuelHttpError(err);
    expect(JSON.stringify(body)).not.toContain('secret detail');
    expect(JSON.stringify(body)).not.toContain('stack');
  });
});
