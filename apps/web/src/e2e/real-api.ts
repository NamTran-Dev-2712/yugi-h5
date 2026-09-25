import { createDuelApi, type DuelApi } from '../api/duel-api';

/** Real `fetch` against the running API; waits and retries when the throttler answers 429. */
export const BASE = process.env.API_BASE ?? 'http://localhost:3000';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function createRealApi(): DuelApi {
  const store = new Map<string, string>();
  return createDuelApi({
    baseUrl: BASE,
    storage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    },
    fetch: async (url, init) => {
      for (let attempt = 0; attempt < 8; attempt++) {
        const res = await fetch(url, init);
        if (res.status !== 429) return res;
        const wait = Number(res.headers.get('retry-after') ?? '5');
        await sleep(Math.max(1, wait) * 1000);
      }
      return fetch(url, init);
    },
  });
}
