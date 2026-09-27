// Manual mutation testing for task 3.3 (chain stack). Usage: node tools/mutants-3.3.mjs   (from the repo root)
// Each mutant edits one source snippet, runs the relevant tests and expects a FAILURE (= mutant killed).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const API = 'apps/api/src/modules/duels/';
const engineTests =
  'src/effects src/actions src/legal-actions.spells.test.ts src/testing/golden src/testing/fuzz';
const apiTests =
  'src/modules/duels/event-view.spec.ts src/modules/duels/duel-manager.spell-trap.spec.ts';

const CHAIN = ENGINE + 'effects/chain.ts';
const ACT = ENGINE + 'actions/handlers/activate-effect.ts';
const PASS = ENGINE + 'actions/handlers/pass-priority.ts';

const mutants = [
  // effects/chain.ts — push / priority / pass
  [
    CHAIN,
    'chainWindow: { priorityPlayer: other(link.playerIndex), passCount: 0 },',
    'chainWindow: { priorityPlayer: link.playerIndex, passCount: 0 },',
    'activator keeps priority after a new link',
  ],
  [
    CHAIN,
    'chainWindow: { priorityPlayer: other(link.playerIndex), passCount: 0 },',
    'chainWindow: { priorityPlayer: other(link.playerIndex), passCount: 1 },',
    'new link does not reset consecutive passes',
  ],
  [
    CHAIN,
    'chainIndex: chainStack.length,',
    'chainIndex: state.chainStack.length,',
    'chainIndex off by one',
  ],
  [
    CHAIN,
    'if (window.passCount === 1) return resolveChain(state, ctx);',
    'if (window.passCount === 0) return resolveChain(state, ctx);',
    'first pass resolves the chain',
  ],
  [
    CHAIN,
    'chainWindow: { priorityPlayer: other(window.priorityPlayer), passCount: 1 },',
    'chainWindow: { priorityPlayer: window.priorityPlayer, passCount: 1 },',
    'a pass keeps priority with the same player',
  ],
  [
    CHAIN,
    '  while (\n    current.chainWindow !== null &&',
    '  if (\n    current.chainWindow !== null &&',
    'settle auto-passes at most once',
  ],
  [
    CHAIN,
    '    !canActivate(current, current.chainWindow.priorityPlayer)',
    '    canActivate(current, current.chainWindow.priorityPlayer)',
    'settle auto-passes the player who CAN respond',
  ],
  // effects/chain.ts — resolution
  [
    CHAIN,
    'for (let i = links.length - 1; i >= 0; i--) {',
    'for (let i = 0; i < links.length; i++) {',
    'chain resolves FIFO instead of LIFO',
  ],
  [
    CHAIN,
    '    if (current.winnerIndex === null) {\n      const out = resolveLink(current, link, ctx);',
    '    {\n      const out = resolveLink(current, link, ctx);',
    'links keep resolving after the duel ended',
  ],
  [
    CHAIN,
    "if (current.winnerIndex === null) events.push({ type: 'ChainResolved', linkCount: links.length });",
    "events.push({ type: 'ChainResolved', linkCount: links.length });",
    'ChainResolved emitted after the duel ended',
  ],
  [
    CHAIN,
    "    ...events.filter((e) => e.type !== 'DuelEnded'),\n    ...events.filter((e) => e.type === 'DuelEnded'),",
    '    ...events,',
    'DuelEnded not last',
  ],
  [
    CHAIN,
    'graveyard: [...owner.graveyard, toGraveyard(link.card)]',
    'graveyard: [...owner.graveyard]',
    'resolved Spell never reaches the graveyard',
  ],
  [
    CHAIN,
    'targetInstanceIds = link.targetInstanceIds.filter((id) => stillValid.has(id));',
    'targetInstanceIds = link.targetInstanceIds;',
    'targets not re-checked at resolution',
  ],
  [
    CHAIN,
    '    if (targetInstanceIds.length === 0) {',
    '    if (false) {',
    'no fizzle when every target is gone',
  ],
  [
    CHAIN,
    'let current: GameState = { ...state, chainStack: [], chainWindow: null };',
    'let current: GameState = { ...state, chainWindow: null };',
    'chain not cleared after resolution',
  ],
  // activate-effect.ts — chain mode
  [
    ACT,
    'if (state.chainWindow !== null && state.chainWindow.priorityPlayer !== playerIndex)',
    'if (false)',
    'non-holder may activate in a window',
  ],
  [
    ACT,
    'if (top && (kind.speed < 2 || kind.speed < top.spellSpeed))',
    'if (top && kind.speed < top.spellSpeed)',
    'Speed 1 may respond to Speed 1',
  ],
  [
    ACT,
    'if (top && (kind.speed < 2 || kind.speed < top.spellSpeed))',
    'if (false)',
    'no Spell Speed check at all',
  ],
  [
    ACT,
    "QuickPlay: { trigger: 'Quick', speed: 2 },",
    "QuickPlay: { trigger: 'Quick', speed: 1 },",
    'Quick-Play is Speed 1',
  ],
  [
    ACT,
    "QuickPlay: { trigger: 'Quick', speed: 2 },",
    "QuickPlay: { trigger: 'Ignition', speed: 2 },",
    'Quick-Play expects an Ignition trigger',
  ],
  [
    ACT,
    "lpPaid: costPlan.reduce((sum, step) => (step.kind === 'PayLP' ? sum + step.amount : sum), 0),",
    'lpPaid: 0,',
    'LP cost not recorded on the link',
  ],
  [
    ACT,
    '    costInstanceIds: costPlan.flatMap(',
    '    costInstanceIds: [].flatMap(',
    'card cost not recorded on the link',
  ],
  [
    ACT,
    '    targetInstanceIds,\n  };\n  const pushed',
    '    targetInstanceIds: [],\n  };\n  const pushed',
    'targets not recorded on the link',
  ],
  [
    ACT,
    'const settled = settle(pushed.state, ctx, (s, seat) => hasLegalActivation(s, seat, ctx));',
    'const settled = { state: pushed.state, events: [] };',
    'no auto-pass after an activation',
  ],
  [
    ACT,
    '      return true;\n    } catch (error) {',
    '      return false;\n    } catch (error) {',
    'nobody can ever respond',
  ],
  [
    ACT,
    '  return false;\n}\n\n/**\n * The Spell leaves the hand',
    '  return true;\n}\n\n/**\n * The Spell leaves the hand',
    'everybody can always respond',
  ],
  [
    ACT,
    'linkId: `link-${state.turnCount}-${state.version}`,',
    'linkId: `link-${state.turnCount}`,',
    'linkId not unique per activation',
  ],
  // pass-priority.ts
  [
    PASS,
    "if (state.winnerIndex !== null) reject('DUEL_ENDED', 'the duel has already ended.');",
    '',
    'pass after the duel ended',
  ],
  [
    PASS,
    "if (state.pendingPrompt !== null) reject('PENDING_PROMPT', 'a prompt is pending.');",
    '',
    'pass while a prompt is pending',
  ],
  [
    PASS,
    'if (window.priorityPlayer !== action.payload.playerIndex)',
    'if (false)',
    'anyone may pass',
  ],
  [
    PASS,
    'const settled = settle(passed.state, ctx, (s, seat) => hasLegalActivation(s, seat, ctx));',
    'const settled = { state: passed.state, events: [] };',
    'no auto-pass after a manual pass',
  ],
  // apply-action.ts — window blocks other actions
  [
    ENGINE + 'apply-action.ts',
    '    state.chainWindow !== null &&\n    state.winnerIndex === null &&',
    '    false &&\n    state.winnerIndex === null &&',
    'window does not block other actions',
  ],
  [
    ENGINE + 'apply-action.ts',
    "  'ResolvePendingPrompt',\n  'Surrender',\n]);",
    "  'ResolvePendingPrompt',\n]);",
    'Surrender blocked by the window',
  ],
  [
    ENGINE + 'apply-action.ts',
    "const CHAIN_WINDOW_ACTIONS: ReadonlySet<Action['type']> = new Set([\n  'ActivateEffect',",
    "const CHAIN_WINDOW_ACTIONS: ReadonlySet<Action['type']> = new Set([\n  'Nope',",
    'responses blocked by the window',
  ],
  // legal-actions.ts
  [
    ENGINE + 'legal-actions.ts',
    "  out.push({ type: 'PassPriority', payload: { playerIndex: seat } });\n",
    '',
    'PassPriority never listed',
  ],
  // API containment
  [
    API + 'event-view.ts',
    "    case 'ChainResolved':\n      return null;",
    "    case 'ChainResolved':\n      return event as never;",
    'chain events forwarded',
  ],
  [API + 'duel-manager.ts', "new Set(['PassPriority'])", 'new Set([])', 'PassPriority on the wire'],
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
  const cmd = file.startsWith('apps/api')
    ? `pnpm --filter @yugi/api exec vitest run ${apiTests}`
    : `pnpm --filter @yugi/game-engine exec vitest run ${engineTests}`;
  let killed = false;
  try {
    execSync(cmd, { stdio: 'pipe' });
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
