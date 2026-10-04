// Manual mutation testing for task 4.5b (Fusion on the wire: Extra Deck of the owner on StateView, the two Fusion
// prompts, the two Fusion events, the per-seat leak oracle, the AI seat without an Extra Deck, the Fusion UI).
// Usage: node tools/mutants-4.5b.mjs [filter]   (from the repo root; `filter` = substring of a name)
// Each mutant edits one spot, runs the tests of its layer and expects them to FAIL (= killed). The tests run under
// vitest (esbuild, no type-check), so a mutant is killed by a TEST, never by `tsc`. Shared mutants rebuild the shared
// package (api / web import its dist).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'apps/api/src/modules/duels/';
const SANDBOX = 'apps/api/src/modules/dev-sandbox/';
const WEB = 'apps/web/src/duel/';
const DEBUG = 'apps/web/src/debug/';
const I18N = 'apps/web/src/i18n/locales/';
const SHARED = 'packages/shared/src/';

const run = (cmd) => execSync(cmd, { stdio: 'pipe' });
const buildShared = () => run('pnpm --filter @yugi/shared build');
const WIRE_SPECS = [
  'src/modules/duels/fusion-wire.spec.ts',
  'src/modules/duels/event-view.spec.ts',
  'src/modules/duels/duel-manager.scenario-fusion.spec.ts',
  'src/modules/dev-sandbox/scenario-to-state.spec.ts',
].join(' ');
const LAYERS = {
  // The Fusion wire specs (views, prompts, events, the oracle's own unit tests, DuelManager, the Sandbox scenarios).
  wire: () => run(`pnpm --filter @yugi/api exec vitest run ${WIRE_SPECS}`),
  // The leak gate ALONE: nothing but the fuzz over what each seat receives (oracle + shape-agnostic Extra Deck checks).
  oracle: () =>
    run('pnpm --filter @yugi/api exec vitest run src/modules/duels/event-visibility.fuzz.spec.ts'),
  // The real HTTP layer (controller + DTO), Fusion tests only.
  e2e: () =>
    run('pnpm --filter @yugi/api exec vitest run src/modules/duels/duels.e2e.spec.ts -t "4.5b"'),
  web: () => run('pnpm --filter @yugi/web exec vitest run'),
  shared: () => {
    run('pnpm --filter @yugi/shared exec vitest run');
    buildShared();
    run(`pnpm --filter @yugi/api exec vitest run ${WIRE_SPECS}`);
  },
};

const OWNER_ONLY = '    ...(isOwner ? { extraDeck: p.extraDeck.map(visible) } : {}),';
const TO_EVERYONE = '    extraDeck: p.extraDeck.map(visible),';
const PROMPT_GUARD =
  '  if (prompt.playerIndex !== viewerIndex && !PUBLIC_PROMPT_KINDS.has(prompt.kind)) {';
const PROMPT_GUARD_OPEN =
  "  if (prompt.playerIndex !== viewerIndex && !PUBLIC_PROMPT_KINDS.has(prompt.kind) && !prompt.kind.startsWith('SelectFusion')) {";

