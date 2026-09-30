/**
 * Tiny HTTP helpers for the dev scripts in tools/. Run them with Node 22:
 *   node --experimental-strip-types tools/<script>.ts
 * No dependencies; not part of any package build. The API throttles to ~120 requests/minute, so `call` waits when the
 * server says the budget is nearly spent.
 */

export const BASE = process.env.API_BASE ?? 'http://localhost:3000';

export type Seat = 0 | 1;

export interface CardV {
  hidden: boolean;
  instanceId: string;
  definitionId?: string;
  position?: string | null;
  /** Task 3.4b: face-up monsters only. */
  effectiveStats?: { atk: number; def: number };
  /** Task 4.2d: face-up Equip cards only (the monster they are equipped to). */
  equippedTo?: string;
}

export interface PlayerV {
  lifePoints: number;
  hand: CardV[];
  handCount: number;
  deckCount: number;
  graveyard: CardV[];
  board: { monsterZones: (CardV | null)[]; spellTrapZones?: (CardV | null)[] };
}

export interface ViewV {
  version: number;
  viewerIndex: Seat;
  turnCount: number;
  turnPlayerIndex: Seat;
  phase: string;
  winnerIndex: Seat | 'draw' | null;
  pendingPrompt: {
    promptId: string;
    playerIndex: Seat;
    kind: string;
    payload: { count?: number };
  } | null;
  players: [PlayerV, PlayerV];
  /** Task 3.4b: open chain / reaction window (who holds priority). */
  chainWindow?: { priorityPlayer: Seat; passCount: number; reactionTo?: { kind: string } } | null;
  chain?: unknown[];
}

export interface EventV {
  type: string;
  [key: string]: unknown;
}

export interface Reply {
  status: number;
  json: unknown;
  text: string;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function call(
  method: 'GET' | 'POST',
  path: string,
  opts: { token?: string; body?: unknown; rawBody?: string; origin?: string } = {},
): Promise<Reply> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.origin) headers.Origin = opts.origin;
  let body: string | undefined;
  if (opts.rawBody !== undefined) body = opts.rawBody;
  else if (opts.body !== undefined) body = JSON.stringify(opts.body);
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
    });
    const text = await res.text();
    const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? '99');
    const reset = Number(res.headers.get('x-ratelimit-reset') ?? '0');
    if (res.status === 429) {
      await sleep((reset || 60) * 1000 + 500);
      continue;
    }
    if (remaining <= 2 && reset > 0) await sleep(reset * 1000 + 500);
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, json, text };
  }
  throw new Error('rate limited repeatedly');
}

/** Objects that name a hidden instance id but still carry a definitionId are leaks. */
export function findLeaks(node: unknown, hidden: ReadonlySet<string>, path = '$'): string[] {
  if (Array.isArray(node)) return node.flatMap((n, i) => findLeaks(n, hidden, `${path}[${i}]`));
  if (typeof node !== 'object' || node === null) return [];
  const obj = node as Record<string, unknown>;
  const own =
    typeof obj.instanceId === 'string' && hidden.has(obj.instanceId) && 'definitionId' in obj
      ? [`${path} shows definitionId of hidden ${obj.instanceId}`]
      : [];
  return [...own, ...Object.entries(obj).flatMap(([k, v]) => findLeaks(v, hidden, `${path}.${k}`))];
}

/** Cards `owner` holds that the other seat must not identify: whole hand + face-down monsters (seen by the owner). */
export function hiddenFrom(ownerView: ViewV, owner: Seat): Set<string> {
  const p = ownerView.players[owner];
  const ids = new Set<string>(p.hand.map((c) => c.instanceId));
  for (const c of p.board.monsterZones) {
    if (c && !c.hidden && c.position === 'DefenseDown') ids.add(c.instanceId);
  }
  return ids;
}
