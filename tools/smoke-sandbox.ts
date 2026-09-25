/**
 * Smoke test of the DEV Duel Sandbox over real HTTP (needs `pnpm dev` / a running API, NODE_ENV != production).
 * Loads the three sample scenarios, plays a few legal actions on each, checks refusals and leaks, and writes
 * docs/ai/review-packets/task-2.11-smoke.md. Exits 1 if any check fails.
 *   node --experimental-strip-types tools/smoke-sandbox.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { call, BASE, type ViewV } from './lib/http.ts';

const NAMES = ['tribute-summon', 'attack-defense', 'chain-basic'];
const OUT = 'docs/ai/review-packets/task-2.11-smoke.md';
const md: string[] = [
  '# Task 2.11 — Smoke Duel Sandbox (HTTP thật)',
  '',
  `Sinh bởi \`tools/smoke-sandbox.ts\` lúc ${new Date().toISOString()} (API: ${BASE}).`,
  '',
  '| Kiểm tra | Kết quả | Chi tiết |',
  '|---|---|---|',
];
let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failed++;
  md.push(`| ${name} | ${ok ? '✅' : '❌'} | ${detail.replace(/\|/g, '/')} |`);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${detail}`);
}

interface Created {
  duelId: string;
  mode: string;
  view: ViewV;
  legalActions: { type: string; payload: Record<string, unknown> }[];
}

const guest = (await call('POST', '/auth/guest')).json as { accessToken: string };
const token = guest.accessToken;
const scenario = (n: string): Record<string, unknown> =>
  JSON.parse(readFileSync(`packages/shared/scenarios/${n}.json`, 'utf8')) as Record<
    string,
    unknown
  >;

for (const name of NAMES) {
  const s = scenario(name);
  const r = await call('POST', '/dev/sandbox/duels', { token, body: s });
  check(`${name}: nạp → 201`, r.status === 201, `status ${r.status}`);
  if (r.status !== 201) continue;
  const c = r.json as Created;
  check(`${name}: phase/lượt đúng scenario`, c.view.phase === s.phase && c.view.turnCount === 3);
  check(`${name}: có legalActions`, c.legalActions.length > 0, `${c.legalActions.length} action`);
  check(
    `${name}: tay đối thủ ẩn`,
    c.view.players[1].hand.length > 0 && c.view.players[1].hand.every((h) => h.hidden),
  );

  let ok = true;
  let sent = 0;
  let legal = c.legalActions;
  for (let i = 0; i < 4 && legal.length > 0; i++) {
    const pick = legal.find((a) => a.type !== 'EndPhase' && a.type !== 'Surrender') ?? legal[0]!;
    const a = await call('POST', `/duels/${c.duelId}/actions`, {
      token,
      body: { playerIndex: 0, action: pick },
    });
    if (a.status !== 200) {
      ok = false;
      break;
    }
    sent++;
    legal = (a.json as { legalActions: typeof legal }).legalActions;
  }
  check(`${name}: chơi ${sent} action từ legalActions`, ok && sent > 0);

  const bad = await call('POST', `/duels/${c.duelId}/actions`, {
    token,
    body: {
      playerIndex: 0,
      action: {
        type: 'NormalSummon',
        payload: { playerIndex: 0, cardInstanceId: 'p0-999', zoneIndex: 0 },
      },
    },
  });
  check(`${name}: action sai luật → 409`, bad.status === 409, `status ${bad.status}`);
}

const noToken = await call('POST', '/dev/sandbox/duels', { body: scenario('tribute-summon') });
check('không token → 401', noToken.status === 401, `status ${noToken.status}`);

const unknown = scenario('tribute-summon');
(unknown.players as { hand: string[] }[])[0]!.hand = ['NOPE-1'];
const bad = await call('POST', '/dev/sandbox/duels', { token, body: unknown });
check(
  'id lá lạ → 400 INVALID_SCENARIO',
  bad.status === 400 && (bad.json as { code?: string }).code === 'INVALID_SCENARIO',
  bad.text.slice(0, 120),
);

const malformed = await call('POST', '/dev/sandbox/duels', {
  token,
  body: { ...scenario('tribute-summon'), phase: 'Nope' },
});
check(
  'scenario méo → 400 VALIDATION_FAILED',
  malformed.status === 400,
  `status ${malformed.status}`,
);

const refused = await call('POST', '/dev/sandbox/duels', {
  token,
  body: {
    ...scenario('tribute-summon'),
    script: [{ type: 'EndPhase', payload: { playerIndex: 1 } }],
  },
});
check('script bị engine từ chối → 409', refused.status === 409, refused.text.slice(0, 140));

md.push('', failed === 0 ? 'Tất cả kiểm tra đạt.' : `${failed} kiểm tra thất bại.`);
writeFileSync(OUT, md.join('\n'));
process.exit(failed === 0 ? 0 : 1);
