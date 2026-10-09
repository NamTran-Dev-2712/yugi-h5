// Manual mutation testing for task 4.8 (the unanswerable trigger prompt, OPEN-ISSUES P7; a monster activating its
// Ignition effect from the field behind `ruleset.allowMonsterEffectActivation`; `oncePerTurn`; API containment).
// Usage: node tools/mutants-4.8.mjs   (from the repo root — run it ALONE: it rebuilds the engine's `dist` for the API
// mutants, so no other test run, API or simulation may be going on).
//
// Each mutant edits one or more source snippets and is run against three groups of ENGINE tests separately, so the
// report shows WHAT kills it:
//   rules  = the behaviour tests of the task (rules/p7-orphan-equip-trigger.test.ts, rules/monster-ignition.test.ts)
//   fuzz   = the fuzz invariants + coverage of the task (testing/fuzz, tests named "task 4.8")
//   golden = the golden replays (a byte-for-byte pin: a kill here alone proves less)
// API mutants run the two API specs of the task instead. A mutant that does not compile is INVALID (not counted).
// A mutant counts as killed "by behaviour" when rules or fuzz (or the API spec) kills it.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const API = 'apps/api/src/modules/duels/';
const TRIGGERS = ENGINE + 'effects/triggers.ts';
const TRIGGER_ANSWER = ENGINE + 'actions/handlers/trigger-activation.ts';
const ACTIVATE = ENGINE + 'actions/handlers/activate-effect.ts';
const CANDIDATES = ENGINE + 'effects/activation-candidates.ts';
const MANAGER = API + 'duel-manager.ts';

const GROUPS = {
  rules: 'src/rules/p7-orphan-equip-trigger.test.ts src/rules/monster-ignition.test.ts',
  fuzz: 'src/testing/fuzz/fuzz.test.ts -t "task 4.8"',
  golden: 'src/testing/golden',
};
const API_SPECS =
  'src/modules/duels/monster-effect-containment.spec.ts src/modules/duels/ai/simulate.equip-trigger.spec.ts';

// The fix of readyTrigger, and the "a dead trigger takes any answer" path.
const FIX = [
  TRIGGERS,
  '  const state = detachOrphanEquips(current).state;',
  '  const state = current;',
];
const DEFENCE = [
  TRIGGER_ANSWER,
  '  if (ready === null) {',
  "  if (ready === null) {\n    bad('the trigger can no longer activate.');",
];

