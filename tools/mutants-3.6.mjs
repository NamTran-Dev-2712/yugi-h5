// Manual mutation testing for task 3.6 (Continuous effects + effect-level scriptId registry).
// Usage: node tools/mutants-3.6.mjs   (from the repo root)
// Each mutant edits one source snippet, runs the relevant tests and expects a FAILURE (= mutant killed).
// Shared mutants run the shared suite; engine mutants run the engine suites + tsc.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const SHARED = 'packages/shared/src/';
const engineTests =
  'src/effects src/actions src/rules src/legal-actions.test.ts src/legal-actions.spells.test.ts src/testing/golden src/testing/fuzz';

const CONTINUOUS = ENGINE + 'effects/continuous.ts';
const ATTACK = ENGINE + 'battle/resolve-attack.ts';
const ACTIVATE = ENGINE + 'actions/handlers/activate-effect.ts';
const CANDIDATES = ENGINE + 'effects/activation-candidates.ts';
const CHAIN = ENGINE + 'effects/chain.ts';
const SCRIPTS = ENGINE + 'effects/effect-scripts/registry.ts';
const TRIGGERS = ENGINE + 'effects/triggers.ts';
const EFFECT_DEF = SHARED + 'effects/effect-definition.ts';
const OPERATION = SHARED + 'effects/operation.ts';

