// Manual mutation testing for task 3.2. Usage: node tools/mutants-3.2.mjs   (from the repo root)
// Each mutant edits one source line, runs the relevant tests and expects a FAILURE (= mutant killed).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const API = 'apps/api/src/modules/duels/';
const engineTests = 'src/actions src/effects src/rules src/legal-actions.spells.test.ts';

const mutants = [
  // activate-effect.ts
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    'if (current.winnerIndex !== null) break;',
    '',
    'lethal damage no longer stops later operations',
  ],
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    "...events.filter((e) => e.type !== 'DuelEnded'),\n    ...events.filter((e) => e.type === 'DuelEnded'),",
    '...events,',
    'DuelEnded no longer last',
  ],
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    'if (candidates.length === targetCount) return execute(state, prepared, candidates);',
    '',
    'no auto-target',
  ],
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    "if (effect.trigger.kind !== 'Ignition')",
    'if (false)',
    'trigger not checked',
  ],
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    "definition.kind === 'Trap') {",
    "definition.kind === 'Nope') {",
    'Trap in hand not rejected',
  ],
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    "if (definition.subType !== 'Normal')",
    'if (false)',
    'Spell subtype not checked',
  ],
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    'if (!conditionsHold(state, playerIndex, effect.condition))',
    'if (false)',
    'conditions not checked',
  ],
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    'for (const id of chosen) if (!allowed.has(id)) bad(',
    'for (const id of chosen) if (false) bad(',
    'prompt answer not checked against candidates',
  ],
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    'if (new Set(chosen).size !== chosen.length) bad(',
    'if (false) bad(',
    'duplicate targets accepted',
  ],
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    'version: state.version + 1,\n  };\n  events.push(',
    'version: state.version,\n  };\n  events.push(',
    'version not bumped on execute',
  ],
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    'const base: GameState = { ...state, pendingPrompt: null };',
    'const base: GameState = state;',
    'prompt not cleared before resolving',
  ],
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    'promptId: `effect-${state.turnCount}-${state.version}`',
    "promptId: 'effect'",
    'promptId not unique',
  ],
  [
    ENGINE + 'actions/handlers/activate-effect.ts',
    'graveyard: [\n      ...owner.graveyard,',
    'graveyard: [\n      ...[],',
    'spell never reaches the graveyard',
  ],
  // costs / targets / filter
  [
    ENGINE + 'effects/costs.ts',
    'if (player.lifePoints <= cost.amount) {',
    'if (player.lifePoints < cost.amount) {',
    'PayLP allows paying all LP',
  ],
  [
    ENGINE + 'effects/costs.ts',
    'if (cursor !== costInstanceIds.length) {',
    'if (false) {',
    'unused cost ids accepted',
  ],
  [
    ENGINE + 'effects/costs.ts',
    'if (!card || id === sourceInstanceId)',
    'if (!card)',
    'the spell can pay its own discard cost',
  ],
  [
    ENGINE + 'effects/costs.ts',
    'if (used.has(id)) invalid(',
    'if (false) invalid(',
    'duplicate cost ids accepted',
  ],
  [
    ENGINE + 'effects/targets.ts',
    "if (card.position === 'DefenseDown') continue;",
    '',
    'filter reads face-down cards',
  ],
  [
    ENGINE + 'effects/filter.ts',
    "if (def.kind !== 'Monster') return false;\n    if (filter.level.min",
    'if (filter.level.min',
    'level filter matches non-monsters',
  ],
  [
    ENGINE + 'effects/conditions.ts',
    'return state.turnPlayerIndex === controller;',
    'return true;',
    'IsMyTurn always true',
  ],
  // operations
  [
    ENGINE + 'effects/operations/damage.ts',
    'Math.max(0, victim.lifePoints - op.amount)',
    'victim.lifePoints - op.amount',
    'damage not clamped',
  ],
  [
    ENGINE + 'effects/operations/damage.ts',
    'if (ended) events.push(ended.event);',
    '',
    'lethal damage emits no DuelEnded',
  ],
  [
    ENGINE + 'effects/operations/heal.ts',
    'lifePoints: player.lifePoints + op.amount',
    'lifePoints: player.lifePoints',
    'heal does nothing',
  ],
  [
    ENGINE + 'effects/operations/destroy.ts',
    'players[at.ownerIndex]',
    'players[0]',
    'destroyed card goes to the wrong owner',
  ],
  [
    ENGINE + 'effects/operations/destroy.ts',
    "at.zone === 'MonsterZone' ? 'MonsterDestroyed' : 'SpellTrapDestroyed'",
    "'MonsterDestroyed'",
    'spell/trap destroy event wrong',
  ],
  [
    ENGINE + 'effects/operations/draw.ts',
    'sideIndex(ctx.controller, op.target)',
    'ctx.controller',
    'Draw ignores target side',
  ],
  // set-spell-trap
  [
    ENGINE + 'actions/handlers/set-spell-trap.ts',
    "position: 'DefenseDown',\n    setTurn: state.turnCount,",
    "position: 'Attack',\n    setTurn: state.turnCount,",
    'Set Spell is face-up',
  ],
  [
    ENGINE + 'actions/handlers/set-spell-trap.ts',
    'setTurn: state.turnCount,',
    '',
    'setTurn not stamped',
  ],
  [
    ENGINE + 'actions/handlers/set-spell-trap.ts',
    "if (definition.kind === 'Monster')",
    'if (false)',
    'monsters can be Set as Spell/Trap',
  ],
  [
    ENGINE + 'actions/handlers/set-spell-trap.ts',
    'if (player.board.spellTrapZones[zoneIndex] !== null)',
    'if (false)',
    'occupied zone overwritten',
  ],
  // legal actions
  [
    ENGINE + 'legal-actions.ts',
    "type: 'SetSpellTrap',",
    "type: 'Surrender',",
    'no SetSpellTrap candidates',
  ],
  [
    ENGINE + 'legal-actions.ts',
    "if (prompt && prompt.kind === 'SelectEffectTarget') {",
    'if (false) {',
    'no target-answer candidates',
  ],
  // api containment
  [
    API + 'duel-manager.ts',
    '(a) => !ENGINE_ONLY_ACTIONS.has(a.type)',
    "(a) => a.type !== 'StartDuel' && a.type !== 'Draw'",
    'legalActions leak engine-only actions',
  ],
  [
    API + 'duel-manager.ts',
    '      ENGINE_ONLY_ACTIONS.has(action.type)\n    ) {',
    '      false\n    ) {',
    'engine-only actions accepted over the service',
  ],
  [
    API + 'event-view.ts',
    "    case 'SpellTrapSet':\n    case 'EffectActivated':",
    "    case 'SpellTrapSetX':\n    case 'EffectActivated':",
    'unclassified event (tsc) — expected to fail typecheck, not tests',
  ],
];

const results = [];
for (const [file, from, to, name] of mutants) {
  const original = readFileSync(file, 'utf8');
  const normalised = original.replace(/\r\n/g, '\n');
  if (!normalised.includes(from)) {
    results.push(`MISSING  ${name}  (pattern not found in ${file})`);
    continue;
  }
  writeFileSync(file, normalised.replace(from, to));
  const isApi = file.startsWith('apps/api');
  const isTsc = name.includes('typecheck');
  const cmd = isTsc
    ? 'pnpm --filter @yugi/api typecheck'
    : isApi
      ? 'pnpm --filter @yugi/api exec vitest run src/modules/duels/duel-manager.engine-only.spec.ts'
      : `pnpm --filter @yugi/game-engine exec vitest run ${engineTests}`;
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
