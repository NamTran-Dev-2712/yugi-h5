// Manual mutation testing for task 4.4b (Counter Trap / Negate on the wire: the three events, the leak oracle rule,
// NEGATE_DEMO_DECK, the negate animation / log / caption, Counter Traps in the UI, the AI still not using negations).
// Usage: node tools/mutants-4.4b.mjs [filter]   (from the repo root; `filter` = substring of a name)
// Each mutant edits one spot, runs the tests of its layer and expects them to FAIL (= killed). Shared mutants rebuild
// the shared package (api/web import its dist) and also run the api scenario spec.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'apps/api/src/modules/duels/';
const WEB = 'apps/web/src/duel/';
const DEBUG = 'apps/web/src/debug/';
const I18N = 'apps/web/src/i18n/locales/';

const run = (cmd) => execSync(cmd, { stdio: 'pipe' });
const buildShared = () => run('pnpm --filter @yugi/shared build');
const LAYERS = {
  api: () =>
    run(
      'pnpm --filter @yugi/api exec vitest run ' +
        [
          'src/modules/duels/event-view.spec.ts',
          'src/modules/duels/duel-manager.scenario-negate.spec.ts',
          'src/modules/duels/testing',
          'src/modules/duels/event-visibility.fuzz.spec.ts',
          'src/modules/duels/ai/choose-action',
        ].join(' '),
    ),
  // The leak gate ALONE (no shape assertion in it: only the oracle `findLeaks` over what each seat receives).
  oracle: () =>
    run('pnpm --filter @yugi/api exec vitest run src/modules/duels/event-visibility.fuzz.spec.ts'),
  web: () => run('pnpm --filter @yugi/web exec vitest run'),
  shared: () => {
    run('pnpm --filter @yugi/shared exec vitest run');
    buildShared();
    run(
      'pnpm --filter @yugi/api exec vitest run src/modules/duels/duel-manager.scenario-negate.spec.ts',
    );
  },
};

const FORWARD =
  "    case 'ChainLinkNegated':\n    case 'AttackNegated':\n    case 'SummonNegated':\n      return event;";
/** `one` gets its own `return`, the other two keep `return event`. */
const forwardExcept = (one, body) => {
  const rest = ['ChainLinkNegated', 'AttackNegated', 'SummonNegated'].filter((t) => t !== one);
  return (
    `    case '${one}':\n      ${body}\n` +
    rest.map((t) => `    case '${t}':\n`).join('') +
    '      return event;'
  );
};

