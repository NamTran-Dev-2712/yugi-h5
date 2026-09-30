// Manual mutation testing for task 4.2d (FlipSummon / Special Summon / Equip on the wire + leak gate).
// Usage: node tools/mutants-4.2d.mjs [filter]   (from the repo root; `filter` = substring of a mutant name)
// Each mutant edits one spot, runs the tests of its layer and expects them to FAIL (= killed). Shared mutants rebuild
// the shared package (engine/api/web import its dist) and also run the per-card engine tests and the api scenario spec.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'apps/api/src/modules/duels/';
const WEB = 'apps/web/src/duel/';
const CARDS = 'packages/shared/src/cards/sample-cards.ts';

const run = (cmd) => execSync(cmd, { stdio: 'pipe' });
const buildShared = () => run('pnpm --filter @yugi/shared build');
const LAYERS = {
  api: () =>
    run(
      'pnpm --filter @yugi/api exec vitest run ' +
        [
          'src/modules/duels/visibility.spec.ts',
          'src/modules/duels/event-view.spec.ts',
          'src/modules/duels/state-view.mech.spec.ts',
          'src/modules/duels/duel-manager.scenario-mech.spec.ts',
          'src/modules/duels/duel-manager.ai-redact.spec.ts',
          'src/modules/duels/duel-manager.spec.ts',
          'src/modules/duels/testing',
          'src/modules/duels/event-visibility.fuzz.spec.ts',
          'src/modules/duels/ai/choose-action',
        ].join(' '),
    ),
  web: () => run('pnpm --filter @yugi/web exec vitest run'),
  shared: () => {
    run('pnpm --filter @yugi/shared exec vitest run');
    buildShared();
    run('pnpm --filter @yugi/game-engine exec vitest run src/cards/sample');
    run(
      'pnpm --filter @yugi/api exec vitest run src/modules/duels/duel-manager.scenario-mech.spec.ts',
    );
  },
};

