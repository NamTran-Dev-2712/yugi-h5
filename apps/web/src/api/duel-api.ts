import type {
  ApiErrorBody,
  CreateSoloResponse,
  GetViewResponse,
  GuestResponse,
  PlayerAction,
  PlayerIndex,
  SoloMode,
  ValidationIssue,
  ViewResponse,
} from '@yugi/shared';

/** Thin HTTP client for the duel endpoints. No game logic: it sends what it is told and reports what came back. */

export interface TokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The slice of `fetch` this client uses (the real `fetch` fits; tests pass a mock). */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface DuelApiDeps {
  readonly baseUrl: string;
  readonly fetch: FetchLike;
  /** Where the guest token survives reloads (localStorage). Optional: without it a new guest is made per page load. */
  readonly storage?: TokenStorage | undefined;
}

export interface CreateSoloBody {
  readonly deck?: readonly string[];
  readonly decks?: readonly [readonly string[], readonly string[]];
  readonly viewer?: PlayerIndex;
  /** Default `solo-debug`; `solo-vs-ai` = the server plays seat 1. */
  readonly mode?: SoloMode;
}

/** Every non-2xx answer (and a network failure, as status 0) becomes one of these. */
export class DuelApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly engineCode: string | undefined;
  readonly issues: readonly ValidationIssue[] | undefined;

  constructor(status: number, body: Partial<ApiErrorBody>, fallbackCode: string) {
    super(body.message ?? `HTTP ${status}`);
    this.name = 'DuelApiError';
    this.status = status;
    this.code = body.code ?? fallbackCode;
    this.engineCode = body.engineCode;
    this.issues = body.issues;
  }
}

const TOKEN_KEY = 'yugi.guestToken';

export interface DuelApi {
  /** Returns the guest access token, creating a guest the first time. */
  ensureGuest(): Promise<string>;
  createSolo(body?: CreateSoloBody): Promise<CreateSoloResponse>;
  getView(duelId: string, viewer: PlayerIndex): Promise<GetViewResponse>;
  submitAction(
    duelId: string,
    playerIndex: PlayerIndex,
    action: PlayerAction,
  ): Promise<ViewResponse>;
}

export function createDuelApi(deps: DuelApiDeps): DuelApi {
  const { baseUrl, storage } = deps;
  let token: string | null = null;

  const readStored = (): string | null => {
    try {
      return storage?.getItem(TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  };
  const writeStored = (value: string | null): void => {
    try {
      if (value === null) storage?.removeItem(TOKEN_KEY);
      else storage?.setItem(TOKEN_KEY, value);
    } catch {
      /* storage blocked: the token just lives in memory */
    }
  };

  async function send<T>(path: string, init: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await deps.fetch(`${baseUrl}${path}`, init);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Network error';
      throw new DuelApiError(0, { message }, 'NETWORK_ERROR');
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    if (!res.ok) {
      if (res.status === 401) {
        token = null;
        writeStored(null);
      }
      const parsed =
        typeof body === 'object' && body !== null ? (body as Partial<ApiErrorBody>) : {};
      throw new DuelApiError(res.status, parsed, 'HTTP_ERROR');
    }
    return body as T;
  }

  async function ensureGuest(): Promise<string> {
    token ??= readStored();
    if (token !== null) return token;
    const guest = await send<GuestResponse>('/auth/guest', { method: 'POST' });
    token = guest.accessToken;
    writeStored(token);
    return token;
  }

  async function authed<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
    const { json, ...rest } = init;
    const accessToken = await ensureGuest();
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    if (json !== undefined) headers['Content-Type'] = 'application/json';
    return send<T>(path, {
      ...rest,
      headers,
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    });
  }

  return {
    ensureGuest,
    createSolo: (body = {}) => authed('/duels/solo', { method: 'POST', json: body }),
    getView: (duelId, viewer) =>
      authed(`/duels/${encodeURIComponent(duelId)}?viewer=${viewer}`, { method: 'GET' }),
    submitAction: (duelId, playerIndex, action) =>
      authed(`/duels/${encodeURIComponent(duelId)}/actions`, {
        method: 'POST',
        json: { playerIndex, action },
      }),
  };
}
