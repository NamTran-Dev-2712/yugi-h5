import { createDuelApi, type TokenStorage } from '../api/duel-api';
import { mountDebugPage } from './debug-page';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

function browserStorage(): TokenStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined; // blocked (private window, disabled site data)
  }
}

const root = document.getElementById('debug-root');
if (!root) throw new Error('debug.html has no #debug-root');

mountDebugPage({
  api: createDuelApi({
    baseUrl,
    fetch: (url, init) => window.fetch(url, init),
    storage: browserStorage(),
  }),
  root,
});
