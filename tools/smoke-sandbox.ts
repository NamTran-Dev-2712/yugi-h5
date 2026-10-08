/**
 * Smoke test of the DEV Duel Sandbox over real HTTP (needs `pnpm dev` / a running API, NODE_ENV != production).
 * Loads the three sample scenarios, plays a few legal actions on each, checks refusals and leaks, and writes
 * docs/ai/review-packets/task-2.11-smoke.md. Exits 1 if any check fails.
 *   node --experimental-strip-types tools/smoke-sandbox.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { call, BASE, type ViewV } from './lib/http.ts';

const NAMES = [
  'tribute-summon',
  'attack-defense',
  'chain-basic',
  // Task 4.3b: the Field Zone / staying-card scenarios (real cards SMP-113 / 114 / 115 / 208).
  'field-real',
  'field-set-real',
  'continuous-real-2',
  'normal-set-real',
  // Task 4.4b: Counter Trap / Negate scenarios (real cards SMP-201 / 210 / 209). The AI seat moves first (or the script
  // does), so they load with a reaction window held by the caller.
  'negate-attack-real',
  'counter-summon-real',
  'counter-spell-real',
  // Task 4.5b: Fusion scenarios (real cards SMP-116 / 045 / 047 / 202 / 209; the Extra Deck comes from the scenario).
  // `fusion-negated-real`: the script makes the AI seat activate its fusion Spell, the caller holds the Counter Trap.
  'fusion-success-real',
  'fusion-material-destroyed-real',
  'fusion-negated-real',
  // Task 4.7: card batch 2 (SMP-122 Equip on the opponent's monster; SMP-057 + SMP-124 Continuous / Field boosts;
  // SMP-054 destroyed in battle brings SMP-048 back from the graveyard).
  'equip-opponent-real',
  'beast-pack-real',
  'revive-on-destroyed-real',
];
/** Task 4.4b: scenario → the Negate event that tapping the listed Set card must return. */
const NEGATES: Record<string, string> = {
  'negate-attack-real': 'AttackNegated',
  'counter-summon-real': 'SummonNegated',
  'counter-spell-real': 'ChainLinkNegated',
  'fusion-negated-real': 'ChainLinkNegated',
};
const OUT = process.env.OUT ?? 'docs/ai/review-packets/task-2.11-smoke.md';
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
  const turn = (s.turn as { count: number }).count;
  const negated = NEGATES[name];
  if (negated === undefined) {
    check(
      `${name}: phase/lượt đúng scenario`,
      c.view.phase === s.phase && c.view.turnCount === turn,
    );
  } else {
    // The AI (or the script) already moved: the caller holds the window instead of being at the scenario's phase.
    check(
      `${name}: lượt đúng scenario, người chơi đang giữ cửa sổ phản ứng`,
      c.view.turnCount === turn && c.view.chainWindow?.priorityPlayer === 0,
      `turn ${c.view.turnCount}, window ${JSON.stringify(c.view.chainWindow ?? null)}`,
    );
    const answer = c.legalActions.find((a) => a.type === 'ActivateEffect');
    check(`${name}: lá úp đáp trả có trong legalActions`, answer !== undefined);
    if (answer) {
      const lpBefore = c.view.players[0].lifePoints;
      const a = await call('POST', `/duels/${c.duelId}/actions`, {
        token,
        body: { playerIndex: 0, action: answer },
      });
      const body = a.json as { events?: { type: string }[]; view?: ViewV };
      const events = body.events ?? [];
      check(
        `${name}: kích hoạt → event ${negated}`,
        a.status === 200 && events.some((e) => e.type === negated),
        `status ${a.status}, events ${events.map((e) => e.type).join(',')}`,
      );
      if (negated === 'AttackNegated') {
        check(
          `${name}: đòn bị vô hiệu không mất LP, không quái nào bị phá`,
          body.view?.players[0].lifePoints === lpBefore &&
            !events.some((e) => e.type === 'DamageDealt' || e.type === 'MonsterDestroyed'),
        );
      }
    }
    const fresh = await call('POST', '/dev/sandbox/duels', { token, body: s });
    if (fresh.status !== 201) continue;
    Object.assign(c, fresh.json as Created);
  }
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

