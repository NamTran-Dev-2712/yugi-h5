// Manual mutation testing for task 4.7 (card batch 2: 26 cards in SAMPLE_CARDS, data only — the engine is untouched).
// Usage: node tools/mutants-4.7.mjs            (from the repo root; ~10 minutes)
//        node tools/mutants-4.7.mjs SMP-054    (only the mutants of one card; `deck` = the deck mutants)
// Each mutant changes ONE field of ONE card (an amount, a filter, a side, a cost, a trigger, `mandatory`, a sub type…),
// rebuilds the shared package (the engine tests import its dist) and must be KILLED BY BEHAVIOUR: the card's own
// engine test file (packages/game-engine/src/cards/sample/<id>.test.ts) has to fail. The shared test
// `cards/batch2.test.ts` pins the exact data of every card, so it would kill every mutant by itself — it is reported
// in a second column, never counted. A mutant that does not compile is reported as INVALID (and makes the run fail):
// "killed by tsc" is not a kill.
// A pattern is searched inside the card's own block only and must occur exactly once there.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const CARDS = 'packages/shared/src/cards/sample-cards.ts';
const DECK = 'packages/shared/src/deck/batch2-demo-deck.ts';

/** [card id, from, to, what the mutant does] */
const cardMutants = [
  // --- Effect Monsters ---
  ['SMP-048', 'amount: 500', 'amount: 400', 'heals 400'],
  ['SMP-048', ', mandatory: true }', ' }', 'becomes optional'],
  ['SMP-048', "target: 'self'", "target: 'opponent'", 'heals the opponent'],
  ['SMP-049', 'amount: 800', 'amount: 500', 'pays 500'],
  ['SMP-049', "        cost: [{ kind: 'PayLP', amount: 800 }],\n", '', 'costs nothing'],
  ['SMP-049', 'level: { max: 4 }', 'level: { max: 5 }', 'hits Level 5'],
  [
    'SMP-049',
    '          filter: { level: { max: 4 } },\n',
    '',
    'no filter (face-down / any Level)',
  ],
  ['SMP-049', "side: 'opponent'", "side: 'self'", 'targets my own monster'],
  [
    'SMP-049',
    "trigger: { kind: 'OnSummon' }",
    "trigger: { kind: 'OnSummon', mandatory: true }",
    'becomes mandatory',
  ],
  ['SMP-050', 'level: { max: 3 }', 'level: { max: 4 }', 'calls a Level 4'],
  [
    'SMP-050',
    "{ kind: 'SpecialSummon', position: 'DefenseUp' }",
    "{ kind: 'SpecialSummon' }",
    'arrives in Attack',
  ],
  ['SMP-050', "zone: 'Hand'", "zone: 'Graveyard'", 'calls from the graveyard'],
  ['SMP-051', 'count: 1', 'count: 2', 'draws 2'],
  ['SMP-051', ', mandatory: true }', ' }', 'becomes optional'],
  ['SMP-051', "kind: 'OnFlip'", "kind: 'OnSummon'", 'triggers on Summon'],
  ['SMP-051', "target: 'self'", "target: 'opponent'", 'the opponent draws'],
  ['SMP-052', "zone: 'SpellTrapZone'", "zone: 'MonsterZone'", 'targets a monster'],
  ['SMP-052', "side: 'opponent'", "side: 'self'", 'targets my own backrow'],
  [
    'SMP-052',
    "trigger: { kind: 'OnFlip' }",
    "trigger: { kind: 'OnFlip', mandatory: true }",
    'becomes mandatory',
  ],
  [
    'SMP-052',
    "trigger: { kind: 'OnFlip' }",
    "trigger: { kind: 'OnDestroyed' }",
    'triggers when destroyed',
  ],
  ['SMP-053', 'amount: 600', 'amount: 500', 'burns 500'],
  ['SMP-053', "target: 'opponent'", "target: 'self'", 'burns its controller'],
  ['SMP-053', "kind: 'OnFlip'", "kind: 'OnSummon'", 'triggers on Summon'],
  ['SMP-054', 'level: { max: 4 }', 'level: { max: 5 }', 'may bring ITSELF back (loop)'],
  [
    'SMP-054',
    "{ kind: 'SpecialSummon', position: 'DefenseUp' }",
    "{ kind: 'SpecialSummon' }",
    'returns in Attack',
  ],
  ['SMP-054', "zone: 'Graveyard'", "zone: 'Hand'", 'calls from the hand'],
  [
    'SMP-054',
    "trigger: { kind: 'OnDestroyed' }",
    "trigger: { kind: 'OnSummon' }",
    'triggers on Summon',
  ],
  ['SMP-054', 'atk: 2000', 'atk: 2800', 'survives the battle of its test'],
  ['SMP-055', 'amount: 500', 'amount: 600', 'burns 600'],
  ['SMP-055', "target: 'opponent'", "target: 'self'", 'burns its owner'],
  ['SMP-055', ', mandatory: true }', ' }', 'becomes optional'],
  ['SMP-056', 'amount: 500', 'amount: 300', 'pays 300'],
  ['SMP-056', "        cost: [{ kind: 'PayLP', amount: 500 }],\n", '', 'costs nothing'],
  ['SMP-056', 'count: 1', 'count: 2', 'draws 2'],
  ['SMP-056', "target: 'self'", "target: 'opponent'", 'the opponent draws'],
  [
    'SMP-056',
    "trigger: { kind: 'OnDestroyed' }",
    "trigger: { kind: 'OnDestroyed', mandatory: true }",
    'becomes mandatory',
  ],
  ['SMP-057', 'amount: 200', 'amount: 300', '+300 ATK'],
  ['SMP-057', '            excludeSource: true,\n', '', 'boosts itself too'],
  ['SMP-057', "filter: { race: 'Beast' }", "filter: { race: 'Warrior' }", 'boosts Warriors'],
  ['SMP-057', "            filter: { race: 'Beast' },\n", '', 'boosts every monster'],
  ['SMP-057', "side: 'self'", "side: 'opponent'", "boosts the opponent's Beasts"],
  ['SMP-058', 'amount: -400', 'amount: -300', '−300 ATK'],
  ['SMP-058', "attribute: 'LIGHT' }", "attribute: 'EARTH' }", 'weakens EARTH monsters'],
  ['SMP-058', "side: 'opponent'", "side: 'self'", 'weakens my own LIGHT monsters'],
  [
    'SMP-058',
    "            filter: { attribute: 'LIGHT' },\n",
    '',
    'weakens every opponent monster',
  ],
  ['SMP-059', "stat: 'def'", "stat: 'atk'", 'boosts ATK instead of DEF'],
  ['SMP-059', 'amount: 400', 'amount: 300', '+300 DEF'],
  ['SMP-059', "filter: { race: 'Rock' }", "filter: { race: 'Warrior' }", 'boosts Warriors'],
  ['SMP-059', "side: 'self'", "side: 'opponent'", "boosts the opponent's Rocks"],
  // --- Fusion Monsters ---
  [
    'SMP-060',
    "fusionMaterials: ['SMP-057', 'SMP-050']",
    "fusionMaterials: ['SMP-057', 'SMP-005']",
    'other material',
  ],
  ['SMP-060', 'atk: 2400', 'atk: 2300', 'ATK 2300'],
  ['SMP-061', 'amount: -200', 'amount: -300', '−300 ATK'],
  ['SMP-061', "side: 'opponent'", "side: 'self'", 'weakens my own monsters'],
  [
    'SMP-061',
    "fusionMaterials: ['SMP-058', 'SMP-054']",
    "fusionMaterials: ['SMP-058', 'SMP-057']",
    'other material',
  ],
  // --- Spells ---
  ['SMP-117', "        cost: [{ kind: 'Discard', count: 1 }],\n", '', 'costs nothing'],
  ['SMP-117', 'level: { max: 4 }', 'level: { max: 5 }', 'hits Level 5'],
  ['SMP-117', '          filter: { level: { max: 4 } },\n', '', 'no filter'],
  ['SMP-117', "subType: 'Normal'", "subType: 'QuickPlay'", 'declared a Quick-Play Spell'],
  ['SMP-118', "        cost: [{ kind: 'Tribute', count: 1 }],\n", '', 'costs nothing'],
  ['SMP-118', 'count: 2', 'count: 3', 'draws 3'],
  [
    'SMP-118',
    "{ kind: 'Tribute', count: 1 }",
    "{ kind: 'Discard', count: 1 }",
    'discards instead of Tributing',
  ],
  ['SMP-119', "subType: 'QuickPlay'", "subType: 'Normal'", 'declared a Normal Spell'],
  ['SMP-119', "side: 'opponent'", "side: 'self'", 'targets my own backrow'],
  ['SMP-119', "zone: 'SpellTrapZone'", "zone: 'MonsterZone'", 'targets a monster'],
  ['SMP-120', 'level: { max: 4 }', 'level: { max: 5 }', 'ambushes with a Level 5'],
  [
    'SMP-120',
    "{ kind: 'SpecialSummon', position: 'DefenseUp' }",
    "{ kind: 'SpecialSummon' }",
    'arrives in Attack',
  ],
  ['SMP-120', "zone: 'Hand'", "zone: 'Graveyard'", 'calls from the graveyard'],
  ['SMP-121', "stat: 'atk', amount: 300", "stat: 'atk', amount: 400", '+400 ATK'],
  ['SMP-121', "stat: 'def', amount: 700", "stat: 'def', amount: 600", '+600 DEF'],
  ['SMP-121', "side: 'self'", "side: 'opponent'", "equips to the opponent's monster"],
  ['SMP-122', "side: 'opponent'", "side: 'self'", 'equips to my own monster'],
  ['SMP-122', 'amount: -600', 'amount: -500', '−500 ATK'],
  ['SMP-122', "stat: 'atk'", "stat: 'def'", 'lowers DEF instead of ATK'],
  [
    'SMP-123',
    "{ kind: 'Heal', amount: 500, target: 'self' }",
    "{ kind: 'Heal', amount: 600, target: 'self' }",
    'heals 600',
  ],
  [
    'SMP-123',
    "operations: [{ kind: 'Heal', amount: 500, target: 'self' }]",
    'operations: []',
    'no heal on activation',
  ],
  ['SMP-123', "attribute: 'DARK' }", "attribute: 'EARTH' }", 'boosts EARTH monsters'],
  ['SMP-123', 'amount: 300', 'amount: 200', '+200 ATK'],
  [
    'SMP-123',
    "            side: 'self',\n",
    "            side: 'opponent',\n",
    "boosts the opponent's DARK monsters",
  ],
  ['SMP-124', 'amount: 200', 'amount: 300', '+300 / +300'],
  ['SMP-124', "attribute: 'EARTH' as const", "attribute: 'WIND' as const", 'boosts WIND monsters'],
  ['SMP-124', "(['self', 'opponent'] as const)", "(['self'] as const)", 'boosts my side only'],
  ['SMP-124', "(['atk', 'def'] as const)", "(['atk'] as const)", 'no DEF bonus'],
  // --- Traps ---
  ['SMP-211', "        cost: [{ kind: 'Discard', count: 1 }],\n", '', 'costs nothing'],
  [
    'SMP-211',
    "{ kind: 'SpecialSummon', position: 'DefenseUp' }",
    "{ kind: 'SpecialSummon' }",
    'returns in Attack',
  ],
  ['SMP-211', "zone: 'Graveyard'", "zone: 'Hand'", 'calls from the hand'],
  ['SMP-212', "cardKinds: ['Monster']", "cardKinds: ['Spell']", 'negates Spells instead'],
  [
    'SMP-212',
    "{ kind: 'NegateActivation', cardKinds: ['Monster'] }",
    "{ kind: 'NegateActivation' }",
    'negates any activation',
  ],
  ['SMP-212', "subType: 'Normal'", "subType: 'Counter'", 'declared a Counter Trap (Spell Speed 3)'],
  ['SMP-213', 'amount: 400', 'amount: 300', '+300 DEF'],
  ['SMP-213', "side: 'self'", "side: 'opponent'", "boosts the opponent's monsters"],
  ['SMP-213', "stat: 'def'", "stat: 'atk'", 'boosts ATK instead of DEF'],
  ['SMP-214', "cardKinds: ['Spell']", "cardKinds: ['Spell', 'Trap']", 'also negates Traps'],
  ['SMP-214', "cardKinds: ['Spell']", "cardKinds: ['Monster']", 'negates monster effects instead'],
  ['SMP-214', "        cost: [{ kind: 'Discard', count: 1 }],\n", '', 'costs nothing'],
  [
    'SMP-214',
    "subType: 'Counter'",
    "subType: 'Normal'",
    'declared a Normal Trap (Spell Speed 2, may start a chain)',
  ],
];

