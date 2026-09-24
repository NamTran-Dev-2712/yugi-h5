import type { EventView, PlayerAction, StateView } from '@yugi/shared';
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
    const legalActions: PlayerAction[] = [{ type: 'EndPhase', payload: { playerIndex: 1 } }];
    const response = { view: viewB, events, legalActions };
    const next = applyActionSuccess(before, response, () => ['P1 mất 100 LP']);
    expect(next.view).toBe(viewB);
    expect(next.legalActions).toBe(legalActions);
    expect(next.error).toBeNull();
    expect(next.log).toEqual([...before.log, 'P1 mất 100 LP']);
    expect(next.raw).toBe(response);
  });

  it('describes events against the NEW view (labels of cards that just appeared)', () => {
    let seen: StateView | undefined;
    applyActionSuccess(base(), { view: viewB, events, legalActions: [] }, (_events, view) => {
      seen = view;
      return [];
    });
    expect(seen).toBe(viewB);
  });
});

describe('applyActionSuccess with AI actions', () => {
  const events: EventView[] = [
    { type: 'DamageDealt', playerIndex: 0, amount: 100 }, // 0: the human's own
    { type: 'DamageDealt', playerIndex: 0, amount: 200 }, // 1: AI action 1
    { type: 'DamageDealt', playerIndex: 0, amount: 300 }, // 2: AI action 2
  ];
  const aiActions = [
    { action: { type: 'EndPhase', payload: { playerIndex: 1 } }, eventsFrom: 1, eventsTo: 2 },
    { action: { type: 'EndPhase', payload: { playerIndex: 1 } }, eventsFrom: 2, eventsTo: 3 },
  ] as const;
  const describe1 = (evs: readonly EventView[]) =>
    evs.map((e) => (e.type === 'DamageDealt' ? `-${e.amount}` : e.type));

  it('puts each AI action line before the events it caused, after the human events', () => {
    const next = applyActionSuccess(
      base(),
      { view: viewB, events, legalActions: [], aiActions },
      describe1,
      (a) => `AI ${a.type}`,
    );
    expect(next.log).toEqual(['first', '-100', 'AI EndPhase', '-200', 'AI EndPhase', '-300']);
  });

  it('never drops an event when slices do not cover everything', () => {
    const next = applyActionSuccess(
      base(),
      { view: viewB, events, legalActions: [], aiActions: [aiActions[0]] },
      describe1,
      () => 'AI x',
    );
    expect(next.log).toEqual(['first', '-100', 'AI x', '-200', '-300']);
  });

  it('logs the plain event list when there are no AI actions', () => {
    const next = applyActionSuccess(
      base(),
      { view: viewB, events, legalActions: [], aiActions: [] },
      describe1,
      () => 'AI x',
    );
    expect(next.log).toEqual(['first', '-100', '-200', '-300']);
  });
});
