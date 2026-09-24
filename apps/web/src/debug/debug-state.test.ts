import type { EventView, StateView } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { DuelApiError } from '../api/duel-api';
import {
  applyActionError,
  applyActionSuccess,
  formatApiError,
  initialDebugState,
  type DebugState,
} from './debug-state';

const viewA = { version: 3, viewerIndex: 0 } as unknown as StateView;
const viewB = { version: 4, viewerIndex: 0 } as unknown as StateView;

const base = (): DebugState => ({
  ...initialDebugState,
  duelId: 'd-1',
  view: viewA,
  log: ['first'],
  raw: { some: 'response' },
});

const rejected = new DuelApiError(
  409,
  { code: 'ACTION_REJECTED', engineCode: 'NOT_TURN_PLAYER', message: 'Not your turn' },
  'HTTP_ERROR',
);

describe('applyActionError', () => {
  it('keeps the view (same reference) and the raw JSON: a rejected action changes no state', () => {
    const next = applyActionError(base(), rejected);
    expect(next.view).toBe(viewA);
    expect(next.raw).toEqual({ some: 'response' });
    expect(next.duelId).toBe('d-1');
  });

  it('shows status, code and engineCode on screen and in the log', () => {
    const next = applyActionError(base(), rejected);
    expect(next.error).toContain('409');
    expect(next.error).toContain('ACTION_REJECTED');
    expect(next.error).toContain('NOT_TURN_PLAYER');
    expect(next.log.at(-1)).toContain('NOT_TURN_PLAYER');
    expect(next.log[0]).toBe('first');
  });

  it('handles an error that is not a DuelApiError', () => {
    const next = applyActionError(base(), new Error('boom'));
    expect(next.view).toBe(viewA);
    expect(next.error).toContain('boom');
  });
});

describe('formatApiError', () => {
  it('lists validation issues of a 400', () => {
    const err = new DuelApiError(
      400,
      {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        issues: [{ path: 'action.payload.zoneIndex', message: 'Too big' }],
      },
      'HTTP_ERROR',
    );
    const text = formatApiError(err);
    expect(text).toContain('400');
    expect(text).toContain('VALIDATION_FAILED');
    expect(text).toContain('action.payload.zoneIndex');
  });

  it('describes a network failure', () => {
    const text = formatApiError(
      new DuelApiError(0, { message: 'Failed to fetch' }, 'NETWORK_ERROR'),
    );
    expect(text).toContain('NETWORK_ERROR');
    expect(text).toContain('Failed to fetch');
  });
});

describe('applyActionSuccess', () => {
  const events: EventView[] = [{ type: 'DamageDealt', playerIndex: 1, amount: 100 }];

  it('replaces the view, clears the error, appends described events and keeps the raw response', () => {
    const before = applyActionError(base(), rejected);
    const response = { view: viewB, events };
    const next = applyActionSuccess(before, response, () => ['P1 mất 100 LP']);
    expect(next.view).toBe(viewB);
    expect(next.error).toBeNull();
    expect(next.log).toEqual([...before.log, 'P1 mất 100 LP']);
    expect(next.raw).toBe(response);
  });

  it('describes events against the NEW view (labels of cards that just appeared)', () => {
    let seen: StateView | undefined;
    applyActionSuccess(base(), { view: viewB, events }, (_events, view) => {
      seen = view;
      return [];
    });
    expect(seen).toBe(viewB);
  });
});
