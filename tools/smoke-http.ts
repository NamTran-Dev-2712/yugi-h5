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

const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-2.4-smoke.md';
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

  await fusionPath(token);

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

interface WireAction {
  type: string;
  payload: { playerIndex: 0 | 1; [k: string]: unknown };
}
interface Step {
  view: ViewV;
  events: EventV[];
  legalActions: WireAction[];
}
interface CardData {
  id: string;
  kind: string;
  category?: string;
  fusionMaterials?: string[];
  effects?: { operations: { kind: string }[] }[];
}

/**
 * Task 4.5b — a whole Fusion Summon over real HTTP: a `solo-debug` duel (the caller drives both seats) with
 * `FUSION_DEMO_DECK` + `FUSION_DEMO_EXTRA_DECK`; turns are passed until the server lists the fusion Spell, then:
 * activate → SelectFusionMonster → SelectFusionMaterials → the monster is on the field. Both prompt answers are built
 * from the prompt payload (`candidateInstanceIds`) and the card data, not picked from `legalActions`.
 */
async function fusionPath(token: string): Promise<void> {
  const shared = (await import('../packages/shared/dist/index.js')) as {
    FUSION_DEMO_DECK: readonly string[];
    FUSION_DEMO_EXTRA_DECK: readonly string[];
    SAMPLE_CARDS: readonly CardData[];
  };
  const defs = new Map(shared.SAMPLE_CARDS.map((c) => [c.id, c]));
  const fuses = (definitionId: string | undefined): boolean =>
    (defs.get(definitionId ?? '')?.effects ?? []).some((e) =>
      e.operations.some((o) => o.kind === 'FusionSummon'),
    );
  const body = { deck: shared.FUSION_DEMO_DECK, extraDeck: shared.FUSION_DEMO_EXTRA_DECK };
  const created = await call('POST', '/duels/solo', { token, body });
  record('6. Fusion — tạo duel có Extra Deck', 'POST', '/duels/solo', body, created, true);
  const duel = created.json as Step & { duelId: string };
  check('Fusion: POST /duels/solo có extraDeck → 201', created.status === 201, `${created.status}`);
  if (created.status !== 201) return;
  const id = duel.duelId;
  const extraSize = shared.FUSION_DEMO_EXTRA_DECK.length;
  check(
    'Fusion: người tạo thấy Extra Deck của mình (đủ lá, có definitionId); ghế kia chỉ có số lượng',
    JSON.stringify(duel.view.players[0].extraDeck?.map((c) => c.definitionId)) ===
      JSON.stringify(shared.FUSION_DEMO_EXTRA_DECK) &&
      !('extraDeck' in duel.view.players[1]) &&
      duel.view.players[1].extraDeckCount === extraSize,
  );
  check(
    'Fusion: response viewer 0 không nhắc tới lá Extra Deck nào của P1',
    !created.text.includes('"p1-x'),
  );
  const other = await call('GET', `/duels/${id}?viewer=1`, { token });
  const otherView = (other.json as { view: ViewV }).view;
  check(
    'Fusion: viewer 1 thấy Extra Deck của chính mình, không thấy của P0',
    otherView.players[1].extraDeck?.length === extraSize &&
      !('extraDeck' in otherView.players[0]) &&
      !other.text.includes('"p0-x'),
  );

  const invalid = await call('POST', '/duels/solo', { token, body: { extraDeck: ['SMP-001'] } });
  record(
    '6b. Extra Deck chứa lá không phải quái Dung hợp',
    'POST',
    '/duels/solo',
    { extraDeck: ['SMP-001'] },
    invalid,
    true,
  );
  check(
    'Fusion: Extra Deck sai → 400 INVALID_DECK (EXTRA_NOT_FUSION)',
    invalid.status === 400 &&
      (invalid.json as { code?: string }).code === 'INVALID_DECK' &&
      invalid.text.includes('EXTRA_NOT_FUSION'),
    `${invalid.status}`,
  );
  const vsAi = await call('POST', '/duels/solo', { token, body: { ...body, mode: 'solo-vs-ai' } });
  const vsAiView = (vsAi.json as Step).view;
  check(
    'Fusion: solo-vs-ai — ghế AI không có Extra Deck (extraDeckCount 0), ghế người có đủ',
    vsAi.status === 201 &&
      vsAiView.players[1].extraDeckCount === 0 &&
      vsAiView.players[0].extraDeck?.length === extraSize,
    `${vsAi.status}`,
  );

  const post = async (seat: 0 | 1, action: WireAction): Promise<Reply> =>
    call('POST', `/duels/${id}/actions`, { token, body: { playerIndex: seat, action } });
  let state: Step = duel;
  let activation: WireAction | undefined;
  // Pass phases / turns (both seats are mine) until the server lists the fusion Spell for seat 0.
  for (let i = 0; i < 400 && state.view.winnerIndex === null; i++) {
    const seat: 0 | 1 = state.view.pendingPrompt?.playerIndex ?? state.view.turnPlayerIndex;
    if (seat !== state.view.viewerIndex) {
      const g = await call('GET', `/duels/${id}?viewer=${seat}`, { token });
      state = { ...(g.json as Step), events: [] };
    }
    const hand = state.view.players[0].hand;
    activation =
      seat === 0
        ? state.legalActions.find(
            (a) =>
              a.type === 'ActivateEffect' &&
              fuses(hand.find((c) => c.instanceId === a.payload.cardInstanceId)?.definitionId),
          )
        : undefined;
    if (activation) break;
    // A hand-limit discard: keep the fusion cards (drop a listed answer that has none of them, else the first).
    const answers = state.legalActions.filter((a) => a.type === 'ResolvePendingPrompt');
    const keep = (a: WireAction): boolean =>
      (a.payload.cardInstanceIds as string[]).every((cid) => {
        const d = state.view.players[seat].hand.find((c) => c.instanceId === cid)?.definitionId;
        return !fuses(d) && !['SMP-001', 'SMP-007', 'SMP-006', 'SMP-009'].includes(d ?? '');
      });
    const next: WireAction = answers.find(keep) ??
      answers[0] ?? { type: 'EndPhase', payload: { playerIndex: seat } };
    const r = await post(seat, next);
    if (r.status !== 200) {
      check(
        'Fusion: đi tới lúc kích hoạt được lá dung hợp',
        false,
        `${r.status} ${r.text.slice(0, 160)}`,
      );
      return;
    }
    state = r.json as Step;
  }
  check(
    'Fusion: server liệt kê ActivateEffect cho lá Phép dung hợp (SMP-116) trong legalActions',
    activation !== undefined,
    `lượt ${state.view.turnCount}`,
  );
  if (!activation) return;

  const act = await post(0, activation);
  record('7a. Kích hoạt lá Phép dung hợp', 'POST', `/duels/${id}/actions`, activation, act, true);
  state = act.json as Step;
  const p1 = state.view.pendingPrompt;
  check(
    'Fusion: sau khi kích hoạt → prompt SelectFusionMonster cho P0, payload chỉ có candidateInstanceIds + count',
    act.status === 200 &&
      p1?.kind === 'SelectFusionMonster' &&
      p1.playerIndex === 0 &&
      JSON.stringify(Object.keys(p1.payload ?? {}).sort()) === '["candidateInstanceIds","count"]' &&
      p1.payload?.count === 1,
    JSON.stringify(p1?.payload ?? null),
  );
  if (!p1?.payload?.candidateInstanceIds) return;
  const seen1 = await call('GET', `/duels/${id}?viewer=1`, { token });
  const prompt1 = (seen1.json as { view: ViewV }).view.pendingPrompt;
  check(
    'Fusion: đối thủ (viewer 1) thấy có prompt nhưng payload = null, không thấy id Extra Deck của P0',
    prompt1?.kind === 'SelectFusionMonster' &&
      prompt1.payload === null &&
      !seen1.text.includes('"p0-x'),
  );

  const fusionId = p1.payload.candidateInstanceIds[0]!;
  const fusionDef = state.view.players[0].extraDeck?.find(
    (c) => c.instanceId === fusionId,
  )?.definitionId;
  const chooseMonster: WireAction = {
    type: 'ResolvePendingPrompt',
    payload: { playerIndex: 0, promptId: p1.promptId, cardInstanceIds: [fusionId] },
  };
  const m = await post(0, chooseMonster);
  record(
    '7b. Trả lời "Chọn mục tiêu dung hợp"',
    'POST',
    `/duels/${id}/actions`,
    chooseMonster,
    m,
    true,
  );
  state = m.json as Step;
  const p2 = state.view.pendingPrompt;
  const needed = defs.get(fusionDef ?? '')?.fusionMaterials ?? [];
  check(
    'Fusion: → prompt SelectFusionMaterials (fusionInstanceId = quái đã chọn, count = số nguyên liệu của lá)',
    m.status === 200 &&
      p2?.kind === 'SelectFusionMaterials' &&
      p2.payload?.fusionInstanceId === fusionId &&
      p2.payload.count === needed.length &&
      JSON.stringify(Object.keys(p2.payload).sort()) ===
        '["candidateInstanceIds","count","fusionInstanceId"]',
    JSON.stringify(p2?.payload ?? null),
  );
  if (!p2?.payload?.candidateInstanceIds) return;

  // One candidate per named material, looked up in MY view (hand + field) — built from the payload, not from legalActions.
  const mine = [
    ...state.view.players[0].hand,
    ...state.view.players[0].board.monsterZones.filter(
      (c): c is NonNullable<typeof c> => c !== null,
    ),
  ];
  const pool = [...p2.payload.candidateInstanceIds];
  const chosen: string[] = [];
  for (const material of needed) {
    const at = pool.findIndex(
      (cid) => mine.find((c) => c.instanceId === cid)?.definitionId === material,
    );
    if (at >= 0) chosen.push(...pool.splice(at, 1));
  }
  const chooseMaterials: WireAction = {
    type: 'ResolvePendingPrompt',
    payload: { playerIndex: 0, promptId: p2.promptId, cardInstanceIds: chosen },
  };
  const done = await post(0, chooseMaterials);
  record(
    '7c. Trả lời "Chọn N nguyên liệu dung hợp"',
    'POST',
    `/duels/${id}/actions`,
    chooseMaterials,
    done,
    true,
  );
  state = done.json as Step;
  const types = (state.events ?? []).map((e) => e.type);
  const summoned = (state.events ?? []).find((e) => e.type === 'MonsterFusionSummoned');
  check(
    'Fusion: → 200, đủ FusionMaterialSent rồi MonsterFusionSummoned (đúng quái đã chọn)',
    done.status === 200 &&
      types.filter((t) => t === 'FusionMaterialSent').length === needed.length &&
      summoned?.instanceId === fusionId &&
      summoned.definitionId === fusionDef,
    types.join(','),
  );
  const zone = typeof summoned?.zoneIndex === 'number' ? summoned.zoneIndex : -1;
  const onField = state.view.players[0].board.monsterZones[zone];
  check(
    'Fusion: quái Dung hợp nằm ngửa Tư thế Công trên sân; Extra Deck còn ít hơn 1; nguyên liệu trong mộ',
    onField?.instanceId === fusionId &&
      onField.position === 'Attack' &&
      state.view.players[0].extraDeckCount === extraSize - 1 &&
      chosen.every((cid) => state.view.players[0].graveyard.some((c) => c.instanceId === cid)),
  );
  check('Fusion: không còn prompt nào treo', state.view.pendingPrompt === null);
  const after = await call('GET', `/duels/${id}?viewer=1`, { token });
  const afterView = (after.json as { view: ViewV }).view;
  const theirs = afterView.players[0].board.monsterZones[zone];
  check(
    'Fusion: đối thủ thấy quái Dung hợp ngửa trên sân, vẫn không thấy danh sách Extra Deck của P0',
    theirs?.definitionId === fusionDef &&
      !('extraDeck' in afterView.players[0]) &&
      afterView.players[0].extraDeckCount === extraSize - 1,
  );
  check(
    'Fusion: response viewer 1 không lộ tay P0 và không nhắc lá nào còn trong Extra Deck của P0',
    findLeaks(after.json, hiddenFrom(state.view, 0)).length === 0 &&
      (state.view.players[0].extraDeck ?? []).every(
        (c) => !after.text.includes(`"${c.instanceId}"`),
      ),
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
