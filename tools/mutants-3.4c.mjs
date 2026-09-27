// Manual mutation testing for task 3.4c (reaction window after DeclareAttack / NormalSummon / SetMonster).
// Usage: node tools/mutants-3.4c.mjs   (from the repo root)
// Each mutant edits one source snippet, runs the relevant tests and expects a FAILURE (= mutant killed).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const engineTests =
  'src/effects src/actions src/rules src/legal-actions.spells.test.ts src/testing/golden src/testing/fuzz';

const CHAIN = ENGINE + 'effects/chain.ts';
const BATTLE = ENGINE + 'battle/resolve-attack.ts';
const ATTACK = ENGINE + 'actions/handlers/declare-attack.ts';
const SUMMON = ENGINE + 'actions/handlers/summon.ts';

const mutants = [
  // effects/chain.ts — opening, keeping and closing the window
  [
    CHAIN,
    'return reactionTo ? { priorityPlayer, passCount, reactionTo } : { priorityPlayer, passCount };',
    'return { priorityPlayer, passCount };',
    'reactionTo lost when a link is pushed / priority passes',
  ],
  [
    CHAIN,
    'return canActivate(opened, responder) ? opened : null;',
    'return opened;',
    'window opens even when the opponent cannot respond',
  ],
  [
    CHAIN,
    'return canActivate(opened, responder) ? opened : null;',
    'return canActivate(state, responder) ? opened : null;',
    'responder checked without the window (never opens)',
  ],
  [
    CHAIN,
    'chainWindow: { priorityPlayer: responder, passCount: 0, reactionTo },',
    'chainWindow: { priorityPlayer: responder === 0 ? (1 as const) : (0 as const), passCount: 0, reactionTo },',
    'window held by the turn player',
  ],
  [
    CHAIN,
    'if (state.chainStack.length === 0)\n    return continueAfterWindow(',
    'if (false)\n    return continueAfterWindow(',
    'empty window needs two passes (priority goes to the turn player)',
  ],
  [
    CHAIN,
    'return continueAfterWindow({ ...state, chainWindow: null }, window.reactionTo, ctx);',
    'return { state: { ...state, chainWindow: null }, events: [] };',
    'pass closes the window but the attack never resumes',
  ],
  [
    CHAIN,
    "if (reactionTo?.kind !== 'Attack' || state.winnerIndex !== null)",
    "if (reactionTo?.kind !== 'Attack')",
    'attack resumes after the duel ended',
  ],
  [
    CHAIN,
    'const after = continueAfterWindow(current, state.chainWindow?.reactionTo, ctx);',
    'const after = { state: current, events: [] as GameEvent[] };',
    'attack never resumes after a chain',
  ],

  // battle/resolve-attack.ts — re-checks after the window [ASSUMED, no replay]
  [
    BATTLE,
    "if (!found || found.position !== 'Attack') return { state, events: [] };",
    "if (found && found.position !== 'Attack') return { state, events: [] };",
    'attack goes on without its attacker',
  ],
  [
    BATTLE,
    'surviveAttacker();\n      return { state: withPlayers(), events };\n    }\n    target = t;',
    'return { state, events };\n    }\n    target = t;',
    'attacker not marked as having attacked when the target is gone',
  ],
  [BATTLE, 'if (!t) {', 'if (false) {', 'attack goes on without its target'],

  // actions/handlers/declare-attack.ts
  [
    ATTACK,
    'if (window !== null) return { state: { ...window, version: state.version + 1 }, events };',
    'if (false) return { state: { ...window, version: state.version + 1 }, events };',
    'DeclareAttack never opens a window',
  ],
  [
    ATTACK,
    "{ kind: 'Attack', ...declared },",
    "{ kind: 'Attack', ...declared, targetInstanceId: null },",
    'window remembers the wrong target',
  ],
  [
    ATTACK,
    'openReactionWindow(\n    state,\n    opponentIndex,',
    'openReactionWindow(\n    state,\n    playerIndex,',
    'window offered to the attacker',
  ],

  // actions/handlers/summon.ts
  [
    SUMMON,
    'state: { ...(withWindow ?? placedState), version',
    'state: { ...placedState, version',
    'Summon / Set never opens a window',
  ],
  [
    SUMMON,
    'const withWindow = openReactionWindow(',
    "const withWindow = position !== 'Attack' ? null : openReactionWindow(",
    'SetMonster opens no window',
  ],
];

const results = [];
for (const [file, from, to, name] of mutants) {
  const original = readFileSync(file, 'utf8');
  const normalised = original.replace(/\r\n/g, '\n');
  if (!normalised.includes(from)) {
    results.push(`MISSING  ${name}  (pattern not found in ${file})`);
    console.log(results.at(-1));
    continue;
  }
  writeFileSync(file, normalised.replace(from, to));
  let killed = false;
  try {
    execSync(`pnpm --filter @yugi/game-engine exec vitest run ${engineTests}`, { stdio: 'pipe' });
  } catch {
    killed = true;
  } finally {
    writeFileSync(file, original);
  }
  results.push(`${killed ? 'KILLED  ' : 'SURVIVED'} ${name}`);
  console.log(results.at(-1));
}
const survived = results.filter((r) => r.startsWith('SURVIVED') || r.startsWith('MISSING')).length;
console.log(`\n${results.length - survived}/${results.length} mutants killed`);
process.exitCode = survived === 0 ? 0 : 1;
