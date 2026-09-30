// Manual mutation testing for task 4.2b (FlipSummon action + OnFlip trigger).
// Usage: node tools/mutants-4.2b.mjs   (from the repo root)
// Each mutant edits one source snippet, runs the relevant tests and expects a FAILURE (= mutant killed).
// Suite 'shared' runs the shared schema tests, 'api' the api containment tests (after rebuilding nothing: api reads the
// engine from its dist, so only api-source mutants are tagged 'api'); the rest run the engine tests + tsc.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const engineTests =
  'src/effects src/actions src/rules src/legal-actions.test.ts src/legal-actions.spells.test.ts src/testing/golden src/testing/fuzz';

const FLIP = ENGINE + 'actions/handlers/flip-summon.ts';
const TRIGGERS = ENGINE + 'effects/triggers.ts';
const LEGAL = ENGINE + 'legal-actions.ts';
const TRIGGER_SCHEMA = 'packages/shared/src/effects/trigger.ts';
const EFFECT_DEF = 'packages/shared/src/effects/effect-definition.ts';
const WIRE = 'apps/api/src/modules/duels/wire-actions.ts';

const mutants = [
  // actions/handlers/flip-summon.ts
  [FLIP, "    position: 'Attack',\n    positionChangedTurn", "    position: 'DefenseUp',\n    positionChangedTurn", 'flips into Defense instead of Attack'],
  [FLIP, '    positionChangedTurn: state.turnCount,\n  };', '  };', 'no positionChangedTurn stamp (could change position again)'],
  [FLIP, "  if (monster.position !== 'DefenseDown')\n    reject('MONSTER_FACE_UP'", "  if (false)\n    reject('MONSTER_FACE_UP'", 'face-up monsters can be Flip Summoned'],
  [FLIP, '  if (monster.summonedTurn === state.turnCount)\n    reject(', '  if (false)\n    reject(', 'a monster Set this turn can be Flip Summoned'],
  [FLIP, "  if (state.phase !== 'Main1' && state.phase !== 'Main2')\n    reject('WRONG_PHASE'", "  if (false)\n    reject('WRONG_PHASE'", 'any phase allowed'],
  [FLIP, '  if (playerIndex !== state.turnPlayerIndex)\n    reject(', '  if (false)\n    reject(', 'off-turn Flip Summon allowed'],
  [FLIP, '    if (player.board.spellTrapZones.some((c) => c?.instanceId === cardInstanceId))\n      reject(', '    if (false)\n      reject(', 'Spell/Trap reported as CARD_NOT_ON_FIELD'],
  [FLIP, '  const triggers = collectTriggers(placedState, [event], ctx);', '  const triggers: ReturnType<typeof collectTriggers> = [];', 'Flip Summon fires no trigger'],
  [FLIP, '  const withWindow = openReactionWindow(', '  const withWindow = null && openReactionWindow(', 'no Summon reaction window after a Flip Summon'],
  [FLIP, '  return { state: { ...(withWindow ?? placedState), version: state.version + 1 }', '  return { state: { ...(withWindow ?? placedState), version: state.version }', 'version not bumped'],
  [FLIP, '  const nextPlayer: PlayerState = { ...player, board:', '  const nextPlayer: PlayerState = { ...player, hasNormalSummonedThisTurn: true, board:', 'Flip Summon uses the Normal Summon'],
  // effects/triggers.ts
  [TRIGGERS, "effectsOf(event.definitionId, ['OnFlip', 'OnSummon'], ctx)", "effectsOf(event.definitionId, ['OnFlip'], ctx)", 'Flip Summon does not fire OnSummon'],
  [TRIGGERS, "effectsOf(event.definitionId, ['OnFlip', 'OnSummon'], ctx)", "effectsOf(event.definitionId, ['OnSummon'], ctx)", 'Flip Summon does not fire OnFlip'],
  [TRIGGERS, '      if (source === null) continue;', '      continue;', 'a flip by an attack never fires OnFlip'],
  [TRIGGERS, "return { zone: 'Graveyard' };\n  return null;", 'return null;\n  return null;', 'a flip monster destroyed by that battle does not fire'],
  [TRIGGERS, "    return { zone: 'MonsterZone', zoneIndex };", "    return { zone: 'Graveyard' };", 'a surviving flipped monster looked up in the graveyard'],
  [TRIGGERS, "    effect.trigger.kind !== 'OnDestroyed' &&\n    effect.trigger.kind !== 'OnFlip'\n  )", "    effect.trigger.kind !== 'OnDestroyed'\n  )", 'readyTrigger refuses OnFlip'],
  [TRIGGERS, '    (kinds as readonly string[]).includes(e.trigger.kind),', '    true,', 'every effect fires whatever its trigger kind'],
  // legal-actions.ts
  [LEGAL, "    out.push({\n      type: 'FlipSummon',", "    if (false) out.push({\n      type: 'FlipSummon',", 'legalActions never offer FlipSummon'],
  // packages/shared
  [TRIGGER_SCHEMA, "z.object({ kind: z.literal('OnFlip'), ...TriggeredSchemaFields }).strict()", "z.object({ kind: z.literal('OnFlip') }).strict()", 'schema: OnFlip without mandatory', 'shared'],
  [EFFECT_DEF, " &&\n        e.trigger.kind !== 'OnFlip') ||", ') ||', 'schema: OnFlip may cost Discard/Tribute', 'shared'],
  // apps/api containment
  [WIRE, "  'FlipSummon',\n]);", ']);', 'api offers / accepts the engine-only FlipSummon', 'api'],
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
    } else if (suite === 'api') {
      execSync('pnpm --filter @yugi/api exec vitest run src/modules/duels/duel-manager.spec.ts', {
        stdio: 'pipe',
      });
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