/** [layer, file, from, to, name] */
const mutants = [
  // ================= API — mandatory security mutants =================
  [
    'wire',
    API + 'state-view.ts',
    OWNER_ONLY,
    TO_EVERYONE,
    'SECURITY: the Extra Deck list is sent to the opponent too (StateView leak)',
  ],
  [
    'oracle',
    API + 'state-view.ts',
    OWNER_ONLY,
    TO_EVERYONE,
    'SECURITY (fuzz gate alone): the Extra Deck list is sent to the opponent too',
  ],
  [
    'wire',
    API + 'state-view.ts',
    PROMPT_GUARD,
    PROMPT_GUARD_OPEN,
    'SECURITY: the Fusion prompt payload is sent to the player who is not asked',
  ],
  [
    'oracle',
    API + 'state-view.ts',
    PROMPT_GUARD,
    PROMPT_GUARD_OPEN,
    'SECURITY (fuzz gate alone): the Fusion prompt payload is sent to the player who is not asked',
  ],
  [
    'wire',
    API + 'state-view.ts',
    "const PUBLIC_PROMPT_KINDS: ReadonlySet<string> = new Set(['DiscardToHandLimit']);",
    "const PUBLIC_PROMPT_KINDS: ReadonlySet<string> = new Set(['DiscardToHandLimit', 'SelectFusionMonster']);",
    'SECURITY: SelectFusionMonster classified as a public prompt kind',
  ],
  [
    'wire',
    API + 'testing/leak-check.ts',
    '      return card.ownerIndex === viewer ? null : "card is in the opponent\'s Extra Deck";',
    '      return null;',
    'SECURITY: the oracle is no longer per seat — an Extra Deck card may be named to anyone',
  ],
  [
    'wire',
    API + 'testing/leak-check.ts',
    "  return (place.zone === 'hand' || place.zone === 'extraDeck') && place.card.ownerIndex !== viewer;",
    "  return place.zone === 'hand' && place.card.ownerIndex !== viewer;",
    'SECURITY: the oracle is no longer per seat — anyone may be pointed at any Extra Deck card',
  ],
  [
    'wire',
    API + 'testing/leak-check.ts',
    "  if (place.zone === 'deck') return true;",
    "  if (place.zone === 'deck') return place.card.ownerIndex !== viewer;",
    'SECURITY: the oracle is relaxed further than decided — the own Main Deck may be pointed at',
  ],
  [
    'wire',
    API + 'testing/leak-check.ts',
    "    case 'deck':\n      return 'card is in a deck';",
    "    case 'deck':\n      return card.ownerIndex === viewer ? null : 'card is in a deck';",
    'SECURITY: the oracle is relaxed further than decided — the own Main Deck may be named',
  ],
  [
    'wire',
    API + 'event-view.ts',
    "    case 'FusionMaterialSent':\n      return {\n        type: 'FusionMaterialSent',",
    "    case 'FusionMaterialSent':\n      return {\n        ...event,\n        type: 'FusionMaterialSent',",
    'SECURITY: FusionMaterialSent forwarded with whatever the engine event carries (internal field on the wire)',
  ],
  [
    'wire',
    API + 'event-view.ts',
    "    case 'MonsterFusionSummoned':\n      return {\n        type: 'MonsterFusionSummoned',",
    "    case 'MonsterFusionSummoned':\n      return {\n        ...event,\n        type: 'MonsterFusionSummoned',",
    'SECURITY: MonsterFusionSummoned forwarded with whatever the engine event carries (internal field on the wire)',
  ],
  [
    'wire',
    API + 'state-view.ts',
    "  if (prompt.kind !== 'SelectFusionMonster' && prompt.kind !== 'SelectFusionMaterials') return null;",
    '  if (prompt.kind.length > 0) return null;',
    'SECURITY: the Fusion prompt payload is sent raw (linkId / owedTriggers / linkCount on the wire)',
  ],
  [
    'wire',
    API + 'duel-manager.ts',
    "  const ai = config.mode === 'solo-vs-ai' ? config.aiSeat : undefined;",
    '  const ai = undefined;',
    'SECURITY: the AI seat keeps the Extra Deck it was sent (solo-vs-ai)',
  ],
  // ================= API — the rest of the wire =================
  [
    'wire',
    API + 'visibility.ts',
    '  for (const c of opponent.extraDeck) ids.add(c.instanceId);\n',
    '',
    "hiddenIdsFor forgets the opponent's Extra Deck",
  ],
  [
    'wire',
    API + 'visibility.ts',
    '  for (const c of opponent.extraDeck) ids.add(c.instanceId);\n',
    '  for (const p of state.players) for (const c of p.extraDeck) ids.add(c.instanceId);\n',
    "hiddenIdsFor hides the viewer's own Extra Deck again (the old rule)",
  ],
  [
    'wire',
    API + 'event-view.ts',
    "    case 'MonsterFusionSummoned':\n      return {",
    "    case 'MonsterFusionSummoned':\n      if (viewerIndex !== event.playerIndex) return null;\n      return {",
    'MonsterFusionSummoned hidden from the opponent',
  ],
  [
    'wire',
    API + 'event-view.ts',
    "    case 'FusionMaterialSent':\n      return {",
    "    case 'FusionMaterialSent':\n      if (viewerIndex >= 0) return null;\n      return {",
    'FusionMaterialSent dropped (still engine-only)',
  ],
  [
    'wire',
    API + 'event-view.ts',
    '        ...(event.zoneIndex !== undefined ? { zoneIndex: event.zoneIndex } : {}),\n',
    '',
    'FusionMaterialSent loses the zone a field material left',
  ],
  [
    'wire',
    API + 'duel-manager.ts',
    '        ...(extraDeckLists ? { extraDeckLists } : {}),\n',
    '',
    'createDuel does not pass the Extra Decks to StartDuel',
  ],
  [
    'wire',
    API + 'duel-manager.ts',
    '    for (const id of [...deckLists.flat(), ...(extra ?? []).flat()]) {',
    '    for (const id of deckLists.flat()) {',
    'createDuel does not check the card ids of an Extra Deck',
  ],
  [
    'wire',
    API + 'state-view.ts',
    "    fusionInstanceId: typeof raw['fusionInstanceId'] === 'string' ? raw['fusionInstanceId'] : '',\n",
    '',
    'the materials prompt does not say which Fusion Monster was chosen',
  ],
  [
    'wire',
    SANDBOX + 'scenario-to-state.ts',
    'return { instanceId: `p${seat}-x${i}`, definitionId, position: null, ownerIndex: seat };',
    'return { instanceId: `p${seat}-e${i}`, definitionId, position: null, ownerIndex: seat };',
    'scenarioToState numbers the Extra Deck differently from StartDuel',
  ],
  [
    'wire',
    SANDBOX + 'scenario-to-state.ts',
    "      } else if (def.kind !== 'Monster' || def.category !== 'Fusion') {",
    '      } else if (def.id.length === 0) {',
    'scenarioToState accepts any card in the Extra Deck',
  ],
  [
    'e2e',
    API + 'duels.controller.ts',
    '      const check = validateDeck(deck, lookupCard, extraDecks[seat]);',
    '      const check = validateDeck(deck, lookupCard);',
    'POST /duels/solo does not validate the Extra Deck',
  ],
  [
    'e2e',
    API + 'duels.controller.ts',
    '      extraDeckLists: [extraDecks[0] ?? [], extraDecks[1] ?? []],',
    '      extraDeckLists: [[], []],',
    'POST /duels/solo drops the Extra Deck it validated',
  ],
  // ================= Web =================
  [
    'web',
    WEB + 'fusion-prompt.ts',
    '  if (cardInstanceIds.length !== prompt.count) return false;\n',
    '',
    'isFusionAnswer accepts any number of cards',
  ],
  [
    'web',
    WEB + 'fusion-prompt.ts',
    '  return cardInstanceIds.every((id) => prompt.candidates.includes(id));',
    '  return true;',
    'isFusionAnswer accepts cards that are not candidates of the prompt',
  ],
  [
    'web',
    WEB + 'fusion-prompt.ts',
    '  if (playerIndex !== view.viewerIndex || promptId !== prompt.promptId) return false;',
    '  if (playerIndex !== view.viewerIndex) return false;',
    'isFusionAnswer accepts an answer to another prompt id',
  ],
  [
    'web',
    WEB + 'fusion-prompt.ts',
    '  if (Object.keys(rest).length > 0) return false;\n',
    '',
    'isFusionAnswer accepts an answer with extra keys (decline…)',
  ],
  [
    'web',
    WEB + 'fusion-prompt.ts',
    '  if (!prompt || prompt.playerIndex !== view.viewerIndex || view.winnerIndex !== null) return null;',
    '  if (!prompt || view.winnerIndex !== null) return null;',
    'fusionPromptOf reads a prompt addressed to the other seat',
  ],
  [
    'web',
    WEB + 'fusion-prompt.ts',
    "  if (own.hand.some((c) => c.instanceId === instanceId)) return 'hand';",
    "  if (own.hand.some((c) => c.instanceId === instanceId)) return 'field';",
    'a material in my hand is labelled "Trên sân"',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    '  if (state.count !== undefined) return state.selected.length === state.count;',
    '  if (state.count !== undefined) return state.selected.length >= 1;',
    '"Đồng ý" lights up before enough materials are chosen',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    '  if (!isListed(ctx.legalActions, action) && !isFusionAnswer(ctx.view, action)) {',
    '  if (!isListed(ctx.legalActions, action)) {',
    'the Fusion answer must be listed in legalActions again (breaks past 200 combinations)',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    '      : state.count === 1\n        ? [id] // one card to choose: a tap on another one replaces the choice\n',
    '      : state.count === 99\n        ? [id] // one card to choose: a tap on another one replaces the choice\n',
    'choosing another Fusion Monster adds to the choice instead of replacing it',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    '    const source = all ? fusionSourceOf(ctx.view, id) : null;',
    '    const source = null;',
    'the picker has no source label under the materials',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    '  const hit = fusion ? null : hitTest(ctx.layout, ctx.model, point);',
    '  const hit = hitTest(ctx.layout, ctx.model, point);',
    'a tap on the board under the Fusion picker chooses a card too',
  ],
  [
    'web',
    WEB + 'duel-controller.ts',
    '      if (!isListed(state.legalActions, action) && !isFusionAnswer(state.view, action)) {',
    '      if (state.view === null) {',
    'controller.submit sends anything, listed or not',
  ],
  [
    'web',
    WEB + 'duel-controller.ts',
    '      if (!isListed(state.legalActions, action) && !isFusionAnswer(state.view, action)) {',
    '      if (!isListed(state.legalActions, action)) {',
    'controller.submit refuses the Fusion answer that is not listed',
  ],
  [
    'web',
    WEB + 'presenter.ts',
    '  const own = view.players[view.viewerIndex];\n  const mine: readonly CardView[] = [',
    '  const own = view.players[view.viewerIndex === 0 ? 1 : 0];\n  const mine: readonly CardView[] = [',
    "the Fusion picker is drawn from the opponent's zones",
  ],
  [
    'web',
    WEB + 'presenter.ts',
    '    const shown = inGraveyard ? card : { ...card, position: null };',
    '    const shown = card;',
    'a face-down material of mine is drawn face-down in the picker',
  ],
  [
    'web',
    WEB + 'layout.ts',
    '  const lift = labelled ? PICKER_LABEL_H : 0;',
    '  const lift = 0;',
    'the labels of a Fusion picker run over the turn / phase line',
  ],
  [
    'web',
    WEB + 'animation-queue.ts',
    '  fusionSummon: 900, // [GUESS] split of the measured total',
    '  fusionSummon: 2600, // [GUESS] split of the measured total',
    'a Fusion Summon lasts as long as a Normal Summon (not the measured 1.25–1.5 s)',
  ],
  [
    'web',
    WEB + 'animation-queue.ts',
    "        zoneIndex: e.from === 'MonsterZone' && e.zoneIndex !== undefined ? e.zoneIndex : null,",
    '        zoneIndex: e.zoneIndex ?? 0,',
    'a material from the hand is animated on Monster Zone 0',
  ],
  [
    'web',
    WEB + 'log-entries.ts',
    "    case 'FusionMaterialSent':\n    case 'MonsterFusionSummoned':\n      return 'field';",
    "    case 'FusionMaterialSent':\n    case 'MonsterFusionSummoned':\n      return 'combat';",
    'the Fusion events are logged in the "Đánh" group',
  ],
  [
    'web',
    DEBUG + 'describe-event.ts',
    "        : t(event.from === 'Hand' ? 'event.fusionMaterialHand' : 'event.fusionMaterialDeck', {",
    "        : t(event.from === 'Hand' ? 'event.fusionMaterialDeck' : 'event.fusionMaterialHand', {",
    'a material from the hand is described as coming from the Deck',
  ],
  [
    'web',
    DEBUG + 'describe-ai-action.ts',
    "        case 'SelectFusionMonster':\n          return t('ai.chooseFusionMonster');",
    "        case 'SelectFusionMonster':\n          return t('ai.answerPrompt', { cards });",
    "the AI's Fusion Monster choice names the ids it was sent",
  ],
  [
    'web',
    I18N + 'vi.json',
    '"duel.fusionAgree": "Đồng ý",',
    '"duel.fusionAgree": "Xác nhận",',
    'vi: the materials button is not the original "Đồng ý"',
  ],
  [
    'web',
    I18N + 'en.json',
    '"event.fusionSummoned": "{player} Fusion Summons {card} to zone {zone}",',
    '"event.fusionSummoned": "{player} Fusion Summons {card}",',
    'en: the Fusion Summon line drops its {zone} param',
  ],
  // ================= Shared =================
  [
    'shared',
    SHARED + 'deck/fusion-demo-deck.ts',
    "  ...x3('SMP-116'),",
    "  'SMP-116',",
    'FUSION_DEMO_DECK has one fusion Spell (38 cards)',
  ],
  [
    'shared',
    SHARED + 'deck/fusion-demo-deck.ts',
    "  'SMP-045',\n  'SMP-045',\n  'SMP-046',",
    "  'SMP-045',\n  'SMP-001',\n  'SMP-046',",
    'FUSION_DEMO_EXTRA_DECK holds a card that is not a Fusion Monster',
  ],
  [
    'shared',
    SHARED + 'cards/sample-cards.ts',
    "    fusionMaterials: ['SMP-006', 'SMP-009'],",
    "    fusionMaterials: ['SMP-006', 'SMP-008'],",
    'SMP-047 names another material',
  ],
  [
    'shared',
    SHARED + 'cards/sample-cards.ts',
    "        operations: [{ kind: 'FusionSummon', sources: ['Hand', 'Field'] }],",
    "        operations: [{ kind: 'FusionSummon', sources: ['Hand', 'Field', 'Deck'] }],",
    'SMP-116 takes materials from the Deck (a source that is not on the wire)',
  ],
  [
    'shared',
    SHARED + 'scenario/scenario-schema.ts',
    '    extraDeck: z.array(CardId).max(20).optional(),',
    '    extraDeck: z.array(CardId).max(60).optional(),',
    'ScenarioSchema accepts an Extra Deck of more than 20 cards',
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
  results.push(`${killed ? 'KILLED  ' : 'SURVIVED'} [${layer}] ${name}`);
  console.log(results.at(-1));
}
if (sharedTouched) buildShared();
const survived = results.filter((r) => !r.startsWith('KILLED')).length;
console.log(`\n${results.length - survived}/${results.length} mutants killed`);
process.exitCode = survived === 0 ? 0 : 1;
