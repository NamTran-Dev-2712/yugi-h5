// One-off migration (2026-10-01): split the frozen originals in ./original into
//   docs/ai/decisions/NNN-<date>-<slug>.md  (one ADR per file, body byte-identical)
//   docs/ai/DECISIONS.md                    (index table)
//   docs/ai/progress/*.md                   (task log, lines verbatim)
// Run from the repo root: node docs/ai/_migration/split.mjs
// Only reads ./original; safe to re-run (overwrites its own outputs).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const ORIGINAL = 'docs/ai/_migration/original';
const pad = (n) => String(n).padStart(3, '0');

// [slug, task, layers, notes[]] in the exact order of the original file.
// A note starting with '!' marks something later superseded (status "một phần đã thay").
// {N} expands to "ADR 0NN (`file`)".
const META = [
  ['nestjs-11', 'P0', 'API, Tooling', []],
  ['vite-7', 'P0', 'Web, Tooling', []],
  [
    'zod-validation',
    'P0',
    'API, Shared',
    ['Pipe dùng thật là `ZodPipe` tự viết, không phải pipe của `nestjs-zod` — lý do ở {35}.'],
  ],
  ['prisma-6', 'P0', 'API', []],
  ['redis-not-wired', 'P0', 'API, Infra', []],
  ['no-commitlint', 'P0', 'Tooling', []],
  ['api-vitest', 'P0', 'API, Test', []],
  ['api-build-tsc', 'P0', 'API, Tooling', []],
  ['ports-5433-6380', 'P0', 'Infra', []],
  ['zustand-vanilla', 'P0', 'Web', []],
  ['phases-p0-p9', 'Plan', 'Plan', ['Mở rộng thêm P10–P15 ở {43}.']],
  [
    'rules-scope-v1-ruleset-config',
    'Plan',
    'Plan, Shared, Engine',
    [
      '!"OUT story mode" và phạm vi liên quan: mở rộng ở {43}.',
      '!`chainPrompt` không dùng cho phản ứng: {54} (C13).',
    ],
  ],
  ['confidence-labels', 'Plan', 'Quy trình', ['Thêm nhãn `[DECISION]` ở {17}.']],
  ['dev-tools-via-api', 'Plan', 'API, Web', ['Hiện thực đầu tiên (Duel Sandbox): {44}.']],
  ['asset-pipeline', 'Plan', 'Assets', []],
  [
    'i18n-vi-en',
    'Plan',
    'Web, Shared',
    [
      '!"Bootstrap ở task 2.10": do đổi số task, i18n thực tế là task 2.12 — {45}. Text lá song ngữ: {46}.',
    ],
  ],
  [
    'decision-label-g1-g12',
    'Plan',
    'Luật, Plan',
    [
      '!G5 (hỏi "Kích hoạt?") → thay bởi {54} (C13).',
      '!G12 "chưa gacha/pack" → thay bởi {43}.',
      '!"Surrender (task 1.8)": do đổi số task, Surrender là task 1.9 — {28}.',
      'G1/G4 được làm rõ thêm ở {19}.',
    ],
  ],
  [
    'c11-trap-must-be-set',
    'C11',
    'Luật, Shared, Engine',
    ['Hành vi engine đã làm ở {47} (từ tay) và {50} (lá đã Set).'],
  ],
  [
    'c1-c4-c9-c10-c12',
    'C1–C12',
    'Luật, Shared',
    [
      '!C12 (giữ prompt "Kích hoạt?") → thay bởi {54} (C13).',
      '!"Ngoài phạm vi: gacha/shop/guild/sự kiện…" → phần gacha/shop/sự kiện thay bởi {43}.',
    ],
  ],
  [
    'task-1.2-draw-on-leaving-draw-phase',
    '1.2',
    'Engine',
    ['!"Reject = `throw Error`" → thay bởi `EngineError` có mã ở {22}.'],
  ],
  [
    'task-1.3-normal-summon-set-monster',
    '1.3',
    'Engine',
    ['!"Level ≥ 5 bị từ chối" → thay bởi Tribute Summon/Set ở {23}.'],
  ],
  ['engine-error-codes', 'củng cố trước 1.4', 'Engine', []],
  [
    'task-1.4-tribute',
    '1.4',
    'Engine',
    [
      '!"`docs/reference/02-yugi-h5-mechanics.md` chưa có trong repo": file đã có (commit 6709070) — xem `docs/ai/OPEN-ISSUES.md`.',
      '"task UI (gần 2.6)" cho SelectTribute: thực tế làm ở task 2.8 — {40}.',
    ],
  ],
  ['task-1.5-change-position', '1.5', 'Engine', ['Flip Summon (nhắc ở "Hệ quả"): {60}.']],
  [
    'task-1.6-declare-attack',
    '1.6',
    'Engine',
    [
      '!`TARGET_FACE_DOWN` và "lỗ hổng sân chỉ có quái úp" → xoá/đóng ở {27}.',
      '!"Chưa xử lý win condition" → làm ở {26}.',
      'Damage step sau này tách sang `battle/resolve-attack.ts` ({51}) và đọc chỉ số hiệu lực ({53}).',
    ],
  ],
  [
    'task-1.7-win-condition',
    '1.7',
    'Engine',
    ['!"`DeckOut` không phát `DuelEnded`" → thêm ở {29}. `reason` mở rộng ở {28}, {29}.'],
  ],
  ['task-1.8-flip-on-attack', '1.8', 'Engine', ['!"Chưa làm Flip Effect thật" → `OnFlip` ở {60}.']],
  ['task-1.9-surrender', '1.9', 'Engine', []],
  ['task-1.10-deck-out', '1.10', 'Engine', []],
  ['task-1.11-hand-limit', '1.11', 'Engine', []],
  ['task-1.12-golden-fuzz', '1.12', 'Engine, Test', []],
  [
    'task-2.1-state-view',
    '2.1',
    'Shared, API',
    [
      '!"`pendingPrompt` gửi nguyên" → payload bị che với người không được hỏi: {48}.',
      '!"Không gửi `chainStack`" → `chain`/`chainWindow` công khai trên view: {55}; chữ ký `toStateView(state, viewer, cardDefinitions)`: {55}.',
      '!"Event filter chưa làm" → {34}.',
      'Face-up của Phép/Bẫy (chốt ở 3.4): {50}. `equippedTo`, lọc target theo ghế: {62}.',
    ],
  ],
  [
    'task-2.2-duel-service',
    '2.2',
    'API',
    [
      '!"`submitAction` trả `events` thô" → `eventsByViewer` đã lọc: {34}.',
      '!"Không validate cỡ deck", "ánh xạ guest → playerIndex là việc 2.3" → {35}.',
    ],
  ],
  [
    'task-event-filter',
    'event-filter',
    'Shared, API',
    [
      'Số event đã tăng sau ADR này: {48} (+7), {55} (+3 chain), {62} (+3). Bảng hiện hành: `docs/design/event-visibility.md`.',
      '!"Quyết định chỉ theo loại event": `toEventView` nay có tham số `hidden` tường minh — {62}.',
    ],
  ],
  [
    'task-2.3-http-duel-solo',
    '2.3',
    'API, Shared',
    [
      '!"Chỉ kiểm vỏ action ở HTTP … payload méo → 500" → schema Action đầy đủ, méo = 400: {36}.',
      '!"2.4 (AI)" / "FE (2.5+)": do đổi số task, AI là 2.6 ({38}), trang debug là 2.4 ({36}).',
    ],
  ],
  [
    'task-2.4-debug-page',
    '2.4',
    'Shared, API, Web',
    [
      '!"Không có `legalActions`" → có từ {37}; trang debug dùng `applyLegality`.',
      '!"2.5 (AI)": AI là task 2.6 — {38}.',
    ],
  ],
  [
    'task-2.5-legal-actions',
    '2.5',
    'Engine, Shared, API, Web',
    [
      '!Test chi phí "chặn ở 300 ms" → đổi sang đếm công việc tất định: {62} (mục Chore).',
      'Bộ sinh ứng viên thêm cho Spell/Trap ({47}), chain ({49}), FlipSummon ({60}).',
    ],
  ],
  [
    'task-2.6-ai-solo-vs-ai',
    '2.6',
    'API',
    [
      'AI mở rộng: cửa sổ ưu tiên + prompt trigger/target ({55}); giá trị target của mình + Flip Summon ({62}). AI vẫn không tự Set/kích hoạt Phép/Bẫy ({48}).',
    ],
  ],
  [
    'task-2.7-duel-scene',
    '2.7',
    'Web',
    [
      '!"Chuỗi UI ở `strings.ts` (tiếng Việt)" → facade gọi `t()`: {45}.',
      '!"Chưa phát lại từng bước AI" → {41}. Kéo thả: {40}.',
    ],
  ],
  [
    'task-2.8-interaction-machine',
    '2.8',
    'Web',
    ['Mở rộng không thêm kind: Spell/Trap ({48}), chuỗi/trigger ({56}), Flip/mộ/Equip ({62}).'],
  ],
  [
    'task-2.9-animation',
    '2.9',
    'Web',
    [
      '!Bảng thời lượng đầu tiên trong ADR → thay bởi mục "(tiếp) — Hiệu chỉnh `DURATION_MS`" ngay trong file này.',
      'Step thêm sau: {48}, {55}, {62}.',
    ],
  ],
  ['task-2.10-log-panel', '2.10', 'Web', []],
  [
    'scope-expansion-p10-p15',
    'Plan',
    'Plan',
    [
      'Thay một phần {11}, {12}, {17} (G12), {19} ("ngoài phạm vi").',
      'Còn chờ chủ dự án: E1–E9 và đề xuất sửa `CLAUDE.md` #5 (xem `docs/ai/PROGRESS.md`).',
    ],
  ],
  [
    'task-2.11-sandbox',
    '2.11',
    'Shared, API, Web',
    [
      '!"`chain-basic` chỉ dựng state đầu vì engine chưa có Spell/Trap/Chain" — lịch sử; scenario lá thật có ở {57}, {62} (suy ra, cần duyệt: `chain-basic.json` đã được bổ sung script hay chưa).',
      '`scenario-to-state.ts` thêm `chainWindow: null` ở {49}.',
    ],
  ],
  [
    'task-2.12-i18n',
    '2.12',
    'Web',
    ['!"Tên/effect lá … chưa có `{vi,en}`" → có từ {46}. Hiện thực của {16}.'],
  ],
  [
    'task-3.1-effect-schema',
    '3.1',
    'Shared',
    [
      '!"Registry … `implemented:false`, không handler" → handler thật ở {47}.',
      '!"`scriptId` vẫn chỉ ở mức `CardDefinition`" → `EffectDefinition.scriptId` ở {53}.',
      'Kind thêm sau: `OnDestroyed` ({52}), `ModifyStat` ({53}), `SpecialSummon` ({59}), `OnFlip` ({60}), `Equip` ({61}); `spellSpeed` ({50}).',
    ],
  ],
  [
    'task-3.2-set-spelltrap-activate',
    '3.2',
    'Engine',
    [
      '!"Resolve NGAY, chưa chain" → chain thật ở {49} (cost + target lúc kích hoạt, operations lúc resolve).',
      '!"Containment ở API … engine-only" → nối wire ở {48}.',
      '!"Lá đã Set trên sân chưa kích hoạt được" → {50}.',
    ],
  ],
  [
    'task-3.2b-wire-spell-trap',
    '3.2b',
    'Shared, API, Web',
    [
      '"AI chưa dùng Spell/Trap": vẫn đúng ngoài cửa sổ; trong cửa sổ ưu tiên AI kích hoạt/pass — {55}.',
    ],
  ],
  [
    'task-3.3-chain-stack',
    '3.3',
    'Engine',
    [
      '!Quick-Play từ tay "Main1/Main2 `[ASSUMED]`" → mọi phase lượt mình: {50}.',
      '!"Containment … `PassPriority` engine-only, 3 event `null`" → nối wire ở {55} ("3.3b" trong ADR này = task 3.4b).',
      'Cửa sổ phản ứng dùng lại `chainWindow`: {51}.',
    ],
  ],
  [
    'task-3.4-spell-speed-set-cards',
    '3.4',
    'Engine, Shared',
    [
      '!"Đối thủ không có cơ hội phản ứng nếu người chơi của lượt không kích hoạt gì" → cửa sổ phản ứng ở {51}.',
      '!"Containment … api 0 dòng" → nối wire ở {55}.',
      'Kích hoạt lá Continuous Spell/Trap + Normal Spell đã Set: vẫn chưa làm (task 4.3).',
    ],
  ],
  [
    'task-3.4c-reaction-window',
    '3.4c',
    'Engine',
    ['!"api/web 0 dòng", "AI chưa biết `PassPriority`" → {55}. UI: {56}.'],
  ],
  [
    'task-3.5-triggers',
    '3.5',
    'Engine, Shared',
    [
      '!"`decline` chưa có trong `PlayerActionSchema`", "AI phải trả lời `TriggerActivation`" → {55}.',
      '!"`OnFlip` … là task sau" → {60}. `OnSummon` cũng bắn từ Special Summon ({59}) và Flip Summon ({60}).',
    ],
  ],
  [
    'task-3.6-continuous-scriptid',
    '3.6',
    'Engine, Shared',
    [
      '!"`StateView`/AI/web vẫn hiện chỉ số in" → `effectiveStats` trên view ở {55}, UI ở {56}.',
      '!`ModifyStat.side` bắt buộc → optional (`side` hoặc `equipped`) ở {61}; bất biến fuzz "Phép/Bẫy ngửa ⇔ có link" nới ở {61}.',
      'Kích hoạt lá Phép/Bẫy Liên tục: vẫn chưa làm (task 4.3).',
    ],
  ],
  [
    'c13-no-activation-dialog',
    'C13',
    'Luật, Web',
    ['Thay G5 ở {17} và C12 ở {19}. UI làm ở {56}.'],
  ],
  [
    'task-3.4b-wire-chain',
    '3.4b',
    'Engine (1 dòng export), Shared, API, Web',
    [
      '!"Phaser DuelScene chưa có nút Bỏ qua" → {56}. "Card pool thật không bao giờ mở cửa sổ" → có lá thật từ {57}.',
      '!"`ENGINE_ONLY_ACTIONS` bị xoá" → tái lập (cơ chế) ở {60}, rỗng lại ở {62}.',
      '!"UI/AI chưa dùng `effectiveStats`" → UI ở {56}.',
      '`chain[].targetInstanceIds` và `ChainLinkAdded` nay lọc theo ghế: {62}.',
    ],
  ],
  [
    'task-3.7-chain-ui',
    '3.7',
    'Web',
    [
      '!"Chứng minh bằng fixture … pool chưa có lá Set có effect" → lá thật + ảnh qua Sandbox ở {57}.',
    ],
  ],
  [
    'task-3.8-effect-cards',
    '3.8',
    'Shared, Test',
    ['Cùng mẫu deck demo: `BATCH1_DEMO_DECK` ({58}), `MECH_DEMO_DECK` ({62}).'],
  ],
  [
    'task-4.1-card-batch-1',
    '4.1',
    'Shared, Test, Tooling',
    [
      '!"Fuzz leak dài thoát mã 1 … không điều tra lại" → đã tìm ra gốc (test đồng bộ dài chặn event loop) và sửa ở {62} (mục Chore).',
    ],
  ],
  [
    'task-4.2a-special-summon',
    '4.2a',
    'Engine, Shared',
    [
      '!"Lá trong tay được chọn làm target lộ `instanceId` … xem lại ở task nối wire" → lọc theo ghế ở {62}.',
      '!"Containment: event `null`" → PUBLIC ở {62}.',
    ],
  ],
  [
    'task-4.2b-flip-summon-onflip',
    '4.2b',
    'Engine, Shared, API',
    [
      '!"API containment … `FlipSummon` trong `ENGINE_ONLY_ACTIONS`" → lên wire ở {62} (set rỗng, cơ chế giữ lại).',
    ],
  ],
  [
    'task-4.2c-equip-spell',
    '4.2c',
    'Engine, Shared',
    ['!"Containment: `CardEquipped` `null` … `equippedTo` không đi ra wire" → {62}.'],
  ],
  ['task-4.2d-wire-4.2', '4.2d', 'Shared, API, Web, Test', []],
];

