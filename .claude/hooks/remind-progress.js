#!/usr/bin/env node
// Stop hook: reminds (never blocks) to update docs/ai/PROGRESS.md when other files
// changed in the working tree but PROGRESS.md did not.
const { spawnSync } = require('node:child_process');

const result = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
const lines = (result.stdout || '').split('\n').filter(Boolean);

const touchedOther = lines.some((l) => !l.includes('docs/ai/PROGRESS.md'));
const touchedProgress = lines.some((l) => l.includes('docs/ai/PROGRESS.md'));

if (touchedOther && !touchedProgress) {
  console.log(
    '[reminder] Có thay đổi chưa commit nhưng docs/ai/PROGRESS.md chưa được cập nhật — ' +
      'nhớ ghi lại tiến độ/bàn giao trước khi kết thúc task (xem quy trình trong CLAUDE.md).',
  );
}

process.exit(0);
