import { describe, expect, it, vi } from 'vitest';
import { createDuelApi, DuelApiError, type TokenStorage } from './duel-api';

const BASE = 'http://api.test';

function memoryStorage(
  initial: Record<string, string> = {},
): TokenStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

interface Reply {
  status?: number;
  body?: unknown;
  rawText?: string;
}

/** A fetch that answers with the queued replies in order and records every call. */
function fakeFetch(...replies: Reply[]) {
  const queue = [...replies];
  return vi.fn(async (_url: string, _init?: RequestInit) => {
    const r = queue.shift();
    if (!r) throw new Error('unexpected extra fetch call');
    const status = r.status ?? 200;
    return new Response(r.rawText ?? JSON.stringify(r.body ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

const guestReply = (token = 'tok-1'): Reply => ({
  status: 201,
  body: { guestId: 'g-1', accessToken: token },
});

describe('ensureGuest', () => {
  it('creates a guest on first use and stores the token', async () => {
    const fetch = fakeFetch(guestReply());
    const storage = memoryStorage();
    const api = createDuelApi({ baseUrl: BASE, fetch, storage });
    expect(await api.ensureGuest()).toBe('tok-1');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe(`${BASE}/auth/guest`);
    expect(fetch.mock.calls[0]![1]?.method).toBe('POST');
    expect([...storage.data.values()].join('|')).toContain('tok-1');
  });

  it('reuses the stored token without calling the server, even from a new api instance', async () => {
    const storage = memoryStorage();
    const first = createDuelApi({ baseUrl: BASE, fetch: fakeFetch(guestReply()), storage });
    await first.ensureGuest();
    const fetch = fakeFetch();
    const second = createDuelApi({ baseUrl: BASE, fetch, storage });
    expect(await second.ensureGuest()).toBe('tok-1');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('works when storage is missing or throws', async () => {
    const throwing: TokenStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    for (const storage of [undefined, throwing]) {
      const api = createDuelApi({ baseUrl: BASE, fetch: fakeFetch(guestReply()), storage });
      expect(await api.ensureGuest()).toBe('tok-1');
    }
  });
});

describe('duel calls', () => {
  it('createSolo sends the bearer token and a JSON body, and returns the parsed response', async () => {
    const created = { duelId: 'd-1', mode: 'solo-debug', viewer: 0, view: {}, events: [] };
    const fetch = fakeFetch(guestReply(), { status: 201, body: created });
    const api = createDuelApi({ baseUrl: BASE, fetch, storage: memoryStorage() });
    expect(await api.createSolo({ viewer: 1 })).toEqual(created);
    const [url, init] = fetch.mock.calls[1]!;
    expect(url).toBe(`${BASE}/duels/solo`);
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init?.body as string)).toEqual({ viewer: 1 });
  });

  it('createSandbox posts the scenario to the dev endpoint with the mode in the query', async () => {
    const created = {
      duelId: 'd-9',
      mode: 'solo-vs-ai',
      viewer: 0,
      view: {},
      events: [],
      legalActions: [],
    };
    const fetch = fakeFetch(
      guestReply(),
      { status: 201, body: created },
      { status: 201, body: created },
    );
    const api = createDuelApi({ baseUrl: BASE, fetch, storage: memoryStorage() });
    const scenario = { name: 'x' } as never;
    expect(await api.createSandbox(scenario)).toEqual(created);
    const [url, init] = fetch.mock.calls[1]!;
    expect(url).toBe(`${BASE}/dev/sandbox/duels?mode=solo-vs-ai`);
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'x' });
    await api.createSandbox(scenario, 'solo-debug');
    expect(fetch.mock.calls[2]![0]).toBe(`${BASE}/dev/sandbox/duels?mode=solo-debug`);
  });

  it('getView asks for the requested seat', async () => {
    const fetch = fakeFetch(guestReply(), { body: { view: { viewerIndex: 1 } } });
    const api = createDuelApi({ baseUrl: BASE, fetch, storage: memoryStorage() });
    await api.getView('d 1', 1);
    expect(fetch.mock.calls[1]![0]).toBe(`${BASE}/duels/d%201?viewer=1`);
    expect(fetch.mock.calls[1]![1]?.method ?? 'GET').toBe('GET');
  });

  it('submitAction posts the envelope {playerIndex, action}', async () => {
    const fetch = fakeFetch(guestReply(), { body: { view: {}, events: [] } });
    const api = createDuelApi({ baseUrl: BASE, fetch, storage: memoryStorage() });
    const action = { type: 'EndPhase', payload: { playerIndex: 0 } } as const;
    await api.submitAction('d-1', 0, action);
    const [url, init] = fetch.mock.calls[1]!;
    expect(url).toBe(`${BASE}/duels/d-1/actions`);
    expect(JSON.parse(init?.body as string)).toEqual({ playerIndex: 0, action });
  });
});

describe('errors', () => {
  it('turns a 409 into a DuelApiError with status, code and engineCode', async () => {
    const fetch = fakeFetch(guestReply(), {
      status: 409,
      body: {
        statusCode: 409,
        code: 'ACTION_REJECTED',
        engineCode: 'NOT_TURN_PLAYER',
        message: 'nope',
      },
    });
    const api = createDuelApi({ baseUrl: BASE, fetch, storage: memoryStorage() });
    const err = await api
      .submitAction('d-1', 1, { type: 'EndPhase', payload: { playerIndex: 1 } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DuelApiError);
    expect(err).toMatchObject({
      status: 409,
      code: 'ACTION_REJECTED',
      engineCode: 'NOT_TURN_PLAYER',
      message: 'nope',
    });
  });

  it('keeps the validation issues of a 400', async () => {
    const issues = [{ path: 'action.payload.zoneIndex', message: 'Too big' }];
    const fetch = fakeFetch(guestReply(), {
      status: 400,
      body: { statusCode: 400, code: 'VALIDATION_FAILED', message: 'bad', issues },
    });
    const api = createDuelApi({ baseUrl: BASE, fetch, storage: memoryStorage() });
    const err = (await api.getView('d-1', 0).catch((e: unknown) => e)) as DuelApiError;
    expect(err.status).toBe(400);
    expect(err.issues).toEqual(issues);
  });

  it('a 401 forgets the stored token so the next call gets a fresh guest', async () => {
    const storage = memoryStorage();
    const fetch = fakeFetch(
      guestReply('old'),
      { status: 401, body: { statusCode: 401 } },
      guestReply('new'),
    );
    const api = createDuelApi({ baseUrl: BASE, fetch, storage });
    await expect(api.getView('d-1', 0)).rejects.toMatchObject({ status: 401 });
    expect(await api.ensureGuest()).toBe('new');
  });

  it('wraps a network failure as status 0 NETWORK_ERROR', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const api = createDuelApi({ baseUrl: BASE, fetch, storage: memoryStorage() });
    await expect(api.ensureGuest()).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('copes with an error body that is not JSON', async () => {
    const fetch = fakeFetch(guestReply(), { status: 502, rawText: '<html>bad gateway</html>' });
    const api = createDuelApi({ baseUrl: BASE, fetch, storage: memoryStorage() });
    await expect(api.getView('d-1', 0)).rejects.toMatchObject({ status: 502 });
  });
});
