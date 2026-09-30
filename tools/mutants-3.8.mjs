// Manual mutation testing for task 3.8 (the first real effect cards in SAMPLE_CARDS).
// Usage: node tools/mutants-3.8.mjs   (from the repo root)
// The engine is not touched by 3.8, so the mutants edit the CARD DATA: each one changes one field of one card,
// rebuilds the shared package (the engine tests import its dist) and expects the per-card tests
// (packages/game-engine/src/cards/sample) or the shared deck/card tests to FAIL (= mutant killed).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const CARDS = 'packages/shared/src/cards/sample-cards.ts';
const DECK = 'packages/shared/src/deck/effect-demo-deck.ts';

const mutants = [
  // SMP-019 Firebrand Hornet
  [
    CARDS,
    "trigger: { kind: 'OnSummon', mandatory: true },",
    "trigger: { kind: 'OnSummon' },",
    'SMP-019 becomes optional',
  ],
  [
    CARDS,
    "{ kind: 'Damage', amount: 300, target: 'opponent' }",
    "{ kind: 'Damage', amount: 400, target: 'opponent' }",
    'SMP-019 burns 400',
  ],
  [
    CARDS,
    "{ kind: 'Damage', amount: 300, target: 'opponent' }",
    "{ kind: 'Damage', amount: 300, target: 'self' }",
    'SMP-019 burns its controller',
  ],
  // SMP-020 Snarewood Tracker
  [
    CARDS,
    "        trigger: { kind: 'OnSummon' },\n        target: { kind: 'Card', zone: 'SpellTrapZone'",
    "        trigger: { kind: 'OnSummon', mandatory: true },\n        target: { kind: 'Card', zone: 'SpellTrapZone'",
    'SMP-020 becomes mandatory',
  ],
  [
    CARDS,
    "target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },",
    "target: { kind: 'Card', zone: 'SpellTrapZone', side: 'self', count: 1 },",
    'SMP-020 targets its own backrow',
  ],
  [
    CARDS,
    "target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },",
    "target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },",
    'SMP-020 targets monsters',
  ],
  // SMP-021 Ashen Moth
  [
    CARDS,
    "trigger: { kind: 'OnDestroyed', mandatory: true },",
    "trigger: { kind: 'OnSummon', mandatory: true },",
    'SMP-021 fires on Summon instead',
  ],
  [
    CARDS,
    "trigger: { kind: 'OnDestroyed', mandatory: true },",
    "trigger: { kind: 'OnDestroyed' },",
    'SMP-021 becomes optional',
  ],
  [
    CARDS,
    "{ kind: 'Draw', count: 1, target: 'self' }],\n      },\n    ],\n  },\n  {\n    id: 'SMP-022'",
    "{ kind: 'Draw', count: 1, target: 'opponent' }],\n      },\n    ],\n  },\n  {\n    id: 'SMP-022'",
    'SMP-021 draws for the other player',
  ],
  // SMP-022 Banner Captain
  [
    CARDS,
    "{ kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self', excludeSource: true },",
    "{ kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self' },",
    'SMP-022 buffs itself too',
  ],
  [
    CARDS,
    "{ kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self', excludeSource: true },",
    "{ kind: 'ModifyStat', stat: 'def', amount: 300, side: 'self', excludeSource: true },",
    'SMP-022 buffs DEF',
  ],
  [
    CARDS,
    "{ kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self', excludeSource: true },",
    "{ kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'opponent', excludeSource: true },",
    'SMP-022 buffs the opponent',
  ],
  // SMP-023 Bog Wraith
  [
    CARDS,
    "amount: -300, side: 'opponent' }",
    "amount: -200, side: 'opponent' }",
    'SMP-023 saps 200',
  ],
  [
    CARDS,
    "amount: -300, side: 'opponent' }",
    "amount: -300, side: 'self' }",
    'SMP-023 saps its own side',
  ],
  // SMP-102 Flash Arrow
  [CARDS, "    subType: 'QuickPlay',", "    subType: 'Normal',", 'SMP-102 is a Normal Spell'],
  [
    CARDS,
    "{ kind: 'Damage', amount: 500, target: 'opponent' }",
    "{ kind: 'Damage', amount: 500, target: 'self' }",
    'SMP-102 burns its controller',
  ],
  // SMP-103 Warm Spring
  [
    CARDS,
    "{ kind: 'Heal', amount: 1000, target: 'self' }",
    "{ kind: 'Heal', amount: 1000, target: 'opponent' }",
    'SMP-103 heals the opponent',
  ],
  [
    CARDS,
    "        id: 'heal',\n        trigger: { kind: 'Ignition' },",
    "        id: 'heal',\n        trigger: { kind: 'Quick' },",
    'SMP-103 has a Quick trigger',
  ],
  // SMP-104 Battlefield Cache
  [CARDS, "        cost: [{ kind: 'Discard', count: 1 }],\n", '', 'SMP-104 costs nothing'],
  [
    CARDS,
    "{ kind: 'Draw', count: 2, target: 'self' }",
    "{ kind: 'Draw', count: 1, target: 'self' }",
    'SMP-104 draws 1',
  ],
  // SMP-202 Sudden Sinkhole
  [
    CARDS,
    "target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },",
    "target: { kind: 'Card', zone: 'MonsterZone', side: 'self', count: 1 },",
    'SMP-202 targets own monsters',
  ],
  [
    CARDS,
    "    name: { vi: 'Hố Sụt Bất Ngờ', en: 'Sudden Sinkhole' },\n    subType: 'Normal',",
    "    name: { vi: 'Hố Sụt Bất Ngờ', en: 'Sudden Sinkhole' },\n    subType: 'Counter',",
    'SMP-202 is a Counter Trap',
  ],
  // SMP-203 Counterspark
  [
    CARDS,
    "{ kind: 'Damage', amount: 800, target: 'opponent' }",
    "{ kind: 'Damage', amount: 700, target: 'opponent' }",
    'SMP-203 burns 700',
  ],
  // EFFECT_DEMO_DECK
  [DECK, "  'SMP-017',\n", "  'SMP-017',\n  'SMP-017',\n", 'deck of 41 cards'],
  [
    DECK,
    "'SMP-202', 'SMP-203'].flatMap(x3)",
    "'SMP-202'].flatMap(x3)",
    'deck without Counterspark',
  ],
];

const results = [];
const build = () => execSync('pnpm --filter @yugi/shared build', { stdio: 'pipe' });
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
  try {
    execSync('pnpm --filter @yugi/shared exec vitest run', { stdio: 'pipe' });
    build();
    execSync('pnpm --filter @yugi/game-engine exec vitest run src/cards/sample', { stdio: 'pipe' });
  } catch {
    killed = true;
  } finally {
    writeFileSync(file, original);
  }
  results.push(`${killed ? 'KILLED  ' : 'SURVIVED'} ${name}`);
  console.log(results.at(-1));
}
build();
const survived = results.filter((r) => r.startsWith('SURVIVED') || r.startsWith('MISSING')).length;
console.log(`\n${results.length - survived}/${results.length} mutants killed`);
process.exitCode = survived === 0 ? 0 : 1;
