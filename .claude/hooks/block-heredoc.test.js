// Run: node --test .claude/hooks/block-heredoc.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { isQuotedHeredoc } = require('./block-heredoc.js');

test('blocks heredocs with a quoted or escaped delimiter', () => {
  for (const cmd of [
    "cat > f.txt <<'EOF'\nhi\nEOF",
    'cat > f.txt <<"EOF"\nhi\nEOF',
    "cat <<-'EOF'\nx\nEOF",
    "cat << 'EOF'\nx\nEOF",
    'cat <<\\EOF\nx\nEOF',
    "python - <<'PY'\nprint(1)\nPY",
  ]) {
    assert.equal(isQuotedHeredoc(cmd), true, cmd);
  }
});

test('lets ordinary commands through', () => {
  for (const cmd of [
    'pnpm test',
    'echo $((1<<2))',
    'cat <<< "here-string"',
    'cat <<EOF\nunquoted\nEOF',
    'git commit -m "feat: add <<thing>>"',
    undefined,
    42,
  ]) {
    assert.equal(isQuotedHeredoc(cmd), false, String(cmd));
  }
});

test('as a hook process: exit 2 + message for a blocked command, exit 0 otherwise', () => {
  const script = path.join(__dirname, 'block-heredoc.js');
  const run = (input) => spawnSync('node', [script], { input, encoding: 'utf8' });

  const blocked = run(JSON.stringify({ tool_input: { command: "cat <<'EOF'\nx\nEOF" } }));
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /Tạo file bằng Write/);

  assert.equal(run(JSON.stringify({ tool_input: { command: 'pnpm lint' } })).status, 0);
  assert.equal(run('not json').status, 0);
  assert.equal(run('').status, 0);
});
