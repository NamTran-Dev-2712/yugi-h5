// Manual mutation testing for task 4.2a (operation SpecialSummon from the hand / graveyard).
// Usage: node tools/mutants-4.2a.mjs   (from the repo root)
// Each mutant edits one source snippet, runs the relevant tests and expects a FAILURE (= mutant killed).
// Mutants tagged 'shared' run the shared schema tests; the others run the engine tests + tsc. Engine tests read
// @yugi/shared from its dist, so shared mutants never need a rebuild (they are checked by shared's own tests).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const engineTests =
  'src/effects src/actions src/rules src/legal-actions.test.ts src/legal-actions.spells.test.ts src/testing/golden src/testing/fuzz';

const SS = ENGINE + 'effects/operations/special-summon.ts';
const TARGETS = ENGINE + 'effects/targets.ts';
const TRIGGERS = ENGINE + 'effects/triggers.ts';
const ACTIVATE = ENGINE + 'actions/handlers/activate-effect.ts';
const EFFECT_DEF = 'packages/shared/src/effects/effect-definition.ts';

const mutants = [
  // effects/operations/special-summon.ts — the operation itself
  [SS, "const position = op.position ?? 'Attack';", "const position = op.position ?? 'DefenseUp';", 'default position Defense'],
  [SS, 'const position = op.position ?? \'Attack\';', "const position = 'Attack' as const;", 'position param ignored'],
  [SS, 'const zoneIndex = freeMonsterZones(player)[0];', 'const zoneIndex = freeMonsterZones(player).at(-1);', 'highest empty zone instead of lowest'],
  [SS, '    if (zoneIndex === undefined) break;\n', '    if (zoneIndex === undefined) continue;\n    if (zoneIndex === -1) break;\n', 'equivalent-looking: continue instead of break (expected equivalent)'],
  [SS, '      summonedTurn: current.turnCount,\n', '', 'no summonedTurn stamp (could change position / attack at once)'],
  [
    SS,
    "hand: found.zone === 'Hand' ? player.hand.filter((c) => c.instanceId !== id) : player.hand,",
    'hand: player.hand,',
    'card stays in the hand too (duplicated)',
  ],
  [
    SS,
    "        found.zone === 'Graveyard'\n          ? player.graveyard.filter((c) => c.instanceId !== id)\n          : player.graveyard,",
    '        player.graveyard,',
    'card stays in the graveyard too (duplicated)',
  ],
  [SS, '      from: found.zone,', "      from: 'Hand' as const,", 'event always says from the hand'],
  [SS, 'return freeMonsterZones(state.players[controller]).length < needed;', 'return false;', 'zone check never blocks'],
  [SS, "const needed = effect.target?.kind === 'Card' ? effect.target.count : 1;", 'const needed = 1;', 'zone check ignores the target count'],
  // who calls the zone check
  [
    ACTIVATE,
    "  if (lacksSummonZones(state, playerIndex, effect))\n    fail('NO_FREE_MONSTER_ZONE', 'not enough empty Monster Zones for the Special Summon.');\n",
    '',
    'ActivateEffect skips the zone check',
  ],
  [
    TRIGGERS,
    '  if (lacksSummonZones(state, trigger.playerIndex, effect)) return null;',
    '  if (false) return null;',
    'a trigger skips the zone check',
  ],
  // effects/triggers.ts — Special Summon is a Summon
  [
    TRIGGERS,
    "if (event.type === 'NormalSummoned' || event.type === 'MonsterSpecialSummoned') {",
    "if (event.type === 'NormalSummoned') {",
    'a Special Summon never fires OnSummon',
  ],
  // effects/targets.ts — hand / graveyard targets
  [
    TARGETS,
    "const unsupported = target.zone === 'Deck' || (target.zone === 'Hand' && side !== controller);",
    "const unsupported = target.zone === 'Deck';",
    "the opponent's hand becomes targetable",
  ],
  [
    TARGETS,
    "      : target.zone === 'Graveyard'\n        ? player.graveyard",
    "      : target.zone === 'Graveyard'\n        ? player.hand",
    'graveyard targets read the hand',
  ],
  // packages/shared — the schema refine
  [EFFECT_DEF, "        e.target.side === 'self' &&\n", '', 'schema accepts the opponent side', 'shared'],
  [EFFECT_DEF, "        e.target.filter?.kind === 'Monster'", '        true', 'schema accepts a target without Monster filter', 'shared'],
  [
    EFFECT_DEF,
    "        (e.target.zone === 'Hand' || e.target.zone === 'Graveyard') &&\n",
    '',
    'schema accepts any zone',
    'shared',
  ],
];

const results = [];
for (const [file, from, to, name, suite] of mutants) {
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
    if (suite === 'shared') {
      execSync('pnpm --filter @yugi/shared exec vitest run src/effects', { stdio: 'pipe' });
    } else {
      execSync(`pnpm --filter @yugi/game-engine exec vitest run ${engineTests}`, { stdio: 'pipe' });
      execSync('pnpm --filter @yugi/game-engine exec tsc --noEmit -p .', { stdio: 'pipe' });
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
