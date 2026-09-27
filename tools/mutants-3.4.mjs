// Manual mutation testing for task 3.4 (Spell Speed from data, Set Trap / Set Quick-Play activation).
// Usage: node tools/mutants-3.4.mjs   (from the repo root)
// Each mutant edits one source snippet, runs the relevant tests and expects a FAILURE (= mutant killed).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const SHARED = 'packages/shared/src/';
const engineTests =
  'src/effects src/actions src/rules src/legal-actions.spells.test.ts src/testing/golden src/testing/fuzz';
const sharedTests = 'src/effects';

const SPEED = ENGINE + 'effects/spell-speed.ts';
const ACT = ENGINE + 'actions/handlers/activate-effect.ts';
const CHAIN = ENGINE + 'effects/chain.ts';
const CAND = ENGINE + 'effects/activation-candidates.ts';

const mutants = [
  // effects/spell-speed.ts — default table + explicit override
  [
    SPEED,
    '  if (effect.spellSpeed !== undefined) return effect.spellSpeed;\n',
    '',
    'explicit spellSpeed ignored',
  ],
  [
    SPEED,
    "subType === 'Counter' ? 3 : 2",
    "subType === 'Counter' ? 2 : 2",
    'Counter Trap is Speed 2',
  ],
  [
    SPEED,
    "subType === 'Counter' ? 3 : 2",
    "subType === 'Counter' ? 3 : 1",
    'Normal Trap is Speed 1',
  ],
  [
    SPEED,
    "definition.subType === 'QuickPlay') return 2;",
    "definition.subType === 'QuickPlay') return 1;",
    'Quick-Play is Speed 1',
  ],

  // actions/handlers/activate-effect.ts — who / when / from where
  [
    ACT,
    'if (state.chainWindow === null && playerIndex !== state.turnPlayerIndex)',
    'if (false && playerIndex !== state.turnPlayerIndex)',
    'non-turn player activates a Set card outside a window',
  ],
  [
    ACT,
    "if (playerIndex !== state.turnPlayerIndex)\n      fail('NOT_TURN_PLAYER', 'a card in the hand",
    "if (false)\n      fail('NOT_TURN_PLAYER', 'a card in the hand",
    "hand Quick-Play on the opponent's turn",
  ],
  [
    ACT,
    "if (definition.subType === 'Normal' && state.phase !== 'Main1'",
    "if (false && state.phase !== 'Main1'",
    'Normal Spell from hand in any phase',
  ],
  [
    ACT,
    "if (definition.subType === 'Normal' && state.phase !== 'Main1'",
    "if (state.phase !== 'Main1'",
    'Quick-Play from hand limited to Main Phase (3.3 behaviour)',
  ],
  [
    ACT,
    "if (card.position !== 'DefenseDown')\n      fail('NOT_ACTIVATABLE'",
    "if (false)\n      fail('NOT_ACTIVATABLE'",
    'face-up card on the chain activated again',
  ],
  [
    ACT,
    "? definition.subType === 'Continuous'\n          ? null\n          : 'Quick'",
    "? definition.subType === 'Continuous'\n          ? 'Quick'\n          : 'Quick'",
    'Continuous Trap activatable',
  ],
  [
    ACT,
    ': null;\n  }\n  if (trigger === null)',
    ": definition.subType === 'Normal' ? 'Ignition' : null;\n  }\n  if (trigger === null)",
    'Set Normal Spell activatable from the field',
  ],
  [
    ACT,
    ": 'Quick'\n        : definition.subType === 'QuickPlay'\n          ? 'Quick'\n          : null;\n  }",
    ": 'Quick'\n        : null;\n  }",
    'Set Quick-Play not activatable',
  ],
  [
    ACT,
    'card.setTurn === state.turnCount)',
    'card.setTurn === state.turnCount - 1)',
    'Set-turn check off by one',
  ],
  [
    ACT,
    "definition.kind === 'Trap' && state.ruleset.trapSetTurnDelay",
    "definition.kind === 'Trap'",
    'trapSetTurnDelay ignored',
  ],
  [
    ACT,
    "if (definition.kind === 'Spell')\n      fail('SPELL_SET_THIS_TURN'",
    "if (false)\n      fail('SPELL_SET_THIS_TURN'",
    'Set Quick-Play activatable the turn it was Set',
  ],
  [
    ACT,
    "if (definition.kind === 'Spell')\n      fail('SPELL_SET_THIS_TURN'",
    "if (definition.kind === 'Spell' && state.ruleset.trapSetTurnDelay)\n      fail('SPELL_SET_THIS_TURN'",
    'Set Quick-Play delay follows trapSetTurnDelay',
  ],
  [
    ACT,
    'spellSpeed < top.spellSpeed)',
    'spellSpeed <= top.spellSpeed)',
    'equal speed may not respond (Counter vs Counter)',
  ],
  [ACT, 'spellSpeed < top.spellSpeed)', 'false)', 'lower speed may respond to higher'],
  [
    ACT,
    "i === source.zoneIndex ? { ...card, position: 'Attack' } : slot",
    'i === source.zoneIndex ? { ...card } : slot',
    'activated Set card stays face-down',
  ],
  [
    ACT,
    "i === source.zoneIndex ? { ...card, position: 'Attack' } : slot",
    'i === source.zoneIndex ? null : slot',
    'activated Set card leaves its zone',
  ],
  [
    ACT,
    '    source,\n    effectId: effect.id,',
    "    source: { zone: 'Hand' as const },\n    effectId: effect.id,",
    'link records the hand as source',
  ],
  [
    ACT,
    'const onField = player.board.spellTrapZones[zoneIndex];',
    'const onField = undefined as CardInstance | undefined;',
    'Set cards are never found',
  ],

  // effects/chain.ts — the Set card leaves its zone after its link
  [
    CHAIN,
    '    if (inZone?.instanceId !== card.instanceId) return { state, events: [] };\n',
    '',
    'destroyed Set card sent to the graveyard again',
  ],
  [
    CHAIN,
    '          i === source.zoneIndex ? null : slot,',
    '          slot,',
    'zone not cleared after resolution',
  ],
  [
    CHAIN,
    '        from: source.zone,',
    "        from: 'Hand' as const,",
    "graveyard event says 'Hand'",
  ],

  // effects/activation-candidates.ts
  [
    CAND,
    'for (const source of [...me.hand, ...backrow])',
    'for (const source of [...me.hand])',
    'Set cards never listed / never keep a window open',
  ],

  // packages/shared — schema
  [
    SHARED + 'effects/effect-definition.ts',
    'z.literal(3)]).optional()',
    'z.literal(4)]).optional()',
    'schema rejects spellSpeed 3',
  ],
];

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
  const cmd = file.startsWith(SHARED)
    ? `pnpm --filter @yugi/shared exec vitest run ${sharedTests}`
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