/** [name, edits ([file, from, to][]), where: 'engine' | 'api' | 'engine+api'] */
const mutants = [
  // --- A. the unanswerable prompt
  [
    'P7: readyTrigger reads the board BEFORE the orphan Equip leaves (the fix reverted)',
    [FIX],
    'engine',
  ],
  ['P7: a prompt whose trigger is dead refuses every answer again', [DEFENCE], 'engine'],
  ['P7: both reverted — the engine as it was before task 4.8', [FIX, DEFENCE], 'engine+api'],
  // --- B. the ruleset flag
  [
    'flag: a monster on the field is found whatever the ruleset says',
    [[ACTIVATE, '    state.ruleset.allowMonsterEffectActivation === true,', '    true,']],
    'engine+api',
  ],
  [
    'flag: any truthy-looking value switches it on (explicit false included)',
    [
      [
        ACTIVATE,
        '    state.ruleset.allowMonsterEffectActivation === true,',
        '    state.ruleset.allowMonsterEffectActivation !== undefined,',
      ],
    ],
    'engine',
  ],
  // --- B. who / when / what
  [
    'a face-down monster may activate its effect',
    [
      [
        ACTIVATE,
        "    if (card.position === 'DefenseDown')\n      fail('NOT_ACTIVATABLE', `\"${definition.name.en}\" is face-down.`);\n",
        '',
      ],
    ],
    'engine',
  ],
  [
    "a monster may activate on the opponent's turn (inside a reaction window)",
    [
      [
        ACTIVATE,
        "    if (playerIndex !== state.turnPlayerIndex)\n      fail('NOT_TURN_PLAYER', \"a monster's effect may only be activated on your own turn.\");\n",
        '',
      ],
    ],
    'engine',
  ],
  [
    'a monster may activate outside a Main Phase',
    [
      [
        ACTIVATE,
        "    if (state.phase !== 'Main1' && state.phase !== 'Main2')\n      fail('WRONG_PHASE', `only allowed in a Main Phase (current phase: ${state.phase}).`);\n    trigger = 'Ignition';\n  } else if (source.zone === 'MonsterZone') {",
        "    trigger = 'Ignition';\n  } else if (source.zone === 'MonsterZone') {",
      ],
    ],
    'engine',
  ],
  [
    'a monster activates its Quick effect instead of its Ignition effect',
    [
      [
        ACTIVATE,
        "    trigger = 'Ignition';\n  } else if (source.zone === 'MonsterZone') {",
        "    trigger = 'Quick';\n  } else if (source.zone === 'MonsterZone') {",
      ],
    ],
    'engine',
  ],
  // --- B. oncePerTurn
  [
    'oncePerTurn is never checked',
    [
      [
        ACTIVATE,
        '  if (effect.oncePerTurn === true && card.effectUsedTurns?.[effect.id] === state.turnCount)',
        '  if (false as boolean)',
      ],
    ],
    'engine',
  ],
  [
    'oncePerTurn never resets (any earlier use blocks, whatever the turn)',
    [
      [
        ACTIVATE,
        '  if (effect.oncePerTurn === true && card.effectUsedTurns?.[effect.id] === state.turnCount)',
        '  if (effect.oncePerTurn === true && card.effectUsedTurns?.[effect.id] !== undefined)',
      ],
    ],
    'engine',
  ],
  [
    'oncePerTurn applies to every effect of a monster (the data flag is ignored)',
    [
      [
        ACTIVATE,
        '  if (effect.oncePerTurn === true && card.effectUsedTurns?.[effect.id] === state.turnCount)',
        '  if (card.effectUsedTurns?.[effect.id] === state.turnCount)',
      ],
      [ACTIVATE, '  if (effect.oncePerTurn !== true) return board;\n', ''],
    ],
    'engine',
  ],
  [
    'no turn stamp is written at activation (a negated or resolved use does not count)',
    [
      [
        ACTIVATE,
        '  if (effect.oncePerTurn !== true) return board;',
        '  if (turnCount >= 0) return board;',
      ],
    ],
    'engine',
  ],
  [
    'the turn stamp carries the wrong turn',
    [
      [
        ACTIVATE,
        '{ ...slot, effectUsedTurns: { ...slot.effectUsedTurns, [effect.id]: turnCount } }',
        '{ ...slot, effectUsedTurns: { ...slot.effectUsedTurns, [effect.id]: turnCount - 1 } }',
      ],
    ],
    'engine',
  ],
  [
    'the turn stamp lands on every monster of the player (counted per name / per side, not per copy)',
    [[ACTIVATE, '      i === zoneIndex && slot\n', '      slot\n']],
    'engine',
  ],
  // --- B. costs
  [
    "a monster's effect is activated without paying its cost",
    [
      [
        ACTIVATE,
        '  const paid = payCosts(current, playerIndex, costPlan);',
        "  const paid = payCosts(current, playerIndex, source.zone === 'MonsterZone' ? [] : costPlan);",
      ],
    ],
    'engine',
  ],
  [
    'a monster may be Tributed for its own effect',
    [
      [
        ACTIVATE,
        "    source.zone === 'MonsterZone' &&\n    costPlan.some(",
        '    false &&\n    costPlan.some(',
      ],
    ],
    'engine',
  ],
  // --- B. legal actions
  [
    'monsters on the field are not activation candidates (never listed, auto-pass ignores them)',
    [
      [
        CANDIDATES,
        '  for (const source of [...me.hand, ...backrow, ...ownMonsters]) {',
        '  for (const source of [...me.hand, ...backrow]) {',
      ],
    ],
    'engine',
  ],
  [
    'monsters are listed BEFORE the Spells / Traps (the order of older legal-action lists changes)',
    [
      [
        CANDIDATES,
        '  for (const source of [...me.hand, ...backrow, ...ownMonsters]) {',
        '  for (const source of [...ownMonsters, ...me.hand, ...backrow]) {',
      ],
    ],
    'engine',
  ],
  // --- C. API containment
  [
    'API: createDuel passes the engine-only ruleset key on',
    [
      [
        MANAGER,
        '    const ruleset = wireRuleset(config.ruleset);',
        '    const ruleset = config.ruleset;',
      ],
    ],
    'api',
  ],
  [
    'API: a Sandbox state keeps the engine-only ruleset key',
    [
      [
        MANAGER,
        '      ruleset: withoutEngineOnlyKeys(config.state.ruleset),',
        '      ruleset: config.state.ruleset,',
      ],
    ],
    'api',
  ],
];