const mutants = [
  // effects/continuous.ts — which effects are in force
  [
    CONTINUOUS,
    '      if (source === null || !isFaceUp(source)) continue;',
    '      if (source === null) continue;',
    'a face-down source applies its Continuous effect',
  ],
  [
    CONTINUOUS,
    "        if (effect.trigger.kind !== 'Continuous') continue;\n",
    '',
    'every effect of a face-up card counts as Continuous',
  ],
  [
    CONTINUOUS,
    '        if (!conditionsHold(state, controller, effect.condition)) continue;\n',
    '',
    'the Continuous effect ignores its conditions',
  ],
  [
    CONTINUOUS,
    '    for (const source of [...monsterZones, ...spellTrapZones]) {',
    '    for (const source of [...monsterZones]) {',
    'face-up Spell/Traps are not sources',
  ],
  [
    CONTINUOUS,
    '    for (const source of [...monsterZones, ...spellTrapZones]) {',
    '    for (const source of [...spellTrapZones, ...monsterZones]) {',
    'source order changes (Spell/Trap before monsters)',
  ],
  // ModifyStat handler
  [
    CONTINUOUS,
    '  if (target.controller !== sideIndex(active.controller, op.side)) return NONE;\n',
    '',
    'side ignored (both players affected)',
  ],
  [
    CONTINUOUS,
    '  if (target.controller !== sideIndex(active.controller, op.side)) return NONE;',
    '  if (target.controller === sideIndex(active.controller, op.side)) return NONE;',
    'side inverted',
  ],
  [
    CONTINUOUS,
    '  if (op.excludeSource && target.card.instanceId === active.source.instanceId) return NONE;\n',
    '',
    'excludeSource ignored',
  ],
  [
    CONTINUOUS,
    '    if (!def || !matchesFilter(def, op.filter)) return NONE;',
    '    if (!def) return NONE;',
    'filter ignored',
  ],
  [
    CONTINUOUS,
    "  return op.stat === 'atk' ? { atk: op.amount, def: 0 } : { atk: 0, def: op.amount };",
    "  return op.stat === 'def' ? { atk: op.amount, def: 0 } : { atk: 0, def: op.amount };",
    'atk/def swapped',
  ],
  // effectiveStats
  [
    CONTINUOUS,
    '  return { atk: Math.max(0, atk), def: Math.max(0, def) };',
    '  return { atk, def };',
    'no clamp at 0',
  ],
  [
    CONTINUOUS,
    '  if (target === null || !isFaceUp(target.card)) return { atk: printed.atk, def: printed.def };',
    '  if (target === null) return { atk: printed.atk, def: printed.def };',
    'a face-down monster gets modified',
  ],
  [
    CONTINUOUS,
    '    if (onField) target = { card: onField, controller };',
    '    if (onField) target = { card, controller };',
    "the caller's (pre-flip) copy is used instead of the board's",
  ],
  // battle/resolve-attack.ts
  [
    ATTACK,
    '  const boardAfterFlip = withPlayers();',
    '  const boardAfterFlip = state;',
    'stats read on the board BEFORE the flip',
  ],
  [
    ATTACK,
    '  const attackerStats = effectiveStats(boardAfterFlip, attacker, ctx);',
    '  const attackerStats = resolveMonster(attacker, ctx, reject);',
    'attacker uses printed ATK',
  ],
  [
    ATTACK,
    '  const targetStats = target === null ? null : effectiveStats(boardAfterFlip, target, ctx);',
    '  const targetStats = target === null ? null : resolveMonster(target, ctx, reject);',
    'target uses printed ATK/DEF',
  ],
  // activate-effect.ts / activation-candidates.ts
  [
    ACTIVATE,
    "  if (definition.effects?.find((e) => e.id === effectId)?.trigger.kind === 'Continuous')",
    '  if (false)',
    'Continuous effect of a Spell/Trap not rejected with CONTINUOUS_NOT_ACTIVATABLE',
  ],
  [
    ACTIVATE,
    "    if (asked?.trigger.kind === 'Continuous')",
    '    if (false)',
    'Continuous effect of a field monster: CARD_NOT_IN_HAND instead',
  ],
  [
    ACTIVATE,
    '  if (effect.scriptId !== undefined && !scriptFor(effect.scriptId))',
    '  if (false)',
    'unknown script activatable',
  ],
  [
    CANDIDATES,
    "      if (effect.trigger.kind === 'Continuous') continue;\n",
    '',
    'Continuous effects generated as candidates (only costs dry runs — expected EQUIVALENT)',
  ],
  // chain.ts / scripts
  [CHAIN, '  if (script && current.winnerIndex === null) {', '  if (false) {', 'script never runs'],
  [
    CHAIN,
    '  if (script && current.winnerIndex === null) {',
    '  if (script) {',
    'script runs after the duel ended (no test reaches it — expected EQUIVALENT with the halve script)',
  ],
  [
    SCRIPTS,
    '  if (amount === 0) return { state, events: [] };\n',
    '',
    'halve script emits a 0 damage event',
  ],
  [
    SCRIPTS,
    "  const opponent = sideIndex(ctx.controller, 'opponent');",
    "  const opponent = sideIndex(ctx.controller, 'self');",
    'halve script reads the wrong player',
  ],
  [
    SCRIPTS,
    '  return Object.prototype.hasOwnProperty.call(EFFECT_SCRIPTS, scriptId)',
    '  return true',
    'scriptFor ignores own-property check',
  ],
  [
    TRIGGERS,
    '  if (effect.scriptId !== undefined && !scriptFor(effect.scriptId)) return null;\n',
    '',
    'trigger with unknown script activates',
  ],
  // packages/shared schema
  [
    EFFECT_DEF,
    '  .refine((e) => e.operations.length > 0 || e.scriptId !== undefined, {',
    '  .refine(() => true, {',
    'effect with no operation and no script accepted',
    'shared',
  ],
  [
    EFFECT_DEF,
    "        (o) => isContinuousOperationKind(o.kind) === (e.trigger.kind === 'Continuous'),",
    '        () => true,',
    'continuous/resolve operations mixed freely',
    'shared',
  ],
  [
    EFFECT_DEF,
    "  .refine((e) => e.trigger.kind !== 'Continuous' || e.scriptId === undefined, {",
    '  .refine(() => true, {',
    'scriptId accepted on a Continuous effect',
    'shared',
  ],
  [
    OPERATION,
    "        .refine((n) => n !== 0, { message: 'amount must not be 0' }),",
    ',',
    'ModifyStat amount 0 accepted',
    'shared',
  ],
];

const results = [];
for (const [file, from, to, name, pkg = 'engine'] of mutants) {
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
