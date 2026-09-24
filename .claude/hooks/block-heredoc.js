#!/usr/bin/env node
// PreToolUse hook (matcher: Bash): refuses shell commands that contain a heredoc with a quoted delimiter
// (`<<'EOF'`, `<<"EOF"`, `<<-'EOF'`, `<<\EOF`). Files must be created with the Write tool instead.
// Exit code 2 = block; stderr is shown to the model. Anything else (bad input included) lets the command through.

const MESSAGE =
  'Tạo file bằng Write (không dùng heredoc có dấu nháy trong Bash). Dùng công cụ Write/Edit để tạo hoặc sửa file.';

/** `<<` (not part of `<<<`) followed by optional `-`, optional spaces, then a quote or backslash. */
const QUOTED_HEREDOC = /(^|[^<])<<-?[ \t]*['"\\]/;

/** @param {unknown} command */
function isQuotedHeredoc(command) {
  return typeof command === 'string' && QUOTED_HEREDOC.test(command);
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (raw += chunk));
  process.stdin.on('end', () => {
    let command;
    try {
      command = JSON.parse(raw)?.tool_input?.command;
    } catch {
      process.exit(0);
    }
    if (isQuotedHeredoc(command)) {
      process.stderr.write(`${MESSAGE}\n`);
      process.exit(2);
    }
    process.exit(0);
  });
}

if (require.main === module) main();

module.exports = { isQuotedHeredoc, MESSAGE };
