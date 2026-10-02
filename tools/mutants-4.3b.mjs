// Manual mutation testing for task 4.3b (Field Zone on the wire, leak gate, FIELD_DEMO_DECK, Field Zone UI, the three
// small debts of 4.2d). Usage: node tools/mutants-4.3b.mjs [filter]   (from the repo root; `filter` = substring of a name)
// Each mutant edits one spot, runs the tests of its layer and expects them to FAIL (= killed). Shared mutants rebuild
// the shared package (api/web import its dist) and also run the api scenario spec.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'apps/api/src/modules/duels/';
const WEB = 'apps/web/src/duel/';
const DEBUG = 'apps/web/src/debug/';

const run = (cmd) => execSync(cmd, { stdio: 'pipe' });
const buildShared = () => run('pnpm --filter @yugi/shared build');
const LAYERS = {
  api: () =>
    run(
      'pnpm --filter @yugi/api exec vitest run ' +
        [
          'src/modules/duels/event-view.spec.ts',
          'src/modules/duels/state-view.spec.ts',
          'src/modules/duels/duel-manager.scenario-field.spec.ts',
          'src/modules/duels/duel-manager.ai-redact.spec.ts',
          'src/modules/duels/testing',
          'src/modules/duels/event-visibility.fuzz.spec.ts',
          'src/modules/duels/ai/choose-action',
        ].join(' '),
    ),
  web: () => run('pnpm --filter @yugi/web exec vitest run'),
  shared: () => {
    run('pnpm --filter @yugi/shared exec vitest run');
    buildShared();
    run(
      'pnpm --filter @yugi/api exec vitest run src/modules/duels/duel-manager.scenario-field.spec.ts',
    );
  },
};

