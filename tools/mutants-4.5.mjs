// Manual mutation testing for task 4.5 (Fusion: Extra Deck at StartDuel, operation FusionSummon, the chain paused for
// the two Fusion prompts). Usage: node tools/mutants-4.5.mjs   (from the repo root)
// Each mutant edits one source snippet, runs the engine tests + tsc and expects a FAILURE (= mutant killed).
// Two stages to keep it short: the rule / golden tests first; only a mutant they do not catch also runs the fuzz + tsc.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const fastTests =
  'src/rules/fusion.test.ts src/actions/handlers/start-duel.extra-deck.test.ts src/effects/operations src/testing/golden';
const slowTests =
  'src/testing/fuzz src/legal-actions.property.test.ts src/rules src/actions src/effects';

const FUSION = ENGINE + 'effects/operations/fusion-summon.ts';
const CHAIN = ENGINE + 'effects/chain.ts';
const TRIGGERS = ENGINE + 'effects/triggers.ts';
const TARGETS = ENGINE + 'effects/targets.ts';
const ACTIVATE = ENGINE + 'actions/handlers/activate-effect.ts';
const PROMPT = ENGINE + 'actions/handlers/fusion-prompt.ts';
const START = ENGINE + 'actions/handlers/start-duel.ts';
const SUMMON = ENGINE + 'actions/handlers/summon.ts';
const LEGAL = ENGINE + 'legal-actions.ts';

