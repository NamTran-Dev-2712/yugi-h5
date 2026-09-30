// Manual mutation testing for task 4.1 (card batch 1: 20 vanilla + 10 basic Spells/Traps in SAMPLE_CARDS).
// Usage: node tools/mutants-4.1.mjs   (from the repo root)
// The engine is not touched by 4.1, so the mutants edit the CARD DATA: each one changes one field of one card,
// rebuilds the shared package (the engine tests import its dist) and expects the per-card tests
// (packages/game-engine/src/cards/sample) or the shared batch/deck tests to FAIL (= mutant killed).
// Every pattern must occur exactly once in its file (checked below), so a mutant never hits the wrong card.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const CARDS = 'packages/shared/src/cards/sample-cards.ts';
const DECK = 'packages/shared/src/deck/batch1-demo-deck.ts';

const mutants = [
  // Vanilla (Tier A)
  [
    CARDS,
    "'Bronze Shell Beetle', 'EARTH', 'Insect', 1, 300, 1100]",
    "'Bronze Shell Beetle', 'EARTH', 'Insect', 1, 400, 1100]",
    'SMP-024 ATK 400',
  ],
  [
    CARDS,
    "'Tempest Roc', 'WIND', 'Winged Beast', 6, 2300, 1400]",
    "'Tempest Roc', 'WIND', 'Winged Beast', 4, 2300, 1400]",
    'SMP-036 becomes Level 4',
  ],
  [
    CARDS,
    "'Ancient Stone Titan', 'EARTH', 'Rock', 8, 2600, 2800]",
    "'Ancient Stone Titan', 'EARTH', 'Rock', 8, 2600, 2700]",
    'SMP-041 DEF 2700',
  ],
  [
    CARDS,
    "'Mistveil Seer', 'WATER', 'Psychic'",
    "'Mistveil Seer', 'FIRE', 'Psychic'",
    'SMP-032 FIRE (only 2 WATER left)',
  ],
  [
    CARDS,
    "'Silverwind Drake', 'WIND', 'Dragon', 8",
    "'Silverwind Drake', 'WIND', 'Dragon', 7",
    'SMP-040 Level 7 (only one Level 8 left)',
  ],
  // SMP-105 Canopy Gale
  [
    CARDS,
    "        id: 'gale-sweep',\n        trigger: { kind: 'Ignition' },\n        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent'",
    "        id: 'gale-sweep',\n        trigger: { kind: 'Ignition' },\n        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'self'",
    'SMP-105 targets own backrow',
  ],
  [
    CARDS,
    "        id: 'gale-sweep',\n        trigger: { kind: 'Ignition' },\n        target: { kind: 'Card', zone: 'SpellTrapZone'",
    "        id: 'gale-sweep',\n        trigger: { kind: 'Ignition' },\n        target: { kind: 'Card', zone: 'MonsterZone'",
    'SMP-105 targets monsters',
  ],
  // SMP-106 Toll of the Blade
  [
    CARDS,
    "cost: [{ kind: 'PayLP', amount: 1000 }],",
    "cost: [{ kind: 'PayLP', amount: 800 }],",
    'SMP-106 pays 800',
  ],
  [CARDS, "cost: [{ kind: 'PayLP', amount: 1000 }],\n", '', 'SMP-106 costs nothing'],
  [
    CARDS,
    "        cost: [{ kind: 'PayLP', amount: 1000 }],\n        target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent'",
    "        cost: [{ kind: 'PayLP', amount: 1000 }],\n        target: { kind: 'Card', zone: 'MonsterZone', side: 'self'",
    'SMP-106 targets own monster',
  ],
  // SMP-107 Desperate Muster
  [
    CARDS,
    "{ kind: 'ZoneCount', zone: 'MonsterZone', side: 'self', max: 0 },\n",
    '',
    'SMP-107 without "I control no monster"',
  ],
  [
    CARDS,
    "{ kind: 'ZoneCount', zone: 'MonsterZone', side: 'opponent', min: 1 },\n",
    '',
    'SMP-107 without "opponent has a monster"',
  ],
  [CARDS, "side: 'self', max: 0 }", "side: 'self', max: 1 }", 'SMP-107 allows 1 own monster'],
  // SMP-108 Giantfall
  [
    CARDS,
    'filter: { level: { min: 5 } },',
    'filter: { level: { min: 4 } },',
    'SMP-108 hits Level 4',
  ],
  [CARDS, '          filter: { level: { min: 5 } },\n', '', 'SMP-108 without filter'],
  // SMP-109 Sacrificial Bolt
  [CARDS, "cost: [{ kind: 'Tribute', count: 1 }],\n", '', 'SMP-109 costs nothing'],
  [
    CARDS,
    "operations: [{ kind: 'Damage', amount: 1000, target: 'opponent' }],\n      },\n    ],\n  },\n  {\n    id: 'SMP-110'",
    "operations: [{ kind: 'Damage', amount: 1200, target: 'opponent' }],\n      },\n    ],\n  },\n  {\n    id: 'SMP-110'",
    'SMP-109 burns 1200',
  ],
  // SMP-110 Lifespark Exchange
  [
    CARDS,
    "cost: [{ kind: 'Discard', count: 1, filter: { kind: 'Monster' } }],",
    "cost: [{ kind: 'Discard', count: 1 }],",
    'SMP-110 discard any card',
  ],
  [CARDS, "{ kind: 'Heal', amount: 600, target: 'self' },\n", '', 'SMP-110 without the heal'],
  [
    CARDS,
    "    name: { vi: 'Trao Đổi Sinh Lực', en: 'Lifespark Exchange' },\n    subType: 'QuickPlay',",
    "    name: { vi: 'Trao Đổi Sinh Lực', en: 'Lifespark Exchange' },\n    subType: 'Normal',",
    'SMP-110 becomes a Normal Spell',
  ],
  // SMP-204 Tollgate Snare
  [CARDS, "cost: [{ kind: 'PayLP', amount: 500 }],\n", '', 'SMP-204 costs nothing'],
  [
    CARDS,
    "        cost: [{ kind: 'PayLP', amount: 500 }],\n        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent'",
    "        cost: [{ kind: 'PayLP', amount: 500 }],\n        target: { kind: 'Card', zone: 'SpellTrapZone', side: 'self'",
    'SMP-204 targets own backrow',
  ],
  // SMP-205 Second Wind
  [
    CARDS,
    "{ kind: 'Heal', amount: 1000, target: 'self' },\n          { kind: 'Draw', count: 1, target: 'self' },",
    "{ kind: 'Draw', count: 1, target: 'self' },\n          { kind: 'Heal', amount: 1000, target: 'self' },",
    'SMP-205 draws before healing',
  ],
  [
    CARDS,
    "{ kind: 'Heal', amount: 1000, target: 'self' },\n          { kind: 'Draw', count: 1, target: 'self' },",
    "{ kind: 'Heal', amount: 1000, target: 'self' },\n          { kind: 'Draw', count: 2, target: 'self' },",
    'SMP-205 draws 2',
  ],
  // SMP-206 Battle Flare
  [CARDS, "condition: [{ kind: 'PhaseIs', phase: 'Battle' }],\n", '', 'SMP-206 any phase'],
  [
    CARDS,
    "        condition: [{ kind: 'PhaseIs', phase: 'Battle' }],\n        operations: [{ kind: 'Damage', amount: 1000, target: 'opponent' }],",
    "        condition: [{ kind: 'PhaseIs', phase: 'Battle' }],\n        operations: [{ kind: 'Damage', amount: 1000, target: 'self' }],",
    'SMP-206 burns its controller',
  ],
  // SMP-207 Last Reserve
  [
    CARDS,
    "condition: [{ kind: 'ZoneCount', zone: 'Hand', side: 'self', max: 2 }],",
    "condition: [{ kind: 'ZoneCount', zone: 'Hand', side: 'self', max: 3 }],",
    'SMP-207 allows 3 cards',
  ],
  [
    CARDS,
    "condition: [{ kind: 'ZoneCount', zone: 'Hand', side: 'self', max: 2 }],\n",
    '',
    'SMP-207 without condition',
  ],
  [
    CARDS,
    "    name: { vi: 'Kho Dự Trữ Cuối', en: 'Last Reserve' },\n    subType: 'Normal',",
    "    name: { vi: 'Kho Dự Trữ Cuối', en: 'Last Reserve' },\n    subType: 'Continuous',",
    'SMP-207 becomes a Continuous Trap',
  ],
  // BATCH1_DEMO_DECK
  [
    DECK,
    "'SMP-206', 'SMP-207'].flatMap(x2)",
    "'SMP-206'].flatMap(x2)",
    'deck without Last Reserve',
  ],
  [
    DECK,
    "'SMP-034', 'SMP-036'].flatMap(x2)",
    "'SMP-034', 'SMP-018'].flatMap(x2)",
    'deck with a non-batch-1 card',
  ],
];

const results = [];
const build = () => execSync('pnpm --filter @yugi/shared build', { stdio: 'pipe' });
for (const [file, from, to, name] of mutants) {
  const original = readFileSync(file, 'utf8');
  const normalised = original.replace(/\r\n/g, '\n');
  const hits = normalised.split(from).length - 1;
  if (hits !== 1) {
    results.push(`BADPATTERN ${name}  (${hits} matches in ${file})`);
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
const bad = results.filter((r) => !r.startsWith('KILLED')).length;
console.log(`\n${results.length - bad}/${results.length} mutants killed`);
process.exitCode = bad === 0 ? 0 : 1;
