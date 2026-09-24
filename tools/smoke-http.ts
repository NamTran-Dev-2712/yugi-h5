/**
 * Smoke test of the real HTTP API (needs `pnpm dev` / a running API + Postgres). Writes every request/response to
 * docs/ai/review-packets/task-2.4-smoke.md and exits 1 if any check fails.
 *   node --experimental-strip-types tools/smoke-http.ts
 */
import { writeFileSync } from 'node:fs';
import {
  call,
  findLeaks,
  hiddenFrom,
  BASE,
  type EventV,
  type Reply,
  type ViewV,
} from './lib/http.ts';

const OUT = 'docs/ai/review-packets/task-2.4-smoke.md';
const md: string[] = [
  '# Task 2.4 — Smoke test HTTP thật',
  '',
  `Sinh bởi \`tools/smoke-http.ts\` lúc ${new Date().toISOString()} (API: ${BASE}). Token được rút gọn; view dài bị cắt khi in (kiểm tra rò rỉ chạy trên bản đầy đủ).`,
  '',
];
const results: { name: string; ok: boolean; detail: string }[] = [];

const short = (s: string, n = 2600): string =>
  s.length > n ? `${s.slice(0, n)}\n… (cắt ${s.length - n} ký tự)` : s;
const redact = (s: string): string =>
  s.replace(/"accessToken":"([^"]{12})[^"]*"/g, '"accessToken":"$1…"');

function record(
  title: string,
  method: string,
  path: string,
  body: unknown,
  r: Reply,
  auth: boolean,
): void {
  md.push(
    `## ${title}`,
    '',
    '```http',
    `${method} ${path}${auth ? '   (Authorization: Bearer <token>)' : ''}`,
    '```',
  );
  if (body !== undefined)
    md.push(
      'Request body:',
      '```json',
      typeof body === 'string' ? body : JSON.stringify(body),
      '```',
    );
  md.push(
    `Response **${r.status}**:`,
    '```json',
    short(redact(r.json === null ? r.text : JSON.stringify(r.json, null, 2))),
    '```',
    '',
  );
}

