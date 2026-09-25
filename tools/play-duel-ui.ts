/**
 * Runs the real-network checks of the Duel UI layer (DuelController + interaction machine) against a running API.
 * Needs the API + Postgres up (`pnpm dev`). The controller imports extensionless modules, so it cannot run under plain
 * Node; this wrapper starts vitest with the e2e config (files `apps/web/src/e2e/*.e2e.ts`).
 *   node --experimental-strip-types tools/play-duel-ui.ts [filter]
 */
import { spawnSync } from 'node:child_process';

const filter = process.argv[2];
const args = ['--filter', '@yugi/web', 'exec', 'vitest', 'run', '-c', 'vitest.e2e.config.ts'];
if (filter) args.push(filter);
const res = spawnSync('pnpm', args, { stdio: 'inherit', shell: true });
process.exit(res.status ?? 1);
