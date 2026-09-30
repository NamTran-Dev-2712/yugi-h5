// Manual mutation testing for task 4.2c (Equip Spell: operation Equip, ModifyStat.equipped, detach with the monster).
// Usage: node tools/mutants-4.2c.mjs   (from the repo root)
// Each mutant edits one source snippet, runs the relevant tests and expects a FAILURE (= mutant killed).
// Mutants tagged 'shared' run the shared schema tests; the others run the engine tests + tsc.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const engineTests =
  'src/effects src/actions src/rules src/legal-actions.test.ts src/legal-actions.spells.test.ts src/testing/golden src/testing/fuzz';

const EQUIP = ENGINE + 'effects/operations/equip.ts';
const CONT = ENGINE + 'effects/continuous.ts';
const CHAIN = ENGINE + 'effects/chain.ts';
const ACTIVATE = ENGINE + 'actions/handlers/activate-effect.ts';
const DETACH = ENGINE + 'state/detach-equips.ts';
const APPLY = ENGINE + 'apply-action.ts';
const EFFECT_DEF = 'packages/shared/src/effects/effect-definition.ts';
const CARD_DEF = 'packages/shared/src/cards/card-definition.ts';

const mutants = [
  // effects/operations/equip.ts
  [EQUIP, '{ ...equip.card, equippedTo: target.card.instanceId }', '{ ...equip.card }', 'Equip never records its monster'],
  [EQUIP, '    !equip ||\n', '', 'no check that the Equip is still on the field (destroyed in response)'],
  [EQUIP, '        targetInstanceId: target.card.instanceId,', "        targetInstanceId: 'x',", 'CardEquipped names the wrong monster'],
  // effects/continuous.ts
  [CONT, 'active.source.equippedTo ? delta : NONE;', 'active.source.equippedTo ? delta : delta;', 'equipped buff applies to every monster'],
  [CONT, '  if (op.equipped) return target.card.instanceId === active.source.equippedTo ? delta : NONE;\n', '', 'equipped ModifyStat ignored'],
  // effects/chain.ts
  [CHAIN, '    if (inZone.equippedTo !== undefined) return { state, events: [] };\n', '', 'a resolved Equip goes to the graveyard at once'],
  // actions/handlers/activate-effect.ts
  [ACTIVATE, "definition.subType === 'Normal' || definition.subType === 'Equip'", "definition.subType === 'Normal'", 'Equip Spells not activatable from the hand'],
  [ACTIVATE, '    if (placeInZone === -1)\n      fail(', '    if (false)\n      fail(', 'activation allowed with all Spell/Trap Zones full'],
  [ACTIVATE, ".spellTrapZones.findIndex((c) => c === null);\n    if (placeInZone", ".spellTrapZones.findLastIndex((c) => c === null);\n    if (placeInZone", 'highest empty zone instead of lowest'],
  [ACTIVATE, "    ownerIndex: card.ownerIndex,\n    position: 'Attack',\n  };", "    ownerIndex: card.ownerIndex,\n    position: 'DefenseDown',\n  };", 'Equip placed face-down'],
  [ACTIVATE, "      ? player.hand.filter((c) => c.instanceId !== card.instanceId)\n      : player.hand;", '      ? player.hand\n      : player.hand;', 'Equip stays in the hand too (duplicated)'],
  // state/detach-equips.ts + apply-action.ts
  [DETACH, "      if (c && c.position !== 'DefenseDown') faceUpMonsters.add(c.instanceId);", '      if (c) faceUpMonsters.add(c.instanceId);', 'a face-down monster keeps its Equip'],
  [DETACH, 'graveyard: [...p.graveyard, ...buried] };', 'graveyard: p.graveyard };', 'detached Equip vanishes instead of reaching the graveyard'],
  [DETACH, '  const faceUpMonsters = new Set<string>();', '  return { state, events: [] };\n  const faceUpMonsters = new Set<string>();', 'nothing is ever detached'],
  [APPLY, '  if (detached.events.length === 0) return result;', '  return result;', 'applyAction never runs the detach rule'],
  // packages/shared
  [EFFECT_DEF, '        e.target.count === 1 &&\n', '', 'schema: Equip with several targets', 'shared'],
  [EFFECT_DEF, '            ? o.side === undefined && o.filter === undefined && o.excludeSource === undefined', '            ? true', 'schema: equipped with side/filter', 'shared'],
  [CARD_DEF, "      (card.kind === 'Spell' && card.subType === 'Equip') ||\n", '      true ||\n', 'schema: Equip effects on any card', 'shared'],
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