function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  md.push(`- ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

interface Created {
  duelId: string;
  view: ViewV;
  events: EventV[];
}

async function main(): Promise<void> {
  const health = await call('GET', '/health');
  record('0. Health', 'GET', '/health', undefined, health, false);
  check(
    'health ok + database ok',
    health.status === 200 && JSON.stringify(health.json).includes('"database":"ok"'),
  );

  const guestRes = await call('POST', '/auth/guest', { origin: 'http://localhost:5173' });
  record('1. Tạo guest', 'POST', '/auth/guest', undefined, guestRes, false);
  const token = (guestRes.json as { accessToken: string }).accessToken;
  check(
    'POST /auth/guest → 201 có accessToken',
    guestRes.status === 201 && typeof token === 'string',
  );

  const pre = await fetch(`${BASE}/auth/guest`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' },
  });
  check(
    'CORS preflight từ http://localhost:5173 được phép',
    pre.headers.get('access-control-allow-origin') === 'http://localhost:5173',
  );

  const created = await call('POST', '/duels/solo', { token, body: {} });
  record('2. Tạo duel solo (starter deck, viewer 0)', 'POST', '/duels/solo', {}, created, true);
  const duel = created.json as Created;
  check('POST /duels/solo → 201', created.status === 201);
  check(
    'tay P0 thấy đủ 5 lá, tay P1 ẩn hết',
    duel.view.players[0].hand.every((c) => !c.hidden) &&
      duel.view.players[1].hand.every((c) => c.hidden) &&
      duel.view.players[0].hand.length === 5,
  );
  const id = duel.duelId;

  const g0 = await call('GET', `/duels/${id}?viewer=0`, { token });
  const g1 = await call('GET', `/duels/${id}?viewer=1`, { token });
  record('3a. Xem duel là viewer 0', 'GET', `/duels/${id}?viewer=0`, undefined, g0, true);
  record('3b. Xem duel là viewer 1', 'GET', `/duels/${id}?viewer=1`, undefined, g1, true);
  const v0 = (g0.json as { view: ViewV }).view;
  const v1 = (g1.json as { view: ViewV }).view;

  const p1Hidden = hiddenFrom(v1, 1);
  const p0Hidden = hiddenFrom(v0, 0);
  const leaks0 = findLeaks(g0.json, p1Hidden);
  const leaks1 = findLeaks(g1.json, p0Hidden);
  check(
    'response viewer 0 không lộ definitionId của tay P1',
    leaks0.length === 0,
    leaks0.join('; '),
  );
  check(
    'response viewer 1 không lộ definitionId của tay P0',
    leaks1.length === 0,
    leaks1.join('; '),
  );
  check(
    'response tạo duel (viewer 0) không lộ tay P1',
    findLeaks(created.json, p1Hidden).length === 0,
  );
  const p1OnlyIds = [...new Set(v1.players[1].hand.map((c) => c.definitionId ?? ''))].filter(
    (d) => d && !v0.players[0].hand.some((c) => c.definitionId === d),
  );
  const crude = p1OnlyIds.filter((d) => g0.text.includes(d));
  check(
    'grep thô: definitionId chỉ có trong tay P1 không xuất hiện trong response viewer 0',
    crude.length === 0,
    `đã kiểm ${p1OnlyIds.length} id; trùng: ${crude.join(',') || 'không'}`,
  );
  check(
    'response không chứa rng / actionLog',
    !/"rng"|actionLog/.test(g0.text + g1.text + created.text),
  );

  const typesOf = (r: Reply): string[] =>
    ((r.json as { legalActions?: { type: string }[] }).legalActions ?? []).map((a) => a.type);
  check(
    'GET viewer 0 có legalActions [EndPhase, Surrender]; viewer 1 (không đến lượt) chỉ [Surrender]',
    JSON.stringify(typesOf(g0)) === '["EndPhase","Surrender"]' &&
      JSON.stringify(typesOf(g1)) === '["Surrender"]',
    `${typesOf(g0)} | ${typesOf(g1)}`,
  );
  const legalLeak = /definitionId/.test(
    JSON.stringify((g0.json as { legalActions?: unknown }).legalActions),
  );
  check('legalActions không chứa definitionId', !legalLeak);
  check(
    'POST /duels/solo trả legalActions của viewer 0',
    JSON.stringify(typesOf(created)) === '["EndPhase","Surrender"]',
  );

  const legal = { playerIndex: 0, action: { type: 'EndPhase', payload: { playerIndex: 0 } } };
  const ok = await call('POST', `/duels/${id}/actions`, { token, body: legal });
  record(
    '4a. Action hợp lệ: P0 EndPhase (Draw → Standby)',
    'POST',
    `/duels/${id}/actions`,
    legal,
    ok,
    true,
  );
  const okBody = ok.json as { view: ViewV; events: EventV[] };
  check(
    'EndPhase hợp lệ → 200, phase Standby, version tăng',
    ok.status === 200 && okBody.view.phase === 'Standby' && okBody.view.version > v0.version,
  );
  check(
    'POST action trả legalActions của người gửi (sau EndPhase vẫn [EndPhase, Surrender])',
    JSON.stringify(typesOf(ok)) === '["EndPhase","Surrender"]',
    `${typesOf(ok)}`,
  );
  check(
    'lượt 1: P0 không rút bài khi rời Draw (deck không giảm)',
    okBody.view.players[0].deckCount === v0.players[0].deckCount,
  );

  const wrong = { playerIndex: 1, action: { type: 'EndPhase', payload: { playerIndex: 1 } } };
  const before = (await call('GET', `/duels/${id}?viewer=0`, { token })).json as { view: ViewV };
  const bad = await call('POST', `/duels/${id}/actions`, { token, body: wrong });
  record(
    '4b. Action sai luật: P1 EndPhase trong lượt P0',
    'POST',
    `/duels/${id}/actions`,
    wrong,
    bad,
    true,
  );
  const p1Legal = await call('GET', `/duels/${id}?viewer=1`, { token });
  check(
    'action sai luật (P1 EndPhase) KHÔNG nằm trong legalActions của P1',
    !typesOf(p1Legal).includes('EndPhase'),
    `${typesOf(p1Legal)}`,
  );
  const badBody = bad.json as { code?: string; engineCode?: string };
  check(
    'sai lượt → 409 ACTION_REJECTED + engineCode NOT_TURN_PLAYER',
    bad.status === 409 &&
      badBody.code === 'ACTION_REJECTED' &&
      badBody.engineCode === 'NOT_TURN_PLAYER',
  );
  const after = (await call('GET', `/duels/${id}?viewer=0`, { token })).json as { view: ViewV };
  check(
    'state không đổi sau lỗi 409 (version giữ nguyên)',
    after.view.version === before.view.version,
  );

  const malformed = {
    playerIndex: 0,
    action: {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex: 9 },
    },
  };
  const mal = await call('POST', `/duels/${id}/actions`, { token, body: malformed });
  record('4c. Payload méo: zoneIndex = 9', 'POST', `/duels/${id}/actions`, malformed, mal, true);
  const malBody = mal.json as { code?: string; issues?: unknown[] };
  check(
    'payload méo → 400 VALIDATION_FAILED có issues (không phải 500)',
    mal.status === 400 && malBody.code === 'VALIDATION_FAILED' && (malBody.issues?.length ?? 0) > 0,
  );

  const forbidden = await call('POST', `/duels/${id}/actions`, {
    token,
    body: { playerIndex: 0, action: { type: 'Draw', payload: { playerIndex: 0, count: 1 } } },
  });
  check(
    'client gửi Draw → 403 FORBIDDEN_ACTION',
    forbidden.status === 403 && (forbidden.json as { code?: string }).code === 'FORBIDDEN_ACTION',
  );

  const other = await call('POST', '/auth/guest');
  const otherToken = (other.json as { accessToken: string }).accessToken;
  const foreign = await call('GET', `/duels/${id}?viewer=0`, { token: otherToken });
  record(
    '5a. Guest khác xem duel của người ta',
    'GET',
    `/duels/${id}?viewer=0`,
    undefined,
    foreign,
    true,
  );
  check(
    'guest khác → 403 NOT_OWNER',
    foreign.status === 403 && (foreign.json as { code?: string }).code === 'NOT_OWNER',
  );
  const anon = await call('GET', `/duels/${id}?viewer=0`);
  record('5b. Không token', 'GET', `/duels/${id}?viewer=0`, undefined, anon, false);
  check('không token → 401', anon.status === 401);

  md.push('', '## Tổng kết', '');
  const failed = results.filter((r) => !r.ok);
  md.push(
    failed.length === 0
      ? `**Tất cả ${results.length} kiểm tra đạt.**`
      : `**${failed.length}/${results.length} kiểm tra HỎNG.**`,
  );
  writeFileSync(OUT, `${md.join('\n')}\n`);
  for (const r of results)
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
  console.log(`\n${results.length - failed.length}/${results.length} đạt → ${OUT}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