/** Deck mutants: only the shared deck test can see them. [from, to, what] */
const deckMutants = [
  ["  ...x2('SMP-116'),\n", '', 'deck without the fusion Spell'],
  [
    "...['SMP-054', 'SMP-049'].flatMap(x2)",
    "...['SMP-049', 'SMP-049'].flatMap(x2)",
    'deck without SMP-054',
  ],
  ["...x2('SMP-061')]", "...x2('SMP-045')]", "Extra Deck with another task's Fusion Monster"],
];

const only = process.argv[2];
const sh = (cmd) => execSync(cmd, { stdio: 'pipe' });
const fails = (cmd) => {
  try {
    sh(cmd);
    return false;
  } catch {
    return true;
  }
};
const buildShared = () => sh('pnpm --filter @yugi/shared build');

/** Start / end offsets of one card's object literal in the (LF-normalised) source. */
function blockOf(source, id) {
  const start = source.indexOf(`    id: '${id}',`);
  if (start === -1) return null;
  const next = source.indexOf("\n  {\n    id: 'SMP-", start);
  return [start, next === -1 ? source.length : next];
}

const results = [];
const original = readFileSync(CARDS, 'utf8');
const source = original.replace(/\r\n/g, '\n');
for (const [id, from, to, what] of cardMutants) {
  if (only && only !== id) continue;
  const name = `${id} ${what}`;
  const block = blockOf(source, id);
  const body = block ? source.slice(block[0], block[1]) : '';
  const hits = body.split(from).length - 1;
  if (hits !== 1) {
    results.push(`BADPATTERN            ${name}  (${hits} matches in the block of ${id})`);
    console.log(results.at(-1));
    continue;
  }
  writeFileSync(
    CARDS,
    source.slice(0, block[0]) + body.replace(from, () => to) + source.slice(block[1]),
  );
  let verdict;
  try {
    let compiled = true;
    try {
      buildShared();
    } catch {
      compiled = false;
    }
    if (!compiled) {
      verdict = 'INVALID (tsc)        ';
    } else {
      const file = `src/cards/sample/${id.toLowerCase()}.test.ts`;
      const engine = fails(`pnpm --filter @yugi/game-engine exec vitest run ${file}`);
      const shared = fails('pnpm --filter @yugi/shared exec vitest run src/cards/batch2.test.ts');
      verdict = `${engine ? 'KILLED  ' : 'SURVIVED'} (data pin: ${shared ? 'red' : 'GREEN'})`;
    }
  } finally {
    writeFileSync(CARDS, original);
  }
  results.push(`${verdict} ${name}`);
  console.log(results.at(-1));
}

