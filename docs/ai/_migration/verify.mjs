// Read-only check of the 2026-10-01 docs restructuring. Run from the repo root:
//   node docs/ai/_migration/verify.mjs
// Exits 1 if any check fails.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const ORIGINAL = 'docs/ai/_migration/original';
const read = (p) => readFileSync(p, 'utf8');
const chars = (s) => [...s].length;
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};
const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// 0. The frozen copies really are what was committed.
for (const [copy, tracked] of [
  ['CLAUDE.md', 'CLAUDE.md'],
  ['PROGRESS.md', 'docs/ai/PROGRESS.md'],
  ['DECISIONS.md', 'docs/ai/DECISIONS.md'],
]) {
  const committed = git(`show 566d9f5:${tracked}`).replace(/\r\n/g, '\n');
  check(`0. original/${copy} == git 566d9f5:${tracked}`, committed === read(`${ORIGINAL}/${copy}`));
}

// 1. ADR bodies, concatenated in order, are byte-identical to the original file.
const originalDecisions = read(`${ORIGINAL}/DECISIONS.md`);
const adrFiles = readdirSync('docs/ai/decisions')
  .filter((f) => /^\d{3}-.*\.md$/.test(f))
  .sort();
const bodies = adrFiles.map((f) => {
  const text = read(`docs/ai/decisions/${f}`);
  const start = text.search(/^## /m);
  return text.slice(start).replace(/\s+$/, '');
});
const preamble = originalDecisions.slice(0, originalDecisions.indexOf('\n## ') + 1);
check('1a. 62 ADR files', adrFiles.length === 62, `${adrFiles.length} files`);
check(
  '1b. ADR bodies joined == original DECISIONS.md (byte-identical)',
  `${preamble}${bodies.join('\n\n')}\n` === originalDecisions,
  `${chars(originalDecisions)} chars`,
);
check(
  '1c. file numbers are 001..062 without gaps',
  adrFiles.every((f, i) => f.startsWith(String(i + 1).padStart(3, '0'))),
);

// 2. Every non-empty line of the original PROGRESS.md lives, verbatim, in exactly one place.
const REWRITTEN_PROGRESS_LINES = new Set([1, 3, 5, 26, 32]); // title, intro, phase header, 2 section headings
const progressTargets = [
  'docs/ai/PROGRESS.md',
  ...readdirSync('docs/ai/progress').map((f) => `docs/ai/progress/${f}`),
];
const targetLines = progressTargets.flatMap((p) => read(p).split('\n'));
const badProgress = [];
read(`${ORIGINAL}/PROGRESS.md`)
  .split('\n')
  .forEach((line, i) => {
    if (line.trim() === '' || REWRITTEN_PROGRESS_LINES.has(i + 1)) return;
    const hits = targetLines.filter((l) => l === line).length;
    if (hits !== 1) badProgress.push(`line ${i + 1} found ${hits}×`);
  });
check(
  '2. PROGRESS.md lines preserved verbatim, each exactly once',
  badProgress.length === 0,
  badProgress.join('; '),
);

// 3. Root CLAUDE.md: only the intended lines changed.
const INTENDED_CLAUDE_CHANGES = new Set([5, 7, 8, 9, 12, 65, 70, 71, 72, 75, 76]);
const newClaude = new Set(
  read('CLAUDE.md')
    .split('\n')
    .map((l) => l.trim()),
);
const lostClaude = [];
read(`${ORIGINAL}/CLAUDE.md`)
  .split('\n')
  .forEach((line, i) => {
    if (line.trim() === '' || newClaude.has(line.trim())) return;
    if (!INTENDED_CLAUDE_CHANGES.has(i + 1)) lostClaude.push(i + 1);
  });
check(
  '3. root CLAUDE.md: no rule line lost outside the intended edits',
  lostClaude.length === 0,
  lostClaude.join(','),
);

// 4. Paths and ADR numbers mentioned by the routing docs exist.
const ROUTING = [
  'CLAUDE.md',
  'docs/ai/PROGRESS.md',
  'docs/ai/INDEX.md',
  'docs/ai/LESSONS.md',
  'docs/ai/DECISIONS.md',
  'docs/ai/OPEN-ISSUES.md',
  ...adrFiles.map((f) => `docs/ai/decisions/${f}`),
];
const missingPaths = [];
const badAdrNumbers = [];
for (const doc of ROUTING) {
  if (!existsSync(doc)) {
    missingPaths.push(`${doc} (file itself)`);
    continue;
  }
  const text = read(doc);
  const header = doc.includes('/decisions/') ? text.slice(0, text.search(/^## /m)) : text;
  for (const [, token] of header.matchAll(/`([^`\n]+)`/g)) {
    if (
      !/^(docs|\.claude|packages|apps|tools)\//.test(token) &&
      !/^\d{3}-\d{4}-.*\.md$/.test(token)
    )
      continue;
    if (/[<>*{}…\s]|\.\.\./.test(token)) continue;
    const path = /^\d{3}-/.test(token)
      ? `docs/ai/decisions/${token}`
      : token.replace(/[.,;:]$/, '');
    if (!existsSync(path)) missingPaths.push(`${doc}: ${token}`);
  }
  for (const [, n] of header.matchAll(/ADR (\d{3})\b/g)) {
    if (Number(n) < 1 || Number(n) > adrFiles.length) badAdrNumbers.push(`${doc}: ADR ${n}`);
  }
}
check(
  '4a. every path named in routing docs / ADR headers exists',
  missingPaths.length === 0,
  missingPaths.join('; '),
);
check(
  '4b. every "ADR NNN" points at an existing file',
  badAdrNumbers.length === 0,
  badAdrNumbers.join('; '),
);
const indexText = read('docs/ai/DECISIONS.md');
check(
  '4c. index lists every ADR file',
  adrFiles.every((f) => indexText.includes(`\`${f}\``)),
);

// 5. Old-style references anywhere in the repo ("ADR 3.3", "ADR 2026-09-24") resolve via the index.
const rows = indexText
  .split('\n')
  .filter((l) => /^\| \d{3} /.test(l))
  .map((l) => l.split('|').map((c) => c.trim()));
const dates = new Set(rows.map((r) => r[2]));
const tasks = new Set(rows.map((r) => r[3]));
const unresolved = new Set();
const tracked = git('ls-files')
  .split('\n')
  .filter((f) => /\.(md|ts|mjs|js|json)$/.test(f) && !f.startsWith('docs/ai/_migration/'));
const untracked = [
  ...progressTargets,
  'docs/ai/INDEX.md',
  'docs/ai/LESSONS.md',
  'docs/ai/OPEN-ISSUES.md',
];
for (const f of new Set([
  ...tracked,
  ...untracked,
  ...adrFiles.map((a) => `docs/ai/decisions/${a}`),
])) {
  if (!existsSync(f)) continue;
  const text = read(f);
  for (const [, d] of text.matchAll(/ADR (20\d\d-\d\d-\d\d)/g))
    if (!dates.has(d)) unresolved.add(`${f}: ADR ${d}`);
  for (const [, t] of text.matchAll(/ADR (\d\.\d+[a-d]?)(?![\d-])/g)) {
    if (!tasks.has(t)) unresolved.add(`${f}: ADR ${t}`);
  }
}
check(
  '5. every "ADR <task>" / "ADR <date>" reference resolves in the index',
  unresolved.size === 0,
  [...unresolved].join('; '),
);

// 6. Default-loaded context size.
const before = ['CLAUDE.md', 'PROGRESS.md', 'DECISIONS.md'].map((f) => [
  f,
  chars(read(`${ORIGINAL}/${f}`)),
]);
const after = ['CLAUDE.md', 'docs/ai/PROGRESS.md', 'docs/ai/INDEX.md', 'docs/ai/LESSONS.md'].map(
  (f) => [f, chars(read(f))],
);
const sum = (xs) => xs.reduce((a, [, n]) => a + n, 0);
console.log(
  '\nAuto-loaded BEFORE:',
  before.map(([f, n]) => `${f} ${n}`).join(' + '),
  '=',
  sum(before),
  'chars',
);
console.log(
  'Auto-loaded AFTER: ',
  after.map(([f, n]) => `${f} ${n}`).join(' + '),
  '=',
  sum(after),
  'chars',
);
console.log(`Reduction: ${(100 * (1 - sum(after) / sum(before))).toFixed(1)}%`);
const imports = [...read('CLAUDE.md').matchAll(/^@(\S+)$/gm)].map((m) => m[1]);
check('6a. auto-loaded total < 40,000 chars', sum(after) < 40000, `${sum(after)}`);
check(
  '6b. CLAUDE.md imports exactly PROGRESS, INDEX, LESSONS',
  imports.join(',') === 'docs/ai/PROGRESS.md,docs/ai/INDEX.md,docs/ai/LESSONS.md',
  imports.join(','),
);

// 7. Nothing on disk shrank: all knowledge files together are at least as large as before.
const onDisk =
  sum(after) +
  chars(indexText) +
  adrFiles.reduce((a, f) => a + chars(read(`docs/ai/decisions/${f}`)), 0) +
  readdirSync('docs/ai/progress').reduce((a, f) => a + chars(read(`docs/ai/progress/${f}`)), 0);
check(
  '7. total knowledge on disk did not shrink',
  onDisk >= sum(before),
  `${sum(before)} → ${onDisk} chars`,
);

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
