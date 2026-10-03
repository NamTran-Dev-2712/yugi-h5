// Manual mutation testing for task 4.4c (the Summon reaction window before the OnSummon / OnFlip triggers; activating
// a Set Equip Spell). Usage: node tools/mutants-4.4c.mjs   (from the repo root)
// Each mutant edits one source snippet, runs the engine tests + tsc and expects a FAILURE (= mutant killed).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const engineTests =
  'src/rules src/actions src/effects src/cards src/legal-actions.spells.test.ts src/testing/golden src/testing/fuzz';

const ACTIVATE = ENGINE + 'actions/handlers/activate-effect.ts';
const SUMMON = ENGINE + 'actions/handlers/summon.ts';
const FLIP = ENGINE + 'actions/handlers/flip-summon.ts';
const CHAIN = ENGINE + 'effects/chain.ts';
const TRIGGERS = ENGINE + 'effects/triggers.ts';

const mutants = [
  // A — actions/handlers/summon.ts, flip-summon.ts: the window comes first and keeps the Summon event
  [
    SUMMON,
    '  if (withWindow !== null) {\n    return {',
    '  if (withWindow !== null && fireTriggers(placedState, [event], ctx).events.length === 0) {\n    return {',
    'Normal Summon: a trigger still goes on the chain before the Summon window (old order)',
  ],
  [
    SUMMON,
    "    event.type === 'NormalSummoned' ? event : undefined,",
    '    undefined,',
    'Normal Summon: the window does not keep the Summon event (the trigger is lost after the window)',
  ],
  [
    FLIP,
    '  if (withWindow !== null)\n    return {',
    '  if (withWindow !== null && fireTriggers(placedState, [event], ctx).events.length === 0)\n    return {',
    'Flip Summon: a trigger still goes on the chain before the Summon window (old order)',
  ],
  [
    FLIP,
    '    summoned,\n    event,\n  );',
    '    summoned,\n  );',
    'Flip Summon: the window does not keep the Summon event',
  ],
  // A — effects/chain.ts: carrying the event, collecting the triggers when the window is done
  [
    CHAIN,
    '    ...(summonEvent ? { summonEvent } : {}),\n  };\n}',
    '  };\n}',
    'the Summon event is dropped when a link is added in the Summon window (windowFor)',
  ],
  [
    CHAIN,
    '      ...(summonEvent ? { summonEvent } : {}),\n    },\n  };',
    '    },\n  };',
    'openReactionWindow does not store the Summon event',
  ],
  [
    CHAIN,
    '  return negated ? [] : [owed];',
    '  return [owed];',
    'a negated Summon still hands its event to the trigger collector',
  ],
  [
    CHAIN,
    "    (e) => e.type === 'SummonNegated' && e.instanceId === owed.instanceId,",
    "    (e) => e.type === 'SummonNegated',",
    'any negated Summon cancels the owed event (instance not compared)',
  ],
  [
    CHAIN,
    '      [...owedSummonEvents(window, after.events), ...after.events],',
    '      after.events,',
    'no trigger after the opponent passed the Summon window',
  ],
  [
    CHAIN,
    '    [...owedSummonEvents(state.chainWindow, events), ...events],',
    '    events,',
    'no trigger after a chain built in the Summon window resolved',
  ],
  [
    CHAIN,
    '    [...owedSummonEvents(state.chainWindow, events), ...events],',
    '    [...events, ...owedSummonEvents(state.chainWindow, events)],',
    'the Summon trigger is ordered after the triggers fired by the window’s chain',
  ],
  // A — effects/triggers.ts: a monster that left its zone gets no trigger (negated / destroyed in the window)
  [
    TRIGGERS,
    "    return card?.instanceId === trigger.instanceId && card.position !== 'DefenseDown';",
    '    return true;',
    'a monster that left its zone inside the Summon window still gets its trigger',
  ],
  [
    TRIGGERS,
    '      afterward: null,',
    "      afterward: { kind: 'SummonReaction', responder: 0 },",
    'the trigger prompt still claims a Summon window comes afterwards',
  ],
  // B — actions/handlers/activate-effect.ts: a Set Equip Spell
  [
    ACTIVATE,
    "      definition.subType === 'Normal' ||\n      definition.subType === 'Equip' ||\n      definition.subType === 'Continuous' ||\n      definition.subType === 'Field'\n    ) {",
    "      definition.subType === 'Normal' ||\n      definition.subType === 'Continuous' ||\n      definition.subType === 'Field'\n    ) {",
    'a Set Equip Spell is not activatable (pre-4.4c)',
  ],
  [
    ACTIVATE,
    "      if (playerIndex !== state.turnPlayerIndex)\n        fail('NOT_TURN_PLAYER', 'a Set Spell may only be activated on your own turn.');",
    '',
    'a Set Equip Spell is activatable on the opponent’s turn (in a window)',
  ],
  [
    ACTIVATE,
    "      if (state.phase !== 'Main1' && state.phase !== 'Main2')\n        fail('WRONG_PHASE', `only allowed in a Main Phase (current phase: ${state.phase}).`);\n      trigger = 'Ignition';",
    "      trigger = 'Ignition';",
    'a Set Equip Spell is activatable outside a Main Phase',
  ],
  [
    ACTIVATE,
    "    if (definition.kind === 'Spell' && definition.subType === 'QuickPlay')\n      fail('SPELL_SET_THIS_TURN'",
    "    if (\n      definition.kind === 'Spell' &&\n      (definition.subType === 'QuickPlay' || definition.subType === 'Equip')\n    )\n      fail('SPELL_SET_THIS_TURN'",
    'a Set Equip Spell cannot be activated on the turn it was Set',
  ],
  [
    ACTIVATE,
    "  if (source.zone === 'Hand' && definition.kind === 'Spell') {",
    "  if (definition.kind === 'Spell' && (source.zone === 'Hand' || definition.subType === 'Equip')) {",
    'a Set Equip Spell moves to the lowest empty zone when activated',
  ],
  // B — effects/chain.ts: what happens to the Set Equip after its link
  [
    CHAIN,
    '    if (!negated && inZone.equippedTo !== undefined) return { state, events: [] };',
    "    if (!negated && (inZone.equippedTo !== undefined || definition?.subType === 'Equip'))\n      return { state, events: [] };",
    'an Equip Spell whose target is gone stays on the field instead of going to the graveyard',
  ],
  [
    CHAIN,
    '      const sent = sendToGraveyard(current, below, ctx, true);',
    '      const sent = { state: current, events: [] as GameEvent[] };',
    'a negated card (a Set Equip included) is not sent to the graveyard at once',
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
  let killed = false;
  try {
    execSync(`pnpm --filter @yugi/game-engine exec vitest run ${engineTests}`, { stdio: 'pipe' });
    execSync('pnpm --filter @yugi/game-engine exec tsc --noEmit -p .', { stdio: 'pipe' });
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