/** [layer, file, from, to, name] */
const mutants = [
  // ---- API: the three Negate events on the wire ----
  [
    'api',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept('ChainLinkNegated', 'return null;'),
    'ChainLinkNegated dropped (still engine-only)',
  ],
  [
    'api',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept('AttackNegated', 'return null;'),
    'AttackNegated dropped (still engine-only)',
  ],
  [
    'api',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept('SummonNegated', 'return null;'),
    'SummonNegated dropped (still engine-only)',
  ],
  [
    'api',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept('AttackNegated', 'return viewerIndex === event.playerIndex ? event : null;'),
    'AttackNegated forwarded to the attacker only',
  ],
  [
    'api',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept('SummonNegated', 'return viewerIndex === event.playerIndex ? null : event;'),
    'SummonNegated hidden from the player whose Summon was negated',
  ],
  // ---- API: mandatory leak mutants — a Negate event that names a card it must not ----
  [
    'api',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept('AttackNegated', "return { ...event, definitionId: 'SMP-005' } as never;"),
    'AttackNegated forwarded WITH a definitionId (names the face-down target: leak)',
  ],
  [
    'api',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept(
      'AttackNegated',
      "return { ...event, target: { instanceId: event.targetInstanceId, definitionId: 'SMP-005' } } as never;",
    ),
    'AttackNegated forwarded with a nested card naming its target (leak)',
  ],
  [
    'api',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept(
      'ChainLinkNegated',
      "return { ...event, revealed: [...hidden].slice(0, 1).map((instanceId) => ({ instanceId, definitionId: 'SMP-001' })) } as never;",
    ),
    'ChainLinkNegated carries a card of a hand / deck hidden from the viewer (leak)',
  ],
  [
    'api',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept('SummonNegated', "return { ...event, definitionId: 'SMP-999' };"),
    'SummonNegated names another card than the server holds',
  ],
  // The same three leaks against the fuzz gate only: the ORACLE must catch them, not just a shape assertion of a spec.
  [
    'oracle',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept('AttackNegated', "return { ...event, definitionId: 'SMP-005' } as never;"),
    'fuzz oracle alone: AttackNegated with a definitionId',
  ],
  [
    'oracle',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept(
      'AttackNegated',
      "return { ...event, target: { instanceId: event.targetInstanceId, definitionId: 'SMP-005' } } as never;",
    ),
    'fuzz oracle alone: AttackNegated with a nested card naming its target',
  ],
  [
    'oracle',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept(
      'ChainLinkNegated',
      "return { ...event, revealed: [...hidden].slice(0, 1).map((instanceId) => ({ instanceId, definitionId: 'SMP-001' })) } as never;",
    ),
    'fuzz oracle alone: ChainLinkNegated carrying a hidden hand / deck card',
  ],
  [
    'oracle',
    API + 'event-view.ts',
    FORWARD,
    forwardExcept('SummonNegated', "return { ...event, definitionId: 'SMP-999' };"),
    'fuzz oracle alone: SummonNegated naming another card than the server holds',
  ],
  // ---- API: the oracle itself ----
  [
    'api',
    API + 'testing/leak-check.ts',
    "const ID_ONLY_EVENT_TYPES: ReadonlySet<string> = new Set(['AttackNegated']);",
    'const ID_ONLY_EVENT_TYPES: ReadonlySet<string> = new Set([]);',
    'oracle: an AttackNegated with a definitionId not flagged',
  ],
  [
    'api',
    API + 'testing/leak-check.ts',
    "  return 'definitionId' in rec || Object.values(rec).some(namesACard);",
    "  return 'definitionId' in rec;",
    'oracle: a card nested inside an id-only event not flagged',
  ],
  [
    'api',
    API + 'testing/leak-check.ts',
    "    violations.push({ viewer, ...pair, reason: 'an id-only event carries a definitionId' });",
    "    if (viewer === 0) violations.push({ viewer, ...pair, reason: 'an id-only event carries a definitionId' });",
    'oracle: the id-only rule checks one seat only',
  ],
  // ---- API: the AI is still not taught to negate ----
  [
    'api',
    API + 'ai/choose-action.ts',
    "      (op.kind === 'Damage' && op.target === 'opponent'),",
    "      (op.kind === 'Damage' && op.target === 'opponent') ||\n      op.kind.startsWith('Negate'),",
    'AI treats a negation as worth activating in a window',
  ],
  // ---- Shared: the deck ----
  [
    'shared',
    'packages/shared/src/deck/negate-demo-deck.ts',
    "  ...['SMP-201', 'SMP-209', 'SMP-210'].flatMap(x3),",
    "  ...['SMP-201', 'SMP-202', 'SMP-210'].flatMap(x3),",
    'NEGATE_DEMO_DECK without SMP-209',
  ],
  [
    'shared',
    'packages/shared/src/deck/negate-demo-deck.ts',
    "  'SMP-014',\n",
    "  'SMP-014',\n  'SMP-014',\n",
    'NEGATE_DEMO_DECK has 41 cards',
  ],
  // ---- Web: the animation of a negation ----
  [
    'web',
    WEB + 'animation-queue.ts',
    '    const step = stepFor(e, describe(e));\n    if (!step) continue;',
    "    const step = stepFor(e, describe(e));\n    if (!step || step.kind.startsWith('negate')) continue;",
    'the animation skips every negate step',
  ],
  [
    'web',
    WEB + 'animation-queue.ts',
    "        kind: 'negateAttack',\n        ...d('negateAttack'),",
    "        kind: 'attack',\n        ...d('attack'),",
    'a negated attack is replayed as an attack',
  ],
  [
    'web',
    WEB + 'animation-queue.ts',
    "        kind: 'negateSummon',\n        ...d('negateSummon'),\n        playerIndex: e.playerIndex,\n        instanceId: e.instanceId,\n        zoneIndex: e.zoneIndex,",
    "        kind: 'negateSummon',\n        ...d('negateSummon'),\n        playerIndex: e.playerIndex,\n        instanceId: e.instanceId,\n        zoneIndex: 0,",
    'negateSummon step loses its zone',
  ],
  [
    'web',
    WEB + 'animation-queue.ts',
    '        instanceId: e.instanceId,\n        byInstanceId: e.byInstanceId,',
    '        instanceId: e.byInstanceId,\n        byInstanceId: e.instanceId,',
    'negateLink step crosses out the negating card instead of the negated one',
  ],
  [
    'web',
    WEB + 'animation-queue.ts',
    '  negateLink: 500, // [GUESS]',
    '  negateLink: 0, // [GUESS]',
    'negateLink has no duration',
  ],
  [
    'web',
    WEB + 'animation-queue.ts',
    "  return step.kind === 'negateLink' ? 'struck' : 'normal';",
    "  return 'normal';",
    'a negated chain link is never struck through',
  ],
  [
    'web',
    WEB + 'animation-queue.ts',
    "  return step.kind === 'negateLink' ? 'struck' : 'normal';",
    "  return step.kind.startsWith('chain') || step.kind === 'negateLink' ? 'struck' : 'normal';",
    'every chain caption is struck through',
  ],
  [
    'web',
    WEB + 'animation-player.ts',
    "  if (q.get('slow') === '1') return 1 / 3;",
    "  if (q.get('slow') === '1') return 1;",
    '?slow=1 does nothing',
  ],
  // ---- Web: log + sentences ----
  [
    'web',
    WEB + 'log-entries.ts',
    "    case 'AttackNegated':\n      return 'combat';",
    "    case 'AttackNegated':\n      return 'field';",
    'a negated attack is logged in the wrong group',
  ],
  [
    'web',
    WEB + 'log-entries.ts',
    "    case 'ChainLinkNegated':\n    case 'SummonNegated':\n      return 'field';",
    "    case 'ChainLinkNegated':\n    case 'SummonNegated':\n      return 'turn';",
    'negated activation / Summon logged in the wrong group',
  ],
  [
    'web',
    DEBUG + 'describe-event.ts',
    "      return event.targetInstanceId === null\n        ? t('event.attackNegatedDirect', {",
    "      return event.targetInstanceId !== null\n        ? t('event.attackNegatedDirect', {",
    'direct / targeted negated-attack sentences swapped',
  ],
  [
    'web',
    DEBUG + 'describe-event.ts',
    "      return t('event.chainLinkNegated', {",
    "      return t('event.chainLinkFizzled', {",
    'a negated link is described as a fizzled one',
  ],
  [
    'web',
    I18N + 'vi.json',
    '"event.summonNegated": "Triệu hồi {card} của {player} bị vô hiệu: quái vào mộ (ô {zone})",',
    '"event.summonNegated": "Triệu hồi {card} của {player} thất bại (ô {zone})",',
    'the Summon-negated log line no longer says "vô hiệu"',
  ],
  [
    'web',
    I18N + 'en.json',
    '"event.attackNegatedDirect": "{player}\'s direct attack ({attacker}) is negated",',
    '"event.attackNegatedDirect": "{player}\'s direct attack is negated",',
    'en: the direct negated attack drops its {attacker} param',
  ],
  // ---- Web: the caption no longer covers the turn / phase line ----
  [
    'web',
    WEB + 'layout.ts',
    '      y: BAR_Y + (BAR_H - CAPTION_H) / 2,',
    '      y: PHASE_Y - 22,',
    'the animation caption is back over the turn / phase line',
  ],
  // ---- Web: a Counter Trap on my own Main Phase must not offer an activation ----
  [
    'web',
    WEB + 'legal-index.ts',
    '  return setCardIds.filter((id) => activations(legal, viewer, id).length > 0);',
    '  return [...setCardIds];',
    'every Set card of mine is outlined as activatable (Counter Trap on Main Phase too)',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    '  const usable = groups.filter((g) => g.actions.length > 0);',
    '  const usable = groups;',
    'the drop menu shows "Kích hoạt" although no activation is listed',
  ],
  [
    'web',
    WEB + 'fixtures.ts',
    "    legalActions: [activate('p0-30', 'gate-of-refusal'), pass, surrender],",
    "    legalActions: [activate('p0-31', 'sealing-rune'), pass, surrender],",
    'counter-window fixture lists the wrong Set card',
  ],
];

const filter = process.argv[2];
const results = [];
let sharedTouched = false;
for (const [layer, file, from, to, name] of mutants) {
  if (filter && !name.includes(filter)) continue;
  const original = readFileSync(file, 'utf8');
  const normalised = original.replace(/\r\n/g, '\n');
  if (!normalised.includes(from)) {
    results.push(`MISSING  ${name}  (pattern not found in ${file})`);
    console.log(results.at(-1));
    continue;
  }
  writeFileSync(
    file,
    normalised.replace(from, () => to),
  );
  if (layer === 'shared') sharedTouched = true;
  let killed = false;
  try {
    LAYERS[layer]();
  } catch {
    killed = true;
  } finally {
    writeFileSync(file, original);
  }
  results.push(`${killed ? 'KILLED  ' : 'SURVIVED'} ${name}`);
  console.log(results.at(-1));
}
if (sharedTouched) buildShared();
const survived = results.filter((r) => !r.startsWith('KILLED')).length;
console.log(`\n${results.length - survived}/${results.length} mutants killed`);
process.exitCode = survived === 0 ? 0 : 1;
