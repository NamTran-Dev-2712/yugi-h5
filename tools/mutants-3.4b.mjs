// Manual mutation testing for task 3.4b (chain / Set cards / reaction windows / trigger prompts on the wire).
// Usage: node tools/mutants-3.4b.mjs   (from the repo root; build packages/shared first — api/web read its dist)
// Each mutant edits one source snippet, runs the relevant tests and expects a FAILURE (= mutant killed).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const DUELS = 'apps/api/src/modules/duels/';
const WEB = 'apps/web/src/';
const SHARED = 'packages/shared/src/';

const apiTests = [
  'src/modules/duels/state-view.spec.ts',
  'src/modules/duels/state-view.chain.spec.ts',
  'src/modules/duels/event-view.spec.ts',
  'src/modules/duels/duel-manager.chain.spec.ts',
  'src/modules/duels/duel-manager.spell-trap.spec.ts',
  'src/modules/duels/ai/choose-action.spec.ts',
  'src/modules/duels/ai/simulate.chain.spec.ts',
  'src/modules/duels/event-visibility.fuzz.spec.ts',
  'src/modules/duels/testing',
].join(' ');

const MANAGER = DUELS + 'duel-manager.ts';
const STATE_VIEW = DUELS + 'state-view.ts';
const EVENT_VIEW = DUELS + 'event-view.ts';
const AI = DUELS + 'ai/choose-action.ts';
const SIM = DUELS + 'ai/simulate.ts';
const LEAK = DUELS + 'testing/leak-check.ts';

const mutants = [
  // DuelManager — who acts
  [
    MANAGER,
    '  state.pendingPrompt?.playerIndex ?? state.chainWindow?.priorityPlayer ?? state.turnPlayerIndex;',
    '  state.pendingPrompt?.playerIndex ?? state.turnPlayerIndex;',
    'actorOf ignores the chain priority holder (AI never answers a window)',
  ],
  // toEventView — chain events forwarded
  [EVENT_VIEW, "    case 'ChainLinkAdded':\n", '', 'ChainLinkAdded dropped again'],
  // toStateView — chain / window / effective stats
  [STATE_VIEW, '  chain: state.chainStack.map(chainLinkView),', '  chain: [],', 'chain not sent'],
  [
    STATE_VIEW,
    '  targetInstanceIds: link.targetInstanceIds,\n});',
    '  targetInstanceIds: link.targetInstanceIds,\n  costInstanceIds: link.costInstanceIds,\n} as ChainLinkView);',
    'chain link view leaks the cost ids',
  ],
  [
    STATE_VIEW,
    '        ...(w.reactionTo ? { reactionTo: w.reactionTo } : {}),\n',
    '',
    'chainWindow drops reactionTo',
  ],
  [
    STATE_VIEW,
    "  if (c.position === 'DefenseDown') return isOwner ? visible(c) : hiddenCard(c);",
    "  if (c.position === 'DefenseDown' && !isOwner) return hiddenCard(c);",
    'effective stats on the owner’s face-down monster',
  ],
  [
    STATE_VIEW,
    '  return { ...visible(c), effectiveStats: { atk: stats.atk, def: stats.def } };',
    '  return { ...visible(c), effectiveStats: { atk: stats.atk, def: stats.atk } };',
    'effective DEF reports ATK',
  ],
  [
    STATE_VIEW,
    "new Set(['DiscardToHandLimit'])",
    "new Set(['DiscardToHandLimit', 'TriggerActivation'])",
    'TriggerActivation payload shown to the player who is not asked',
  ],
  // AI policy
  [
    AI,
    "    return pick ?? legalActions.find((a) => a.type === 'PassPriority');",
    "    return legalActions.find((a) => a.type === 'PassPriority');",
    'AI never answers a window with a card',
  ],
  [
    AI,
    '      return effect !== undefined && harmsOpponent(effect);',
    '      return effect !== undefined;',
    'AI activates any answer, harmful or not',
  ],
  [
    AI,
    "    const pass = legalActions.find((a) => a.type === 'PassPriority');\n    if (pass) return pass;\n",
    '',
    'fallback skips PassPriority',
  ],
  [
    AI,
    '    if (view.chainWindow?.priorityPlayer === seat) return respond();\n',
    '',
    'AI ignores the window it holds',
  ],
  [
    AI,
    "      (a) => a.type === 'ResolvePendingPrompt' && a.payload.decline !== true,",
    "      (a) => a.type === 'ResolvePendingPrompt',",
    'AI may decline a trigger it could accept',
  ],
  [
    AI,
    '      oppIds.has(id) ? (stats.get(id)?.atk ?? 500) : -valueOf(id);',
    '      oppIds.has(id) ? -(stats.get(id)?.atk ?? 500) : valueOf(id);',
    'AI targets the weakest opponent card',
  ],
  // simulate harness
  [
    SIM,
    '      state.pendingPrompt?.playerIndex ?? state.chainWindow?.priorityPlayer ?? state.turnPlayerIndex;',
    '      state.pendingPrompt?.playerIndex ?? state.turnPlayerIndex;',
    'simulation asks the turn player during a window',
  ],
  // leak oracle
  [
    LEAK,
    "  const link = state.chainStack.find((l) => l.card.instanceId === instanceId);\n  if (link) return { zone: 'chain', card: link.card };\n",
    '',
    'oracle forgets chain links (a false positive)',
  ],
  [
    LEAK,
    "    case 'chain':\n      return null;\n",
    "    case 'chain':\n      return 'x';\n",
    'oracle treats the chain as hidden',
  ],
  // web — debug page + wording
  [
    WEB + 'debug/build-actions.ts',
    '  if (view.chainWindow?.priorityPlayer === seat) {',
    '  if (view.chainWindow !== null) {',
    'debug page offers PassPriority to the seat without priority',
    'web',
  ],
  [
    WEB + 'debug/build-actions.ts',
    '        (p.decline === true) === (button.fixed.decline === true) &&\n',
    '',
    'accept button matches a decline answer',
    'web',
  ],
  [
    WEB + 'debug/build-actions.ts',
    '    view.pendingPrompt?.playerIndex ?? view.chainWindow?.priorityPlayer ?? view.turnPlayerIndex',
    '    view.pendingPrompt?.playerIndex ?? view.turnPlayerIndex',
    'pickViewer ignores the priority holder',
    'web',
  ],
  [
    WEB + 'debug/describe-ai-action.ts',
    "      if (action.payload.decline === true) return t('ai.declineTrigger');\n",
    '',
    'AI decline worded as accept',
    'web',
  ],
  // shared — wire schema
  [
    SHARED + 'duel/action-schema.ts',
    '        decline: z.boolean().optional(),',
    '        decline: z.unknown().optional(),',
    'decline accepts any value',
    'shared',
  ],
  [
    SHARED + 'duel/action-schema.ts',
    "  .object({ type: z.literal('PassPriority'), payload: z.object({ playerIndex: Seat }).strict() })",
    "  .object({ type: z.literal('PassPriority'), payload: z.object({ playerIndex: Seat }).passthrough() })",
    'PassPriority payload not strict',
    'shared',
  ],
];

const results = [];
for (const [file, from, to, name, pkg = 'api'] of mutants) {
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
    if (pkg === 'shared') {
      execSync('pnpm --filter @yugi/shared exec vitest run', { stdio: 'pipe' });
    } else if (pkg === 'web') {
      execSync('pnpm --filter @yugi/web exec vitest run src/debug src/i18n', { stdio: 'pipe' });
    } else {
      execSync(`pnpm --filter @yugi/api exec vitest run ${apiTests}`, { stdio: 'pipe' });
    }
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