// ---------------------------------------------------------------- decisions
const src = readFileSync(`${ORIGINAL}/DECISIONS.md`, 'utf8');
const firstAdr = src.indexOf('\n## ') + 1;
const sections = src
  .slice(firstAdr)
  .split(/\n(?=## )/)
  .map((s) => s.replace(/\s+$/, ''));
if (sections.length !== META.length) {
  throw new Error(`expected ${META.length} ADRs, found ${sections.length}`);
}

const adrs = sections.map((body, i) => {
  const heading = body.slice(0, body.indexOf('\n'));
  const m = /^## (\d{4}-\d{2}-\d{2}) — (.+)$/.exec(heading);
  if (!m) throw new Error(`unexpected heading: ${heading}`);
  const [slug, task, layers, notes] = META[i];
  return {
    n: i + 1,
    date: m[1],
    title: m[2],
    task,
    layers,
    notes,
    body,
    file: `${pad(i + 1)}-${m[1]}-${slug}.md`,
  };
});

const ref = (text) =>
  text.replace(/\{(\d+)\}/g, (_, n) => {
    const adr = adrs[Number(n) - 1];
    if (!adr) throw new Error(`bad ADR ref {${n}}`);
    return `ADR ${pad(adr.n)} (\`${adr.file}\`)`;
  });
const statusOf = (adr) =>
  adr.notes.some((x) => x.startsWith('!')) ? 'Hiệu lực — một phần đã thay' : 'Hiệu lực';

mkdirSync('docs/ai/decisions', { recursive: true });
for (const adr of adrs) {
  const lines = [
    `> **ADR ${pad(adr.n)}** · ${adr.date} · Task: ${adr.task} · Lớp: ${adr.layers}`,
    `> **Trạng thái:** ${statusOf(adr)}. Mục lục: \`docs/ai/DECISIONS.md\`.`,
  ];
  if (adr.notes.length > 0) {
    lines.push(
      '>',
      '> Ghi chú đọc kèm (thêm khi tách file 2026-10-01; KHÔNG thuộc ADR gốc, phần dưới giữ nguyên văn):',
      '>',
      ...adr.notes.map((x) => `> - ${ref(x.replace(/^!/, ''))}`),
    );
  }
  writeFileSync(`docs/ai/decisions/${adr.file}`, `${lines.join('\n')}\n\n${adr.body}\n`);
}

const cell = (s) => s.replace(/\|/g, '\\|');
const index = [
  '# Decisions — mục lục ADR',
  '',
  'File này là **mục lục**, không được tự nạp vào context. Mỗi ADR là một file nguyên văn trong',
  '`docs/ai/decisions/`. Tra theo chủ đề: `docs/ai/INDEX.md`. Tham chiếu cũ kiểu "ADR 3.3" hoặc',
  '"ADR 2026-09-24 legalActions" tra bằng cột **Task** / **Ngày** bên dưới.',
  '',
  '## Thêm ADR mới',
  '',
  '- Format không đổi: ngày, quyết định, lý do, hệ quả.',
  '- Tạo file `docs/ai/decisions/NNN-YYYY-MM-DD-<slug>.md` (NNN = số kế tiếp), dòng đầu thân bài là',
  '  `## YYYY-MM-DD — <tiêu đề>`, phía trên là khối `>` metadata (ADR, Task, Lớp, Trạng thái).',
  '- Thêm 1 dòng vào cuối bảng dưới đây; nếu chủ đề mới thì thêm vào `docs/ai/INDEX.md`.',
  '- ADR mới thay một phần ADR cũ: **không sửa thân ADR cũ**, chỉ thêm 1 dòng vào khối "Ghi chú đọc',
  '  kèm" của file cũ và đổi cột Trạng thái ở đây.',
  '- Bài học áp dụng cho mọi task (bẫy công cụ, quy ước): thêm 1 dòng vào `docs/ai/LESSONS.md`.',
  '',
  '## Bảng',
  '',
  '| # | Ngày | Task | Quyết định | Lớp | Trạng thái | File (`docs/ai/decisions/`) |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...adrs.map(
    (a) =>
      `| ${pad(a.n)} | ${a.date} | ${a.task} | ${cell(a.title)} | ${a.layers} | ${statusOf(a)} | \`${a.file}\` |`,
  ),
  '',
];
writeFileSync('docs/ai/DECISIONS.md', index.join('\n'));

// ----------------------------------------------------------------- progress
const progress = readFileSync(`${ORIGINAL}/PROGRESS.md`, 'utf8').split('\n');
const L = (from, to = from) => progress.slice(from - 1, to);
const NOTE =
  '> Nhật ký task, **nguyên văn** từ `docs/ai/PROGRESS.md` tại thời điểm tách (2026-10-01, commit 566d9f5).\n' +
  '> Số liệu/trạng thái ở đây là lúc task xong; trạng thái hiện tại: `docs/ai/PROGRESS.md`. Task mới: thêm vào CUỐI file.';

const FILES = {
  'p0.md': [
    '# Nhật ký P0 (= M0) — setup monorepo + tooling',
    '',
    NOTE,
    '',
    ...L(7, 24),
    '',
    '### Ghi chú môi trường (từ mục "Bàn giao")',
    '',
    ...L(86, 87),
  ],
  'p1.md': [
    '# Nhật ký P1 — engine core vanilla (task 1.1–1.12)',
    '',
    NOTE,
    '',
    ...L(28, 29),
    ...L(35, 46),
    '',
    ...L(49),
    ...L(83),
    '',
    ...L(109),
  ],
  'p2.md': [
    '# Nhật ký P2 — vertical slice solo vs AI (task 2.1–2.12)',
    '',
    NOTE,
    '',
    ...L(50, 61),
    ...L(63),
  ],
  'p3.md': [
    '# Nhật ký P3 — effect system + chain (task 3.1–3.8)',
    '',
    NOTE,
    '',
    ...L(64, 65),
    ...L(67, 75),
  ],
  'p4.md': [
    '# Nhật ký P4 — card batches + luật mở rộng (task 4.1–…)',
    '',
    NOTE,
    '',
    ...L(76, 80),
    '',
    '### Bàn giao sau 4.2d (ảnh chụp 2026-10-01; bản hiện hành ở `docs/ai/PROGRESS.md`)',
    '',
    ...L(81),
  ],
  'planning.md': [
    '# Nhật ký planning, tư liệu và giá trị đã chốt (không thuộc một phase code)',
    '',
    NOTE,
    '',
    ...L(30),
    ...L(34),
    ...L(48),
    ...L(62),
    ...L(66),
    ...L(84, 85),
    ...L(88),
  ],
};
mkdirSync('docs/ai/progress', { recursive: true });
for (const [name, lines] of Object.entries(FILES)) {
  writeFileSync(`docs/ai/progress/${name}`, `${lines.join('\n')}\n`);
}

console.log(
  `wrote ${adrs.length} ADR files, DECISIONS.md index, ${Object.keys(FILES).length} progress files`,
);