// ---- Task 4.5b: a whole Fusion Summon on the Sandbox scenario, answers built from the prompt payload ----
{
  const s = scenario('fusion-success-real');
  const r = await call('POST', '/dev/sandbox/duels', { token, body: s });
  const c = r.json as Created;
  const mine = c.view.players[0];
  check(
    'fusion-success-real: Extra Deck của mình có 3 lá (thấy tên), của AI chỉ là số 0',
    mine.extraDeck?.length === 3 &&
      mine.extraDeck.every((x) => typeof x.definitionId === 'string') &&
      c.view.players[1].extraDeckCount === 0 &&
      !('extraDeck' in c.view.players[1]),
  );
  const spell = mine.hand.find((x) => x.definitionId === 'SMP-116')?.instanceId;
  const send = async (action: unknown) =>
    (await call('POST', `/duels/${c.duelId}/actions`, { token, body: { playerIndex: 0, action } }))
      .json as { view: ViewV; events?: { type: string }[] };
  let step = await send({
    type: 'ActivateEffect',
    payload: { playerIndex: 0, cardInstanceId: spell, effectId: 'merging-crucible' },
  });
  const first = step.view.pendingPrompt;
  check(
    'fusion-success-real: kích hoạt → prompt "chọn quái Dung hợp" có 2 ứng viên',
    first?.kind === 'SelectFusionMonster' && first.payload?.candidateInstanceIds?.length === 2,
    JSON.stringify(first?.payload ?? null),
  );
  // SMP-047 = SMP-006 (hand) + SMP-009 (field): the materials then come from two different places.
  const fusion = step.view.players[0].extraDeck?.find((x) => x.definitionId === 'SMP-047');
  step = await send({
    type: 'ResolvePendingPrompt',
    payload: { playerIndex: 0, promptId: first?.promptId, cardInstanceIds: [fusion?.instanceId] },
  });
  const second = step.view.pendingPrompt;
  check(
    'fusion-success-real: → prompt "chọn 2 nguyên liệu" (1 lá trên tay + 1 lá trên sân)',
    second?.kind === 'SelectFusionMaterials' &&
      second.payload?.count === 2 &&
      second.payload.candidateInstanceIds?.length === 2,
    JSON.stringify(second?.payload ?? null),
  );
  step = await send({
    type: 'ResolvePendingPrompt',
    payload: {
      playerIndex: 0,
      promptId: second?.promptId,
      cardInstanceIds: second?.payload?.candidateInstanceIds ?? [],
    },
  });
  const types = (step.events ?? []).map((e) => e.type);
  check(
    'fusion-success-real: → 2 FusionMaterialSent + MonsterFusionSummoned, rồi hiệu ứng "khi triệu hồi" gây 500 sát thương',
    types.filter((t) => t === 'FusionMaterialSent').length === 2 &&
      types.includes('MonsterFusionSummoned') &&
      types.includes('DamageDealt') &&
      step.view.players[1].lifePoints === 7500,
    types.join(','),
  );
  check(
    'fusion-success-real: quái Dung hợp trên sân (ô 0), Extra Deck còn 2',
    step.view.players[0].board.monsterZones[0]?.definitionId === 'SMP-047' &&
      step.view.players[0].extraDeckCount === 2,
  );
}
{
  const s = scenario('fusion-material-destroyed-real');
  const r = await call('POST', '/dev/sandbox/duels', { token, body: s });
  const c = r.json as Created;
  const spell = c.view.players[0].hand.find((x) => x.definitionId === 'SMP-116')?.instanceId;
  const a = await call('POST', `/duels/${c.duelId}/actions`, {
    token,
    body: {
      playerIndex: 0,
      action: {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: spell, effectId: 'merging-crucible' },
      },
    },
  });
  const body = a.json as { view: ViewV; events?: { type: string }[] };
  const types = (body.events ?? []).map((e) => e.type);
  check(
    'fusion-material-destroyed-real: AI phá nguyên liệu để đáp trả → không dung hợp, không bị hỏi, lá Phép vào mộ',
    a.status === 200 &&
      types.includes('MonsterDestroyed') &&
      !types.includes('MonsterFusionSummoned') &&
      !types.includes('FusionMaterialSent') &&
      body.view.pendingPrompt === null &&
      body.view.players[0].extraDeckCount === 1 &&
      body.view.players[0].graveyard.some((x) => x.definitionId === 'SMP-116'),
    types.join(','),
  );
}
{
  const wrong = scenario('fusion-success-real');
  (wrong.players as { extraDeck?: string[] }[])[0]!.extraDeck = ['SMP-001'];
  const r = await call('POST', '/dev/sandbox/duels', { token, body: wrong });
  check(
    'Extra Deck có lá không phải quái Dung hợp → 400 INVALID_SCENARIO',
    r.status === 400 && (r.json as { code?: string }).code === 'INVALID_SCENARIO',
    r.text.slice(0, 140),
  );
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
