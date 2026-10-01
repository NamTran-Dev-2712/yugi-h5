// Manual mutation testing for task 4.3 (Field Spell, activating Continuous Spell/Trap cards, Set Normal Spells).
// Usage: node tools/mutants-4.3.mjs   (from the repo root)
// Each mutant edits one source snippet, runs the relevant tests and expects a FAILURE (= mutant killed).
// Mutants tagged 'shared' run the shared schema/card tests; the others run the engine tests + tsc.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const engineTests =
  'src/rules src/actions src/effects src/cards src/legal-actions.spells.test.ts src/testing/golden src/testing/fuzz';

const SET = ENGINE + 'actions/handlers/set-spell-trap.ts';
const ACTIVATE = ENGINE + 'actions/handlers/activate-effect.ts';
const CHAIN = ENGINE + 'effects/chain.ts';
const CONT = ENGINE + 'effects/continuous.ts';
const TARGETS = ENGINE + 'effects/targets.ts';
const DESTROY = ENGINE + 'effects/operations/destroy.ts';
const TRIGGERS = ENGINE + 'effects/triggers.ts';
const CANDIDATES = ENGINE + 'effects/activation-candidates.ts';
const FIELD_ZONE = ENGINE + 'state/field-zone.ts';
const EFFECT_DEF = 'packages/shared/src/effects/effect-definition.ts';
const CARD_DEF = 'packages/shared/src/cards/card-definition.ts';
const SAMPLE = 'packages/shared/src/cards/sample-cards.ts';

