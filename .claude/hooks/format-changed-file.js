#!/usr/bin/env node
// PostToolUse hook (Edit|Write): best-effort `prettier --write` + `eslint --fix` on the
// file that was just changed. Never blocks the tool result — always exits 0.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const FORMATTABLE = /\.(ts|tsx|js|jsx|cjs|mjs|json|md|yml|yaml)$/;

function readStdin() {
  try {
    return JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

const input = readStdin();
const filePath = input?.tool_input?.file_path;

if (!filePath || !FORMATTABLE.test(filePath)) {
  process.exit(0);
}

const relative = path.relative(process.cwd(), filePath);
if (relative.startsWith('..') || relative.includes('node_modules') || relative.includes('dist')) {
  process.exit(0);
}

spawnSync('pnpm', ['exec', 'prettier', '--write', filePath], { stdio: 'ignore', shell: true });
if (/\.(ts|tsx|js|jsx|cjs|mjs)$/.test(filePath)) {
  spawnSync('pnpm', ['exec', 'eslint', '--fix', filePath], { stdio: 'ignore', shell: true });
}

process.exit(0);