const mutants = [
  // A — fusion-summon.ts: which cards may be materials
  [
    FUSION,
    "  if (op.sources.includes('Hand')) {",
    '  if (op.sources.length > 0) {',
    'the hand is always a material source (the operation says Deck only)',
  ],
  [
    FUSION,
    "  if (op.sources.includes('Field')) {",
    '  if (op.sources.length > 0) {',
    'the field is always a material source (the operation says hand only)',
  ],
  [
    FUSION,
    "  if (op.sources.includes('Deck')) {",
    "  if (op.sources.includes('Graveyard' + '')) {",
    'the Deck is never a material source',
  ],
  [
    FUSION,
    "    if (definition?.kind !== 'Monster' || definition.category !== 'Fusion') continue;",
    "    if (definition?.kind !== 'Monster') continue;",
    'any monster in the Extra Deck that lists materials can be Fusion Summoned',
  ],
  [
    FUSION,
    '    if (materials.length === 0) continue;',
    '',
    'a Fusion Monster without materials is Summoned for free',
  ],
  [
    FUSION,
    '      (id) => candidates.filter((c) => c.card.definitionId === id).length >= countOf(materials, id),',
    '      (id) => candidates.filter((c) => c.card.definitionId === id).length >= 1,',
    'one copy is enough for a material named twice',
  ],
  // A — fusion-summon.ts: room for the monster
  [
    FUSION,
    '    freeMonsterZones(state.players[controller]).length > 0 ||',
    '    freeMonsterZones(state.players[controller]).length >= 0 ||',
    'a full field never blocks the activation',
  ],
  [
    FUSION,
    "    option.candidates.some((c) => c.from === 'MonsterZone')\n  );",
    "    option.candidates.some((c) => c.from === 'Deck')\n  );",
    'a material on a full field does not count as freeing a zone',
  ],
  [
    FUSION,
    "  if (made.length === 0) return 'NOT_ACTIVATABLE';",
    "  if (made.length === 0) return 'NO_FREE_MONSTER_ZONE';",
    'no Fusion Monster to make is reported as "no free Monster Zone"',
  ],
  // A — fusion-summon.ts: the answer to SelectFusionMaterials
  [
    FUSION,
    '  if (new Set(chosenIds).size !== chosenIds.length) return null;',
    '',
    'the same card may be chosen twice for a repeated material',
  ],
  [
    FUSION,
    '  if (!option.materials.every((id) => countOf(provided, id) === countOf(option.materials, id)))',
    '  if (!option.materials.every((id) => countOf(provided, id) >= 0))',
    'any candidates are accepted as materials (wrong set)',
  ],
  [
    FUSION,
    '  if (!freed && freeMonsterZones(state.players[controller]).length === 0) return null;',
    '  if (!freed && freeMonsterZones(state.players[controller]).length < 0) return null;',
    'materials that leave no empty Monster Zone are accepted',
  ],
  // A — fusion-summon.ts: the Fusion Summon itself
  [
    FUSION,
    "  const position = op.position ?? 'Attack';",
    "  const position = op.position === undefined ? 'Attack' : 'Attack';",
    'the operation position is ignored (always Attack)',
  ],
  [
    FUSION,
    '    summonedTurn: state.turnCount,',
    '',
    'the Fusion Monster is not stamped as Summoned this turn (it could attack / change position)',
  ],
  [
    FUSION,
    "  if (materials.some((m) => m.from === 'Deck')) {",
    "  if (materials.some((m) => m.from !== 'MonsterZone')) {",
    'the Deck is shuffled (rng used) for materials from the hand too',
  ],
  [
    FUSION,
    '      deck.filter((c) => !used.has(c.instanceId)),',
    '      deck,',
    'a material from the Deck stays in the Deck (the card is in two places)',
  ],
  [
    FUSION,
    '    hand: player.hand.filter((c) => !used.has(c.instanceId)),',
    '    hand: player.hand,',
    'a material from the hand stays in the hand (the card is in two places)',
  ],
  [
    FUSION,
    '    extraDeck: player.extraDeck.filter((c) => c.instanceId !== fusion.instanceId),',
    '    extraDeck: player.extraDeck,',
    'the Fusion Monster stays in the Extra Deck after its Summon',
  ],
  // B — effects/chain.ts: pausing the chain and finishing it
  [
    CHAIN,
    '      const paused = i === 0 ? pauseForFusion(current, link, links.length, events, ctx) : null;',
    '      const paused = i === -1 ? pauseForFusion(current, link, links.length, events, ctx) : null;',
    'the chain never pauses: the fusion link resolves without asking (no Fusion Summon)',
  ],
  [
    CHAIN,
    '    owedTriggers: collectTriggers(state, events, ctx),',
    '    owedTriggers: [],',
    'triggers fired by the links above the fusion link are forgotten',
  ],
  [
    CHAIN,
    '    chainStack: [link],\n    chainWindow: { priorityPlayer: link.playerIndex, passCount: 0 },',
    '    chainStack: [],\n    chainWindow: { priorityPlayer: link.playerIndex, passCount: 0 },',
    'the paused link is dropped from the chain (the Spell vanishes while the prompt is open)',
  ],
  [
    CHAIN,
    '    chainWindow: { priorityPlayer: link.playerIndex, passCount: 0 },',
    '    chainWindow: { priorityPlayer: link.playerIndex === 0 ? 1 : 0, passCount: 0 },',
    'the paused window is held by the opponent',
  ],
  [
    CHAIN,
    '  const fired = [...owedTriggers, ...collectTriggers(current, fusionEvents, ctx)];',
    '  const fired = [...owedTriggers];',
    'the OnSummon trigger of the Fusion Monster never fires',
  ],
  [
    CHAIN,
    '  const fired = [...owedTriggers, ...collectTriggers(current, fusionEvents, ctx)];',
    '  const fired = [...collectTriggers(current, fusionEvents, ctx)];',
    'the owed triggers are dropped when the Fusion Summon is done',
  ],
  [
    CHAIN,
    '  const fired = [...owedTriggers, ...collectTriggers(current, fusionEvents, ctx)];',
    '  const fired = [...collectTriggers(current, fusionEvents, ctx), ...owedTriggers];',
    'the Fusion Summon trigger goes on the chain before the older owed triggers',
  ],
  [
    CHAIN,
    "  events.push(...spent.events, { type: 'ChainResolved', linkCount });",
    "  events.push(...spent.events, { type: 'ChainResolved', linkCount: 1 });",
    'ChainResolved after a paused chain always says 1 link',
  ],
  // C — triggers.ts / targets.ts / summon.ts: a Fusion Summon is a Summon; a Fusion Monster has no other way in
  [
    TRIGGERS,
    "      event.type === 'MonsterSpecialSummoned' ||\n      event.type === 'MonsterFusionSummoned'",
    "      event.type === 'MonsterSpecialSummoned'",
    'a Fusion Summon is not a Summon for OnSummon triggers',
  ],
  [
    TARGETS,
    "    return !(definition?.kind === 'Monster' && definition.category === 'Fusion');",
    "    return !(definition?.kind === 'Monster' && definition.category === 'Ritual');",
    'the SpecialSummon operation takes a Fusion Monster from the hand / graveyard',
  ],
  [
    SUMMON,
    "  if (definition.category === 'Fusion')",
    "  if (definition.category === 'Ritual')",
    'a Fusion Monster can be Normal Summoned / Set',
  ],
  // D — activate-effect.ts: the activation checks
  [
    ACTIVATE,
    '  if (fusionOperationOf(effect) && spellSpeed !== 1)',
    '  if (fusionOperationOf(effect) && spellSpeed > 3)',
    'a Quick-Play (Spell Speed 2) fusion effect can be activated',
  ],
  [
    ACTIVATE,
    "  if (blocked === 'NOT_ACTIVATABLE')\n    fail('NOT_ACTIVATABLE',",
    "  if (blocked === 'NOT_ACTIVATABLE' && state.turnCount < 0)\n    fail('NOT_ACTIVATABLE',",
    'the fusion Spell can be activated with no Fusion Monster to make',
  ],
  [
    ACTIVATE,
    "  if (blocked === 'NO_FREE_MONSTER_ZONE')",
    "  if (blocked === 'NO_FREE_MONSTER_ZONE' && state.turnCount < 0)",
    'the fusion Spell can be activated with no room for the Fusion Monster',
  ],
  // E — fusion-prompt.ts: the answers
  [
    PROMPT,
    '  if (chosen.length !== 1) bad(',
    '  if (chosen.length < 1) bad(',
    'SelectFusionMonster accepts several ids (takes the first)',
  ],
  [
    PROMPT,
    '  const option = options.find((o) => o.fusion.instanceId === chosen[0]);\n  if (!option) return bad(`${chosen[0]}',
    '  const option = options.find((o) => o.fusion.instanceId !== chosen[0]) ?? options[0];\n  if (!option) return bad(`${chosen[0]}',
    'SelectFusionMonster does not take the chosen monster',
  ],
  [
    PROMPT,
    '    owedTriggers: saved.owedTriggers,',
    '    owedTriggers: [],',
    'the owed triggers are lost between the two prompts',
  ],
  [
    PROMPT,
    '    saved.owedTriggers,\n    saved.linkCount,',
    '    [],\n    saved.linkCount,',
    'the owed triggers are not handed to the end of the chain',
  ],
  // F — start-duel.ts: loading the Extra Deck
  [
    START,
    '    if (list.length > ruleset.extraDeckSize) {',
    '    if (list.length >= ruleset.extraDeckSize) {',
    'an Extra Deck of exactly extraDeckSize cards is rejected',
  ],
  [
    START,
    '    if (list.length > ruleset.extraDeckSize) {',
    '    if (list.length > ruleset.extraDeckSize + 100) {',
    'an Extra Deck over the limit is accepted',
  ],
  [
    START,
    '        instanceId: `p${playerIndex}-x${i}`,',
    '        instanceId: `p${playerIndex}-${i}`,',
    'Extra Deck cards reuse the instance ids of the Main Deck',
  ],
  [
    START,
    '      extraDeck: extraDeckLists[playerIndex].map(',
    '      extraDeck: extraDeckLists[0].map(',
    "both players get player 0's Extra Deck list",
  ],
  // G — legal-actions.ts
  [
    LEGAL,
    "      prompt.kind === 'SelectFusionMonster' ||\n      prompt.kind === 'SelectFusionMaterials')",
    "      prompt.kind === 'SelectFusionMonster')",
    'getLegalActions lists no answer for SelectFusionMaterials',
  ],
  [
    LEGAL,
    "      prompt.kind === 'SelectFusionMonster' ||\n      prompt.kind === 'SelectFusionMaterials')",
    "      prompt.kind === 'SelectFusionMaterials')",
    'getLegalActions lists no answer for SelectFusionMonster',
  ],
];

const run = (tests) =>
  execSync(`pnpm --filter @yugi/game-engine exec vitest run ${tests}`, { stdio: 'pipe' });

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
  let by = '';
  try {
    run(fastTests);
    by = 'slow';
    run(slowTests);
    by = 'tsc';
    execSync('pnpm --filter @yugi/game-engine exec tsc --noEmit -p .', { stdio: 'pipe' });
  } catch {
    killed = true;
  } finally {
    writeFileSync(file, original);
  }
  const stage = by === '' ? 'rule/golden tests' : by === 'slow' ? 'fuzz / other tests' : 'tsc only';
  results.push(`${killed ? `KILLED   [${stage}]` : 'SURVIVED'} ${name}`);
  console.log(results.at(-1));
}
const survived = results.filter((r) => r.startsWith('SURVIVED') || r.startsWith('MISSING')).length;
const tscOnly = results.filter((r) => r.includes('[tsc only]')).length;
console.log(
  `\n${results.length - survived}/${results.length} mutants killed (${tscOnly} by tsc only)`,
);
process.exitCode = survived === 0 ? 0 : 1;
