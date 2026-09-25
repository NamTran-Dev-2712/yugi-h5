// Manual mutation run for task 2.11: applies one edit at a time, runs the relevant tests, expects them to FAIL, restores.
//   node tools/mutants-2.11.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const API = 'apps/api/src/modules';
const WEB = 'apps/web/src';
const MUTANTS = [
  [
    'zone index ignored',
    `${API}/dev-sandbox/scenario-to-state.ts`,
    'monsterZones[m.zone] = make(',
    'monsterZones[0] = make(',
    'api',
  ],
  [
    'duplicate monster zone allowed',
    `${API}/dev-sandbox/scenario-to-state.ts`,
    'if (monsterZones[m.zone]) {',
    'if (false as boolean) {',
    'api',
  ],
  [
    'duplicate spell zone allowed',
    `${API}/dev-sandbox/scenario-to-state.ts`,
    'if (spellTrapZones[s.zone]) {',
    'if (false as boolean) {',
    'api',
  ],
  [
    'instance id of seat 1 uses p0',
    `${API}/dev-sandbox/scenario-to-state.ts`,
    'instanceId: `p${seat}-${n++}`',
    'instanceId: `p0-${n++}`',
    'api',
  ],
  [
    'turn player ignored',
    `${API}/dev-sandbox/scenario-to-state.ts`,
    'turnPlayerIndex: scenario.turn.player',
    'turnPlayerIndex: 0',
    'api',
  ],
  [
    'owner always 0',
    `${API}/dev-sandbox/scenario-to-state.ts`,
    'ownerIndex: seat,',
    'ownerIndex: 0,',
    'api',
  ],
  [
    'unknown card accepted',
    `${API}/dev-sandbox/scenario-to-state.ts`,
    'if (!lookup(definitionId)) {',
    'if (false as boolean) {',
    'api',
  ],
  [
    'summonedTurn dropped',
    `${API}/dev-sandbox/scenario-to-state.ts`,
    'm.summonedTurn !== undefined ? { summonedTurn: m.summonedTurn } : {}',
    '{}',
    'api',
  ],
  [
    'spell in monsters accepted',
    `${API}/dev-sandbox/scenario-to-state.ts`,
    "lookup(m.card)?.kind !== 'Monster'",
    'false',
    'api',
  ],
  [
    'failed script leaves session behind',
    `${API}/duels/duel-manager.ts`,
    'await this.store.delete(duelId);\n          if (e instanceof DuelServiceError',
    'if (e instanceof DuelServiceError',
    'api',
  ],
  [
    'scenario session loses initialState',
    `${API}/duels/duel-manager.ts`,
    '      initialState: config.state,\n',
    '',
    'api',
  ],
  [
    'script ignored',
    `${API}/duels/duel-manager.ts`,
    '(config.script ?? []).entries()',
    '([] as never[]).entries()',
    'api',
  ],
  [
    'default mode solo-debug',
    `${API}/dev-sandbox/dev-sandbox.controller.ts`,
    ".default('solo-vs-ai')",
    ".default('solo-debug')",
    'api',
  ],
  [
    'sandbox mounted in production',
    `${API}/dev-sandbox/dev-modules.ts`,
    "nodeEnv === 'production' ?",
    "nodeEnv !== 'production' ?",
    'api',
  ],
  [
    'owner not recorded',
    `${API}/dev-sandbox/dev-sandbox.controller.ts`,
    '      ownerId: guestId,\n',
    '',
    'api',
  ],
  [
    'web startScenario uses createSolo',
    `${WEB}/duel/duel-controller.ts`,
    'a.createSandbox(scenario)',
    "a.createSolo({ mode: 'solo-vs-ai' })",
    'web',
  ],
  [
    'web api posts to /duels/solo',
    `${WEB}/api/duel-api.ts`,
    '`/dev/sandbox/duels?mode=${mode}`',
    '`/duels/solo?mode=${mode}`',
    'web',
  ],
  [
    'web api ignores mode',
    `${WEB}/api/duel-api.ts`,
    "mode = 'solo-vs-ai'",
    "_mode = 'solo-vs-ai'",
    'web',
  ],
  [
    'web accepts empty text',
    `${WEB}/dev/sandbox-load.ts`,
    "if (trimmed === '') return",
    'if (false as boolean) return',
    'web',
  ],
  [
    'web samples unsorted',
    `${WEB}/dev/sandbox-load.ts`,
    '.sort((a, b) => a.name.localeCompare(b.name))',
    '',
    'web',
  ],
];
const TESTS = {
  api: [
    'pnpm',
    [
      '--filter',
      '@yugi/api',
      'exec',
      'vitest',
      'run',
      'src/modules/dev-sandbox',
      'src/modules/duels/duel-manager.scenario.spec.ts',
    ],
  ],
  web: [
    'pnpm',
    [
      '--filter',
      '@yugi/web',
      'exec',
      'vitest',
      'run',
      'src/dev',
      'src/api',
      'src/duel/duel-controller.test.ts',
    ],
  ],
};
let survived = 0;
for (const [name, file, from, to, suite] of MUTANTS) {
  const original = readFileSync(file, 'utf8');
  if (!original.includes(from)) {
    console.log(`SKIP (pattern not found) ${name}`);
    survived++;
    continue;
  }
  writeFileSync(file, original.replace(from, to));
  const [cmd, args] = TESTS[suite];
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: true });
  writeFileSync(file, original);
  const killed = r.status !== 0;
  if (!killed) survived++;
  console.log(`${killed ? 'killed  ' : 'SURVIVED'} ${name}`);
}
console.log(`\n${MUTANTS.length - survived}/${MUTANTS.length} mutants killed`);
process.exit(survived === 0 ? 0 : 1);
