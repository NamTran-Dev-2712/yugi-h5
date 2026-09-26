// Manual mutation testing for task 3.2b. Usage: node tools/mutants-3.2b.mjs [api|web]   (from the repo root)
// Each mutant edits one source snippet, runs the listed tests and expects a FAILURE (= mutant killed).
// The "gate" mutants run ONLY the fuzz gate (event-visibility.fuzz.spec.ts): they show the fuzz alone catches a leak.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'apps/api/src/modules/duels/';
const WEB = 'apps/web/src/';
const FUZZ =
  'pnpm --filter @yugi/api exec vitest run src/modules/duels/event-visibility.fuzz.spec.ts';
const API_ALL = 'pnpm --filter @yugi/api exec vitest run src/modules/duels';
const WEB_ALL = 'pnpm --filter @yugi/web exec vitest run';

/** [file, from, to, name, command] */
const API_MUTANTS = [
  // --- gate: leaks the fuzz must catch on its own ---
  [
    API + 'state-view.ts',
    "return isOwner || c.position === 'Attack' || c.position === 'DefenseUp'",
    'return true',
    'gate: opponent Set Spell/Trap shown face-up',
    FUZZ,
  ],
  [
    API + 'state-view.ts',
    'hand: p.hand.map((c) => (isOwner ? visible(c) : hiddenCard(c))),',
    'hand: p.hand.map((c) => visible(c)),',
    'gate: opponent hand shown',
    FUZZ,
  ],
  [
    API + 'state-view.ts',
    "return isOwner || c.position !== 'DefenseDown' ? visible(c) : hiddenCard(c);",
    'return visible(c);',
    'gate: opponent Set monster shown',
    FUZZ,
  ],
  [
    API + 'state-view.ts',
    'if (prompt.playerIndex === viewerIndex || PUBLIC_PROMPT_KINDS.has(prompt.kind)) return prompt;',
    'return prompt;',
    'gate: SelectEffectTarget payload sent to the other player',
    FUZZ,
  ],
  [
    API + 'event-view.ts',
    '            : { hidden: true, instanceId: event.instanceId, ownerIndex: event.playerIndex },',
    '            : { hidden: false, instanceId: event.instanceId, definitionId: event.definitionId, position: null, ownerIndex: event.playerIndex },',
    'gate: opponent draw revealed',
    FUZZ,
  ],
  [
    API + 'testing/leak-check.ts',
    'return card.ownerIndex === viewer ? null : "card is in the opponent\'s hand";',
    'return null;',
    'oracle: opponent hand allowed (leak-check self-test must catch it)',
    'pnpm --filter @yugi/api exec vitest run src/modules/duels/testing',
  ],
  // --- wiring ---
  [
    API + 'event-view.ts',
    "    case 'SpellTrapSet':\n    case 'EffectActivated':",
    "    case 'EffectActivated':",
    'SpellTrapSet no longer forwarded (typecheck)',
    'pnpm --filter @yugi/api typecheck',
  ],
  [
    API + 'duel-manager.ts',
    "(a) => a.type !== 'StartDuel' && a.type !== 'Draw',",
    "(a) => a.type !== 'StartDuel' && a.type !== 'Draw' && a.type !== 'SetSpellTrap',",
    'SetSpellTrap hidden from legalActions again',
    API_ALL,
  ],
  [
    API + 'duel-manager.ts',
    "if (action.type === 'StartDuel' || action.type === 'Draw') {",
    "if (action.type === 'StartDuel' || action.type === 'Draw' || action.type === 'ActivateEffect') {",
    'ActivateEffect refused again',
    API_ALL,
  ],
];

const WEB_MUTANTS = [
  [
    WEB + 'duel/legal-index.ts',
    '.filter((a): a is FromHandAction => isFromHand(a) && mine(a, viewer))',
    '.filter((a): a is FromHandAction => isSummon(a) && mine(a, viewer))',
    'Spells/Traps cannot be dragged',
    WEB_ALL,
  ],
  [
    WEB + 'duel/legal-index.ts',
    "a.type === 'SetSpellTrap' && mine(a, viewer) && a.payload.cardInstanceId === cardId,",
    "a.type === 'SetSpellTrap' && a.payload.cardInstanceId === cardId,",
    'spellSetOptions takes the other seat actions',
    WEB_ALL,
  ],
  [
    WEB + 'duel/legal-index.ts',
    "a.type === 'ActivateEffect' && mine(a, viewer) && a.payload.cardInstanceId === cardId,",
    "a.type === 'ActivateEffect' && mine(a, viewer),",
    'activations of another card offered',
    WEB_ALL,
  ],
  [
    WEB + 'duel/interaction.ts',
    '.filter((o) => o.zoneIndex === zoneIndex)',
    '',
    'Set offered for a zone other than the drop zone',
    WEB_ALL,
  ],
  [
    WEB + 'duel/interaction.ts',
    "  purpose === 'tribute' || purpose === 'cost';",
    "  purpose === 'tribute' || purpose === 'cost' || purpose === 'target';",
    'target prompt can be cancelled',
    WEB_ALL,
  ],
  [
    WEB + 'duel/interaction.ts',
    "  if (action.type === 'ActivateEffect') return action.payload.costInstanceIds ?? [];\n",
    '',
    'activation cost never asked (first listed cost sent)',
    WEB_ALL,
  ],
  [
    WEB + 'duel/interaction.ts',
    "      : prompt.kind === 'SelectEffectTarget' && answers.length > 0\n        ? 'target'\n        : null;",
    '      : null;',
    'target prompt never opens the selection',
    WEB_ALL,
  ],
  [
    WEB + 'duel/interaction.ts',
    '  if (spellZone !== null) return dropSpell(state.cardId, spellZone, point, ctx);\n',
    '',
    'drop on a Spell/Trap Zone ignored',
    WEB_ALL,
  ],
  [
    WEB + 'duel/presenter.ts',
    "defense: zone === 'monster' && (card.position === 'DefenseUp' || faceDown),",
    "defense: card.position === 'DefenseUp' || faceDown,",
    'Set Spell/Trap drawn sideways',
    WEB_ALL,
  ],
  [
    WEB + 'duel/log-entries.ts',
    "    case 'SpellTrapSet':\n    case 'EffectActivated':",
    "    case 'EffectActivated':",
    'SpellTrapSet has no log group (typecheck)',
    'pnpm --filter @yugi/web typecheck',
  ],
  [
    WEB + 'duel/animation-queue.ts',
    "        kind: 'spellSet',\n        ...d('spellSet'),",
    "        kind: 'set',\n        ...d('set'),",
    'Spell/Trap Set animated as a monster Set',
    WEB_ALL,
  ],
];

const which = process.argv[2];
const mutants =
  which === 'api' ? API_MUTANTS : which === 'web' ? WEB_MUTANTS : [...API_MUTANTS, ...WEB_MUTANTS];

const results = [];
for (const [file, from, to, name, cmd] of mutants) {
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