/** [layer, file, from, to, name] */
const mutants = [
  // ---- API: target filter, equippedTo, AI redaction, containment ----
  [
    'api',
    API + 'event-view.ts',
    'const targetInstanceIds = visibleIds(event.targetInstanceIds, hidden);',
    'const targetInstanceIds = event.targetInstanceIds;',
    'ChainLinkAdded forwards hand targets unfiltered',
  ],
  [
    'api',
    API + 'state-view.ts',
    'targetInstanceIds: visibleIds(link.targetInstanceIds, hidden),',
    'targetInstanceIds: link.targetInstanceIds,',
    'StateView.chain keeps hand targets',
  ],
  [
    'api',
    API + 'duel-manager.ts',
    'action: redactAction(step.action, hidden[human]),',
    'action: step.action,',
    'aiActions not redacted',
  ],
  [
    'api',
    API + 'visibility.ts',
    '  for (const c of state.players[viewer === 0 ? 1 : 0].hand) ids.add(c.instanceId);\n',
    '',
    "hiddenIdsFor forgets the opponent's hand",
  ],
  [
    'api',
    API + 'visibility.ts',
    'state.players[viewer === 0 ? 1 : 0].hand',
    'state.players[viewer].hand',
    "hiddenIdsFor hides the viewer's own hand instead",
  ],
  [
    'api',
    API + 'state-view.ts',
    "if (m) return m.position === 'Attack' || m.position === 'DefenseUp' ? id : null;",
    'if (m) return id;',
    'equippedTo pointing at a face-down monster',
  ],
  [
    'api',
    API + 'state-view.ts',
    '  if (!faceUp) return isOwner ? visible(c) : hiddenCard(c);',
    '  if (!faceUp) return isOwner ? { ...visible(c), ...(c.equippedTo ? { equippedTo: c.equippedTo } : {}) } : hiddenCard(c);',
    'equippedTo on a face-down card (owner view)',
  ],
  [
    'api',
    API + 'state-view.ts',
    '  const equippedTo = equipTarget(state, c);\n  return equippedTo === null ? visible(c) : { ...visible(c), equippedTo };',
    '  return visible(c);',
    'equippedTo never sent',
  ],
  [
    'api',
    API + 'event-view.ts',
    "    case 'FlipSummoned':\n    case 'CardEquipped':\n      return event;",
    "    case 'FlipSummoned':\n      return event;\n    case 'CardEquipped':\n      return null;",
    'CardEquipped dropped',
  ],
  [
    'api',
    API + 'wire-actions.ts',
    "new Set<Action['type']>([])",
    "new Set<Action['type']>(['FlipSummon'])",
    'FlipSummon back to engine-only',
  ],
  [
    'api',
    API + 'testing/leak-check.ts',
    "  return place.zone === 'hand' && place.card.ownerIndex !== viewer;",
    '  return false;',
    'oracle: pointer to the opponent hand not flagged',
  ],
  [
    'api',
    API + 'testing/leak-check.ts',
    "    if (m) return m.position === 'DefenseDown' ? 'equippedTo names a face-down monster' : null;",
    '    if (m) return null;',
    'oracle: equippedTo to a face-down monster not flagged',
  ],
  // ---- AI ----
  [
    'api',
    API + 'ai/choose-action.ts',
    'const sign = promptHelpsTargets() ? 1 : -1;',
    'const sign = -1;',
    'AI counts its own Special Summon / Equip targets against',
  ],
  [
    'api',
    API + 'ai/choose-action.ts',
    '  noteAll(own.graveyard); // task 4.2d: a Special Summon may bring one back\n',
    '',
    'AI ignores graveyard stats',
  ],
  [
    'api',
    API + 'ai/choose-action.ts',
    'o.amount > 0',
    'o.amount < 0',
    'AI: a raising Equip is not helpful',
  ],
  [
    'api',
    API + 'ai/choose-action.ts',
    "return view.phase === 'Main1' && s && s.atk > threat",
    "return view.phase === 'Main2' && s && s.atk > threat",
    'AI never Flip Summons in Main 1',
  ],
  // ---- Shared: wire schema + card data + deck ----
  [
    'shared',
    'packages/shared/src/duel/action-schema.ts',
    '  FlipSummon,\n  DeclareAttack,',
    '  DeclareAttack,',
    'FlipSummon not in PlayerActionSchema',
  ],
  [
    'shared',
    CARDS,
    "        id: 'flip-ambush',\n        trigger: { kind: 'OnFlip' },",
    "        id: 'flip-ambush',\n        trigger: { kind: 'OnSummon' },",
    'SMP-044 triggers on Summon',
  ],
  [
    'shared',
    CARDS,
    "        trigger: { kind: 'OnFlip' },\n        target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },",
    "        trigger: { kind: 'OnFlip' },\n        target: { kind: 'Card', zone: 'MonsterZone', side: 'self', count: 1 },",
    'SMP-044 targets its own side',
  ],
  [
    'shared',
    CARDS,
    "        id: 'call-from-hand',\n        trigger: { kind: 'Ignition' },\n        target: { kind: 'Card', zone: 'Hand',",
    "        id: 'call-from-hand',\n        trigger: { kind: 'Ignition' },\n        target: { kind: 'Card', zone: 'Graveyard',",
    'SMP-111 hand effect looks in the graveyard',
  ],
  [
    'shared',
    CARDS,
    "target: { kind: 'Card', zone: 'Hand', side: 'self', count: 1, filter: { kind: 'Monster' } },",
    "target: { kind: 'Card', zone: 'Hand', side: 'self', count: 2, filter: { kind: 'Monster' } },",
    'SMP-111 hand effect wants 2 monsters',
  ],
  [
    'shared',
    CARDS,
    "operations: [{ kind: 'ModifyStat', stat: 'atk', amount: 500, equipped: true }],",
    "operations: [{ kind: 'ModifyStat', stat: 'atk', amount: 300, equipped: true }],",
    'SMP-112 gives 300',
  ],
  [
    'shared',
    CARDS,
    "        id: 'equip',\n        trigger: { kind: 'Ignition' },\n        target: {\n          kind: 'Card',\n          zone: 'MonsterZone',\n          side: 'self',",
    "        id: 'equip',\n        trigger: { kind: 'Ignition' },\n        target: {\n          kind: 'Card',\n          zone: 'MonsterZone',\n          side: 'opponent',",
    'SMP-112 equips the opponent',
  ],
  [
    'shared',
    'packages/shared/src/deck/mech-demo-deck.ts',
    "...['SMP-044', 'SMP-111', 'SMP-112'].flatMap(x3),",
    "...['SMP-044', 'SMP-111', 'SMP-112', 'SMP-044'].flatMap((id) => [id]),",
    'MECH_DEMO_DECK loses copies',
  ],
  // ---- Web ----
  [
    'web',
    WEB + 'interaction.ts',
    '      ...(flip ? [{ label: strings.flipSummonOption, actions: [flip] }] : []),\n',
    '',
    'no "Lật ngửa" entry',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    ' ||\n      flipSummonAction(ctx.legalActions, viewer, card.id) !== null)',
    ')',
    'tapping a face-down monster does nothing',
  ],
  [
    'web',
    WEB + 'legal-index.ts',
    "a.type === 'FlipSummon' && mine(a, viewer) && a.payload.cardInstanceId === monsterId,",
    "a.type === 'FlipSummon' && mine(a, viewer),",
    'FlipSummon matched on any monster',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    'const off = candidates.filter((id) => !ctx.model.cards.some((c) => c.id === id));',
    'const off = [...candidates];',
    'picker also lists board candidates',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    "const id = picked?.id ?? (hit.kind === 'card' ? hit.id : null);",
    "const id = hit.kind === 'card' ? hit.id : null;",
    'picker slots not clickable',
  ],
  [
    'web',
    WEB + 'interaction.ts',
    'byEffect.length > 1',
    'byEffect.length > 99',
    'a two-effect hand Spell gets one entry',
  ],
  [
    'web',
    WEB + 'presenter.ts',
    "c.equippedTo !== null && cards.some((m) => m.id === c.equippedTo && m.zone === 'monster')",
    'c.equippedTo !== null',
    'equip link without its monster',
  ],
  [
    'web',
    WEB + 'animation-queue.ts',
    "kind: e.type === 'FlipSummoned' ? 'flipSummon' : 'specialSummon',",
    "kind: e.type === 'FlipSummoned' ? 'specialSummon' : 'flipSummon',",
    'animation kinds swapped',
  ],
  [
    'web',
    WEB + 'log-entries.ts',
    "    case 'CardEquipped':\n      return 'field';",
    "    case 'CardEquipped':\n      return 'combat';",
    'CardEquipped logged as combat',
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
  writeFileSync(file, normalised.replace(from, to));
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