/** [layer, file, from, to, name] */
const mutants = [
  // ---- API: the Field Zone events on the wire ----
  [
    'api',
    API + 'event-view.ts',
    "    case 'FieldSpellSet':\n    case 'FieldSpellDestroyed':\n    case 'CardSentToGraveyard':\n      return event;",
    "    case 'FieldSpellSet':\n      return { ...event, definitionId: 'SMP-113' };\n    case 'FieldSpellDestroyed':\n    case 'CardSentToGraveyard':\n      return event;",
    'FieldSpellSet forwarded WITH a definitionId (leak)',
  ],
  [
    'api',
    API + 'event-view.ts',
    "    case 'FieldSpellSet':\n    case 'FieldSpellDestroyed':\n    case 'CardSentToGraveyard':\n      return event;",
    "    case 'FieldSpellSet':\n      return null;\n    case 'FieldSpellDestroyed':\n    case 'CardSentToGraveyard':\n      return event;",
    'FieldSpellSet dropped (still engine-only)',
  ],
  [
    'api',
    API + 'event-view.ts',
    "    case 'FieldSpellSet':\n    case 'FieldSpellDestroyed':\n    case 'CardSentToGraveyard':\n      return event;",
    "    case 'FieldSpellDestroyed':\n      return null;\n    case 'FieldSpellSet':\n    case 'CardSentToGraveyard':\n      return event;",
    'FieldSpellDestroyed dropped',
  ],
  [
    'api',
    API + 'event-view.ts',
    "    case 'FieldSpellSet':\n    case 'FieldSpellDestroyed':\n    case 'CardSentToGraveyard':\n      return event;",
    "    case 'FieldSpellSet':\n    case 'FieldSpellDestroyed':\n      return event;\n    case 'CardSentToGraveyard':\n      return event.from === 'FieldZone' ? null : event;",
    'CardSentToGraveyard from the FieldZone dropped',
  ],
  // ---- API: StateView ----
  [
    'api',
    API + 'state-view.ts',
    '    fieldZone: backrowView(state, p.board.fieldZone, isOwner),',
    '    fieldZone: backrowView(state, p.board.fieldZone, true),',
    'backrowView shows a face-down Field Spell to the opponent',
  ],
  [
    'api',
    API + 'state-view.ts',
    '    fieldZone: backrowView(state, p.board.fieldZone, isOwner),',
    '    fieldZone: null,',
    'fieldZone never sent',
  ],
  // ---- API: the oracle itself ----
  [
    'api',
    API + 'testing/leak-check.ts',
    "  'SpellTrapSet',\n  'FieldSpellSet',\n]);",
    "  'SpellTrapSet',\n]);",
    'oracle: a FieldSpellSet with a definitionId not flagged',
  ],
  [
    'api',
    API + 'testing/leak-check.ts',
    '    for (const card of [...p.board.monsterZones, ...p.board.spellTrapZones, p.board.fieldZone]) {',
    '    for (const card of [...p.board.monsterZones, ...p.board.spellTrapZones]) {',
    'oracle: does not look in the Field Zone',
  ],
  // ---- API: promptKind of an AI answer ----
  [
    'api',
    API + 'duel-manager.ts',
    "        action.type === 'ResolvePendingPrompt' ? session.state.pendingPrompt?.kind : undefined;",
    '        undefined;',
    'aiActions never carry promptKind',
  ],
  [
    'api',
    API + 'duel-manager.ts',
    "        action.type === 'ResolvePendingPrompt' ? session.state.pendingPrompt?.kind : undefined;",
    "        action.type === 'ResolvePendingPrompt' ? 'DiscardToHandLimit' : undefined;",
    'promptKind hard-coded to the discard prompt',
  ],
  // ---- Shared: the demo deck and the scenarios ----
  [
    'shared',
    'packages/shared/src/deck/field-demo-deck.ts',
    "  ...['SMP-113', 'SMP-114', 'SMP-115', 'SMP-208'].flatMap(x3),",
    "  ...['SMP-113', 'SMP-114', 'SMP-115'].flatMap(x3),\n  ...['SMP-012'].flatMap(x3),",
    'FIELD_DEMO_DECK without the Continuous Trap',
  ],
  [
    'shared',
    'packages/shared/src/deck/field-demo-deck.ts',
    "  'SMP-105',\n  'SMP-105',",
    "  'SMP-007',\n  'SMP-007',",
    'FIELD_DEMO_DECK cannot destroy a Field Spell',
  ],
  [
    'shared',
    'packages/shared/src/deck/field-demo-deck.ts',
    "  'SMP-036',\n  'SMP-036',\n",
    "  'SMP-036',\n",
    'FIELD_DEMO_DECK has 39 cards',
  ],
  [
    'shared',
    'packages/shared/scenarios/field-set-real.json',
    '"payload": { "playerIndex": 0, "cardInstanceId": "p0-0", "zoneIndex": 0 }',
    '"payload": { "playerIndex": 0, "cardInstanceId": "p0-0", "zoneIndex": 1 }',
    'field-set-real Sets the Field Spell with zoneIndex 1',
  ],
  [
    'shared',
    'packages/shared/scenarios/continuous-real-2.json',
    '"spellTraps": [{ "card": "SMP-208", "zone": 2, "position": "DefenseDown" }]',
    '"spellTraps": []',
    'continuous-real-2 without the Set Continuous Trap',
  ],
  // ---- Web: Field Zone interaction ----
  [
    'web',
    WEB + 'interaction.ts',
    "  if (isFieldCard(state.cardId, ctx)) {\n    return fieldZoneAt(ctx.layout, 'self', point)\n      ? dropFieldSpell(state.cardId, point, ctx)\n      : toIdle(toast(strings.toastNoZone));\n  }\n",
    '',
    'a Field Spell is dropped like any Spell (Spell/Trap Zone 0)',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    "    return fieldZoneAt(ctx.layout, 'self', point)\n      ? dropFieldSpell",
    "    return fieldZoneAt(ctx.layout, 'opp', point)\n      ? dropFieldSpell",
    'a Field Spell is dropped on the OPPONENT Field Zone',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    "  if (fieldZoneAt(ctx.layout, 'self', point)) return toIdle(toast(strings.toastNoZone));\n",
    "  if (fieldZoneAt(ctx.layout, 'self', point)) return dropFieldSpell(state.cardId, point, ctx);\n",
    'any Spell may be dropped on the Field Zone',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    "    (card.zone === 'spellTrap' || card.zone === 'field') &&\n    activations(",
    "    card.zone === 'spellTrap' &&\n    activations(",
    'tapping my Set Field Spell does nothing',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    '        ? canActivate || sets.length > 0\n          ? [ctx.layout.self.fieldZone]\n          : []',
    '        ? canActivate || sets.length > 0\n          ? [...ctx.layout.self.spellTrapZones]\n          : []',
    'dragging a Field Spell highlights the Spell/Trap Zones',
  ],
  [
    'web',
    WEB + 'layout.ts',
    '  return pointInRect(layout[side].fieldZone, p);',
    '  return pointInRect(layout[side].deck, p);',
    'fieldZoneAt tests the deck rect',
  ],
  // ---- Web: presenter ----
  [
    'web',
    WEB + 'presenter.ts',
    '              ...(field ? [field.instanceId] : []),\n',
    '',
    'my Set Field Spell is never outlined as activatable',
  ],
  [
    'web',
    WEB + 'presenter.ts',
    '  const active =\n    !faceDown &&\n    card.position !== null &&',
    '  const active =\n    card.position !== null &&',
    'the "in force" mark on a face-down card',
  ],
  [
    'web',
    WEB + 'presenter.ts',
    "    (zone === 'spellTrap' || zone === 'field') &&\n    def !== undefined &&\n    staysOnField(def);",
    "    (zone === 'spellTrap' || zone === 'field') &&\n    def !== undefined &&\n    staysOnField(def) &&\n    card.instanceId === '';",
    'the "in force" mark never shown',
  ],
  [
    'web',
    WEB + 'presenter.ts',
    '    def !== undefined &&\n    staysOnField(def);',
    '    def !== undefined;',
    'the "in force" mark on every face-up Spell/Trap (Equip, a waiting Trap)',
  ],
  [
    'web',
    WEB + 'presenter.ts',
    "    fieldCard: def?.kind === 'Spell' && def.subType === 'Field',",
    "    fieldCard: def?.kind === 'Spell',",
    'every Spell is a Field card',
  ],
  [
    'web',
    WEB + 'presenter.ts',
    '  if (view.chain.length === 0) {\n    if (w.reactionTo?.kind',
    '  if (view.chain.length >= 0) {\n    if (w.reactionTo?.kind',
    'chain banner still says "the opponent attacks" once a link is on the chain',
  ],
  // ---- Web: animation, log, wording ----
  [
    'web',
    WEB + 'animation-queue.ts',
    "      const kind = e.from === 'FieldZone' ? 'fieldReplace' : 'toGraveyard';",
    "      const kind = 'toGraveyard';",
    'a replaced Field Spell animates as a plain graveyard move',
  ],
  [
    'web',
    WEB + 'animation-queue.ts',
    "        kind: 'fieldSet',\n        ...d('fieldSet'),",
    "        kind: 'fieldDestroy',\n        ...d('fieldDestroy'),",
    'FieldSpellSet animates as a destruction',
  ],
  [
    'web',
    WEB + 'animation-queue.ts',
    '      text: describeAi(ai.action, ai.promptKind),',
    '      text: describeAi(ai.action),',
    'the AI label of an animation ignores promptKind',
  ],
  [
    'web',
    WEB + 'log-entries.ts',
    "    case 'FieldSpellSet':\n    case 'FieldSpellDestroyed':\n      return 'field';",
    "    case 'FieldSpellSet':\n    case 'FieldSpellDestroyed':\n      return 'combat';",
    'Field Zone events logged as combat',
  ],
  [
    'web',
    WEB + 'log-entries.ts',
    '      text: describeAi(step.action, view, step.promptKind),',
    '      text: describeAi(step.action, view),',
    'the log header of an AI action ignores promptKind',
  ],
  [
    'web',
    DEBUG + 'debug-state.ts',
    '    lines.push(describeAi(step.action, view, step.promptKind));',
    '    lines.push(describeAi(step.action, view));',
    'the debug log line of an AI action ignores promptKind',
  ],
  [
    'web',
    DEBUG + 'describe-event.ts',
    "        event.from === 'FieldZone' ? 'event.fieldSpellReplaced' : 'event.cardSentToGraveyard',",
    "        'event.cardSentToGraveyard',",
    'a replaced Field Spell is worded as a used card',
  ],
  [
    'web',
    DEBUG + 'describe-ai-action.ts',
    "        case 'SelectEffectTarget':\n          return ids.length === 0 ? t('ai.chooseTargetHidden') : t('ai.chooseTarget', { cards });",
    "        case 'SelectEffectTarget':\n          return t('ai.discard', { cards });",
    'an AI target answer is worded "bỏ … xuống mộ" (the 4.2d bug)',
  ],
  [
    'web',
    DEBUG + 'describe-ai-action.ts',
    "          return ids.length === 0 ? t('ai.answerPromptNone') : t('ai.answerPrompt', { cards });",
    "          return ids.length === 0 ? t('ai.acceptTrigger') : t('ai.discard', { cards });",
    'an unknown prompt kind is guessed from the ids',
  ],
  // ---- Web: layout of the selection bar / picker ----
  [
    'web',
    WEB + 'layout.ts',
    'const BAR_Y = PHASE_Y + PHASE_LINE_H;',
    'const BAR_Y = PHASE_Y;',
    'the selection bar covers the turn / phase line again',
  ],
  [
    'web',
    WEB + 'layout.ts',
    'const PICKER_BOTTOM = PHASE_Y - 10;',
    'const PICKER_BOTTOM = PHASE_Y + 20;',
    'the graveyard picker overlaps the phase panel',
  ],
  [
    'web',
    WEB + 'detail-text.ts',
    "  if (detail.active) lines.push(t('detail.active'));\n  else if",
    '  if',
    'the detail panel never says "in force"',
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
