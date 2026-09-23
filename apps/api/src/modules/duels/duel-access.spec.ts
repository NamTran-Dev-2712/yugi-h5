import { describe, expect, it } from 'vitest';
import { DuelServiceError } from './duel-errors';
import { assertMayControl, assertMayView, playerIdsFor } from './duel-access';

const meta = { mode: 'solo-debug', ownerId: 'guest-a' } as const;

function codeOf(fn: () => void): string | undefined {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DuelServiceError);
    return (e as DuelServiceError).code;
  }
  return undefined;
}

describe('duel access (solo-debug)', () => {
  it('lets the owner control and view both seats', () => {
    for (const seat of [0, 1] as const) {
      expect(codeOf(() => assertMayControl(meta, 'guest-a', seat))).toBeUndefined();
      expect(codeOf(() => assertMayView(meta, 'guest-a', seat))).toBeUndefined();
    }
  });

  it('rejects any other guest with NOT_OWNER for both control and view', () => {
    for (const seat of [0, 1] as const) {
      expect(codeOf(() => assertMayControl(meta, 'guest-b', seat))).toBe('NOT_OWNER');
      expect(codeOf(() => assertMayView(meta, 'guest-b', seat))).toBe('NOT_OWNER');
    }
  });

  it('fails closed when the session has no owner or no mode', () => {
    expect(codeOf(() => assertMayView({}, 'guest-a', 0))).toBe('NOT_OWNER');
    expect(codeOf(() => assertMayControl({ ownerId: 'guest-a' }, 'guest-a', 0))).toBe('NOT_OWNER');
    expect(codeOf(() => assertMayControl({ mode: 'solo-debug' }, 'guest-a', 0))).toBe('NOT_OWNER');
  });

  it('derives two distinct engine player ids from the owner', () => {
    const ids = playerIdsFor('solo-debug', 'guest-a');
    expect(ids).toEqual(['guest-a:0', 'guest-a:1']);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