if (!only || only === 'deck') {
  const deckOriginal = readFileSync(DECK, 'utf8');
  const deckSource = deckOriginal.replace(/\r\n/g, '\n');
  for (const [from, to, what] of deckMutants) {
    const hits = deckSource.split(from).length - 1;
    if (hits !== 1) {
      results.push(`BADPATTERN            ${what}  (${hits} matches in ${DECK})`);
      console.log(results.at(-1));
      continue;
    }
    writeFileSync(
      DECK,
      deckSource.replace(from, () => to),
    );
    let killed;
    try {
      killed = fails(
        'pnpm --filter @yugi/shared exec vitest run src/deck/batch2-demo-deck.test.ts',
      );
    } finally {
      writeFileSync(DECK, deckOriginal);
    }
    results.push(`${killed ? 'KILLED  ' : 'SURVIVED'} (deck test)        ${what}`);
    console.log(results.at(-1));
  }
}

buildShared();
const bad = results.filter((r) => !r.startsWith('KILLED')).length;
const unpinned = results.filter((r) => r.includes('data pin: GREEN')).length;
console.log(`\n${results.length - bad}/${results.length} mutants killed by behaviour tests`);
console.log(`${unpinned} card mutant(s) NOT seen by the shared data pin (cards/batch2.test.ts)`);
process.exitCode = bad === 0 && unpinned === 0 ? 0 : 1;