const run = (command, env = {}) => {
  try {
    execSync(command, { stdio: 'pipe', env: { ...process.env, NO_COLOR: '1', ...env } });
    return true;
  } catch {
    return false;
  }
};

const results = [];
let invalid = 0;
let killedByBehaviour = 0;
let killedAtAll = 0;
for (const [name, edits, where] of mutants) {
  const originals = new Map();
  let missing = null;
  for (const [file, from, to] of edits) {
    if (!originals.has(file)) originals.set(file, readFileSync(file, 'utf8'));
    const current = (originals.get(file + ':mutated') ?? originals.get(file)).replace(
      /\r\n/g,
      '\n',
    );
    if (!current.includes(from)) {
      missing = `pattern not found in ${file}`;
      break;
    }
    originals.set(
      file + ':mutated',
      current.replace(from, () => to),
    );
  }
  if (missing) {
    results.push(`MISSING   ${name}  (${missing})`);
    console.log(results.at(-1));
    continue;
  }
  const files = [...originals.keys()].filter((k) => !k.endsWith(':mutated'));
  const restore = () => {
    for (const file of files) writeFileSync(file, originals.get(file));
  };
  let line;
  try {
    for (const file of files) writeFileSync(file, originals.get(file + ':mutated'));
    const engineCompiles = run('pnpm --filter @yugi/game-engine exec tsc --noEmit -p .');
    const apiCompiles =
      where === 'api' ? run('pnpm --filter @yugi/api exec tsc --noEmit -p .') : true;
    if (!engineCompiles || !apiCompiles) {
      invalid++;
      line = `INVALID   ${name}  (does not compile)`;
    } else {
      const cells = [];
      let behaviour = false;
      let any = false;
      if (where !== 'api') {
        for (const [group, tests] of Object.entries(GROUPS)) {
          const killed = !run(`pnpm --filter @yugi/game-engine exec vitest run ${tests}`);
          cells.push(`${group}:${killed ? 'KILL' : ' -  '}`);
          any ||= killed;
          if (group !== 'golden') behaviour ||= killed;
        }
      }
      if (where !== 'engine') {
        // The API tests read the engine from its `dist`.
        if (where === 'engine+api')
          run('pnpm --filter @yugi/game-engine exec tsc -p tsconfig.build.json');
        const killed = !run(`pnpm --filter @yugi/api exec vitest run ${API_SPECS}`, {
          AI_SIM_GAMES: '12',
        });
        cells.push(`api:${killed ? 'KILL' : ' -  '}`);
        any ||= killed;
        behaviour ||= killed;
      }
      if (any) killedAtAll++;
      if (behaviour) killedByBehaviour++;
      line = `${behaviour ? 'KILLED   ' : any ? 'PIN-ONLY ' : 'SURVIVED '} [${cells.join(' ')}]  ${name}`;
    }
  } finally {
    restore();
    if (where === 'engine+api')
      run('pnpm --filter @yugi/game-engine exec tsc -p tsconfig.build.json');
  }
  results.push(line);
  console.log(line);
}

const valid = results.filter((r) => !r.startsWith('INVALID') && !r.startsWith('MISSING')).length;
const missingCount = results.filter((r) => r.startsWith('MISSING')).length;
console.log(
  `\n${killedByBehaviour}/${valid} valid mutants killed by a behaviour test (rules / fuzz / API spec); ` +
    `${killedAtAll}/${valid} killed by any test; ${invalid} invalid (do not compile); ${missingCount} missing patterns`,
);
process.exitCode = killedByBehaviour === valid && missingCount === 0 ? 0 : 1;