const mutants = [
  // actions/handlers/set-spell-trap.ts
  [
    SET,
    "    if (zoneIndex !== 0)\n      reject('INVALID_ZONE'",
    "    if (false)\n      reject('INVALID_ZONE'",
    'a Field Spell is Set with any zoneIndex',
  ],
  [
    SET,
    '    if (player.board.fieldZone !== null && !state.ruleset.fieldSpellReplace)\n      reject(',
    '    if (false)\n      reject(',
    'Set ignores fieldSpellReplace: false',
  ],
  [
    SET,
    '    const cleared = clearFieldZone(state, playerIndex);',
    '    const cleared = { state, events: [] as GameEvent[] };',
    'Set overwrites the old Field Spell (it vanishes)',
  ],
  [
    SET,
    "                position: 'DefenseDown',\n                setTurn: state.turnCount,",
    "                position: 'Attack',\n                setTurn: state.turnCount,",
    'a Field Spell is Set face-up',
  ],
  [
    SET,
    "        { type: 'FieldSpellSet', playerIndex, instanceId: card.instanceId },",
    "        { type: 'SpellTrapSet', playerIndex, instanceId: card.instanceId, zoneIndex },",
    'Field Set reported as SpellTrapSet',
  ],
  [
    SET,
    '            hand: p.hand.filter((c) => c.instanceId !== cardInstanceId),\n            board: {',
    '            hand: p.hand,\n            board: {',
    'the Set Field Spell stays in the hand too (duplicated)',
  ],
  // actions/handlers/activate-effect.ts
  [
    ACTIVATE,
    "      definition.subType === 'Continuous' ||\n      definition.subType === 'Field';",
    "      definition.subType === 'Continuous';",
    'Field Spell not activatable from the hand',
  ],
  [
    ACTIVATE,
    "      definition.subType === 'Equip' ||\n      definition.subType === 'Continuous' ||\n      definition.subType === 'Field';",
    "      definition.subType === 'Equip' ||\n      definition.subType === 'Field';",
    'Continuous Spell not activatable from the hand',
  ],
  [
    ACTIVATE,
    "    if (definition.kind === 'Trap' || definition.subType === 'QuickPlay') {",
    "    if ((definition.kind === 'Trap' && definition.subType !== 'Continuous') || definition.subType === 'QuickPlay') {",
    'Set Continuous Trap not activatable as a Trap',
  ],
  [
    ACTIVATE,
    "      definition.subType === 'Normal' ||\n      definition.subType === 'Continuous' ||\n      definition.subType === 'Field'\n    ) {",
    "      definition.subType === 'Continuous' ||\n      definition.subType === 'Field'\n    ) {",
    'Set Normal Spell not activatable',
  ],
  [
    ACTIVATE,
    "      definition.subType === 'Continuous' ||\n      definition.subType === 'Field'\n    ) {",
    "      definition.subType === 'Continuous'\n    ) {",
    'Set Field Spell not activatable',
  ],
  [
    ACTIVATE,
    "      if (playerIndex !== state.turnPlayerIndex)\n        fail('NOT_TURN_PLAYER', 'a Set Spell may",
    "      if (false)\n        fail('NOT_TURN_PLAYER', 'a Set Spell may",
    'the non-turn player activates a Set Spell inside a window',
  ],
  [
    ACTIVATE,
    "      if (state.phase !== 'Main1' && state.phase !== 'Main2')\n        fail('WRONG_PHASE', `only allowed in a Main Phase (current phase: ${state.phase}).`);\n      trigger = 'Ignition';",
    "      trigger = 'Ignition';",
    'a Set Spell is activated in any phase',
  ],
  [
    ACTIVATE,
    "    if (definition.kind === 'Spell' && definition.subType === 'QuickPlay')\n      fail('SPELL_SET_THIS_TURN'",
    "    if (definition.kind === 'Spell')\n      fail('SPELL_SET_THIS_TURN'",
    'every Set Spell waits a turn (not only Quick-Play)',
  ],
  [
    ACTIVATE,
    "      if (board.fieldZone !== null && !state.ruleset.fieldSpellReplace)\n        fail('FIELD_ZONE_OCCUPIED'",
    "      if (false)\n        fail('FIELD_ZONE_OCCUPIED'",
    'activation ignores fieldSpellReplace: false',
  ],
  [
    ACTIVATE,
    "    } else if (definition.subType === 'Equip' || definition.subType === 'Continuous') {",
    "    } else if (definition.subType === 'Equip') {",
    'a Continuous Spell from the hand is never placed in a zone',
  ],
  [
    ACTIVATE,
    "      placement = { zone: 'FieldZone' };",
    '      placement = null;',
    'a Field Spell from the hand is never placed in the Field Zone',
  ],
  [
    ACTIVATE,
    '    current = cleared.state;\n    events.push(...cleared.events);',
    '    events.push(...cleared.events);',
    'replaced Field Spell announced but overwritten (vanishes)',
  ],
  [
    ACTIVATE,
    '    current = cleared.state;\n    events.push(...cleared.events);',
    '    current = cleared.state;',
    'replaced Field Spell sent without its event',
  ],
  [
    ACTIVATE,
    '  const source: ChainLinkSource = placement ?? prepared.source;',
    '  const source: ChainLinkSource = prepared.source;',
    'link says Hand while the card was placed on the field',
  ],
  [
    ACTIVATE,
    "    placement === null\n      ? { ...card, position: 'Attack' }",
    "    placement === null\n      ? { ...card, position: 'DefenseDown' }",
    'an activated Set card does not flip face-up',
  ],
  [
    ACTIVATE,
    "  return inFieldZone?.instanceId === instanceId\n    ? { card: inFieldZone, source: { zone: 'FieldZone' } }\n    : null;",
    "  return inFieldZone?.instanceId === 'never'\n    ? { card: inFieldZone, source: { zone: 'FieldZone' } }\n    : null;",
    'a card in the Field Zone is never found',
  ],
  // effects/chain.ts
  [
    CHAIN,
    '  if (definition && staysOnField(definition)) return { state, events: [] };\n',
    '',
    'Continuous Spell/Trap goes to the graveyard after resolving',
  ],
  // effects/continuous.ts
  [
    CONT,
    'for (const source of [...monsterZones, ...spellTrapZones, fieldZone]) {',
    'for (const source of [...monsterZones, ...spellTrapZones, fieldZone].slice(0, 10)) {',
    'a face-up Field Spell is not a Continuous source',
  ],
  // effects/targets.ts
  [
    '' + TARGETS,
    '            [...board.spellTrapZones, board.fieldZone];',
    '            [...board.spellTrapZones];',
    'the Field Zone card is not a Spell/Trap target',
  ],
  [
    TARGETS,
    '    if (fieldZone?.instanceId === instanceId)\n      return {',
    '    if (false && fieldZone?.instanceId === instanceId)\n      return {',
    'findOnField never finds the Field Zone card',
  ],
  // effects/operations/destroy.ts
  [
    DESTROY,
    '          ? { ...owner.board, fieldZone: null }',
    '          ? owner.board',
    'a destroyed Field Spell stays on the field (duplicated)',
  ],
  [
    DESTROY,
    "        ? { type: 'FieldSpellDestroyed', ...gone }",
    "        ? { type: 'SpellTrapDestroyed', ...gone, zoneIndex: 0 }",
    'Field destruction reported as SpellTrapDestroyed',
  ],
  // effects/triggers.ts
  [
    TRIGGERS,
    "      event.type === 'SpellTrapDestroyed' ||\n      event.type === 'FieldSpellDestroyed'\n    ) {",
    "      event.type === 'SpellTrapDestroyed'\n    ) {",
    'a destroyed Field Spell fires no OnDestroyed',
  ],
  // effects/activation-candidates.ts
  [
    CANDIDATES,
    '  const backrow = [...me.board.spellTrapZones, me.board.fieldZone].filter(',
    '  const backrow = [...me.board.spellTrapZones].filter(',
    'a Set Field Spell is never a legal activation',
  ],
  // state/field-zone.ts
  [
    FIELD_ZONE,
    '      i === old.ownerIndex\n        ? [',
    '      false\n        ? [',
    'a replaced Field Spell never reaches the graveyard',
  ],
  [
    FIELD_ZONE,
    "        from: 'FieldZone',",
    "        from: 'SpellTrapZone',",
    'replacement reported as coming from a Spell/Trap Zone',
  ],
  // packages/shared
  [
    EFFECT_DEF,
    "      e.trigger.kind === 'Ignition' ||\n      e.trigger.kind === 'Quick',",
    '      true,',
    'schema: any trigger may have no operations',
    'shared',
  ],
  [
    CARD_DEF,
    "      (staysOnField(card) && (card.effects ?? []).some((e) => e.trigger.kind === 'Continuous')),",
    '      staysOnField(card),',
    'schema: empty activation without a Continuous effect',
    'shared',
  ],
  [
    CARD_DEF,
    "      (staysOnField(card) && (card.effects ?? []).some((e) => e.trigger.kind === 'Continuous')),",
    "      (card.effects ?? []).some((e) => e.trigger.kind === 'Continuous'),",
    'schema: empty activation on a card that does not stay',
    'shared',
  ],
  [
    CARD_DEF,
    "      !(card.kind === 'Spell' && card.subType === 'Field') ||\n",
    '      true ||\n',
    'schema: Field Spell without a Continuous effect',
    'shared',
  ],
  [
    CARD_DEF,
    "      const activation = card.kind === 'Trap' ? 'Quick' : 'Ignition';",
    "      const activation = 'Ignition';",
    'schema: a Continuous Trap needs an Ignition effect',
    'shared',
  ],
  [
    CARD_DEF,
    "      if (!effects.some((e) => e.trigger.kind === 'Continuous')) return true;",
    '      return true;',
    'schema: Continuous card without an activation effect',
    'shared',
  ],
  [
    CARD_DEF,
    "(card.subType === 'Continuous' || card.subType === 'Field')",
    "(card.subType === 'Continuous')",
    'staysOnField: a Field Spell does not stay',
    'shared',
  ],
  [
    CARD_DEF,
    "    (card.kind === 'Trap' && card.subType === 'Continuous')",
    '    false',
    'staysOnField: a Continuous Trap does not stay',
    'shared',
  ],
  // Anchored on the effect id: SMP-023 has the very same operation line earlier in the file.
  [
    SAMPLE,
    "id: 'mist-drain',\n        trigger: { kind: 'Continuous' },\n        operations: [{ kind: 'ModifyStat', stat: 'atk', amount: -300, side: 'opponent' }],",
    "id: 'mist-drain',\n        trigger: { kind: 'Continuous' },\n        operations: [{ kind: 'ModifyStat', stat: 'atk', amount: -300, side: 'self' }],",
    'SMP-208 weakens its own controller',
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
      execSync('pnpm --filter @yugi/shared exec vitest run src/effects src/cards', {
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
