// Manual mutation testing for task 3.5 (trigger effects OnSummon / OnDestroyed, optional / mandatory).
// Usage: node tools/mutants-3.5.mjs   (from the repo root)
// Each mutant edits one source snippet, runs the relevant tests and expects a FAILURE (= mutant killed).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const engineTests =
  'src/effects src/actions src/rules src/legal-actions.test.ts src/legal-actions.spells.test.ts src/testing/golden src/testing/fuzz';

const TRIGGERS = ENGINE + 'effects/triggers.ts';
const CHAIN = ENGINE + 'effects/chain.ts';
const ANSWER = ENGINE + 'actions/handlers/trigger-activation.ts';
const PROMPT = ENGINE + 'actions/handlers/resolve-pending-prompt.ts';
const SUMMON = ENGINE + 'actions/handlers/summon.ts';
const ATTACK = ENGINE + 'actions/handlers/declare-attack.ts';
const LEGAL = ENGINE + 'legal-actions.ts';

const mutants = [
  // effects/triggers.ts — what fires, in which order
  [
    TRIGGERS,
    "if (event.type === 'NormalSummoned') {",
    "if (event.type === 'NormalSummoned' || event.type === 'MonsterSet') {",
    'a Set fires OnSummon (type-level: MonsterSet has no definitionId → tsc/test red)',
  ],
  [
    TRIGGERS,
    "} else if (event.type === 'MonsterDestroyed' || event.type === 'SpellTrapDestroyed') {",
    "} else if (event.type === 'MonsterDestroyed') {",
    'a destroyed Spell/Trap never fires OnDestroyed',
  ],
  [
    TRIGGERS,
    "} else if (event.type === 'MonsterDestroyed' || event.type === 'SpellTrapDestroyed') {",
    "} else if (event.type === 'SpellTrapDestroyed') {",
    'a destroyed monster never fires OnDestroyed',
  ],
  [
    TRIGGERS,
    'return (ctx.cardDefinitions(definitionId)?.effects ?? []).filter((e) => e.trigger.kind === kind);',
    'return ctx.cardDefinitions(definitionId)?.effects ?? [];',
    'every effect of the card fires, whatever its trigger kind',
  ],
  [
    TRIGGERS,
    '    ...fired.filter((t) => t.playerIndex === turn),\n    ...fired.filter((t) => t.playerIndex !== turn),',
    '    ...fired.filter((t) => t.playerIndex !== turn),\n    ...fired.filter((t) => t.playerIndex === turn),',
    "opponent's triggers go on the chain first",
  ],
  [
    TRIGGERS,
    '  if (state.winnerIndex !== null) return [];\n  const fired',
    '  const fired',
    'triggers collected after the duel ended',
  ],
  [
    TRIGGERS,
    'return owner.graveyard.some((c) => c.instanceId === trigger.instanceId);',
    'return true;',
    'OnDestroyed activates although the card left the graveyard',
  ],
  [
    TRIGGERS,
    "return card?.instanceId === trigger.instanceId && card.position !== 'DefenseDown';",
    'return true;',
    'OnSummon activates although the monster left its zone',
  ],
  [
    TRIGGERS,
    'if (!conditionsHold(state, trigger.playerIndex, effect.condition)) return null;',
    '',
    'condition ignored',
  ],
  [
    TRIGGERS,
    '    return null; // [RULE] a cost that cannot be paid',
    '    costPlan = []; // [RULE] a cost that cannot be paid',
    'unpayable cost still activates',
  ],
  [
    TRIGGERS,
    'if (candidates.length < count) return null;',
    'if (candidates.length < 0) return null;',
    'activates without a legal target',
  ],
  [
    TRIGGERS,
    'optional: effect.trigger.mandatory !== true,',
    'optional: false,',
    'optional triggers treated as mandatory (never asked)',
  ],
  [
    TRIGGERS,
    'optional: effect.trigger.mandatory !== true,',
    'optional: true,',
    'mandatory triggers asked (and declinable)',
  ],
  [
    TRIGGERS,
    'const paid = payCosts(state, playerIndex, ready.costPlan);',
    'const paid = payCosts(state, playerIndex, []);',
    'trigger cost never paid',
  ],
  [
    TRIGGERS,
    '    source: trigger.source,',
    "    source: { zone: 'Hand' },",
    'trigger card is treated as coming from the hand (duplicated into the graveyard)',
  ],
  [
    TRIGGERS,
    'if (!ready.optional && candidates.length === ready.count) {',
    'if (!ready.optional) {',
    'mandatory trigger with several candidates picks them all without asking',
  ],
  [
    TRIGGERS,
    '      remaining: queue.slice(i + 1),',
    '      remaining: [],',
    'triggers queued behind a prompt are lost',
  ],
  [
    TRIGGERS,
    '  if (afterward !== null && current.chainStack.length === 0) {',
    '  if (false) {',
    'declined OnSummon never opens the Summon reaction window',
  ],
  [
    TRIGGERS,
    '  if (afterward !== null && current.chainStack.length === 0) {',
    '  if (afterward !== null) {',
    'a reaction window also opens over the trigger chain',
  ],

  // effects/chain.ts — where the new chain starts
  [
    CHAIN,
    "  if (source.zone === 'MonsterZone' || source.zone === 'Graveyard') return { state, events: [] };",
    '',
    'trigger card sent to the graveyard after its link',
  ],
  [
    CHAIN,
    '  const fired = fireTriggers(current, events, ctx);\n  current = fired.state;\n  events.push(...fired.events);',
    '',
    'triggers fired during chain resolution are lost',
  ],
  [
    CHAIN,
    '    const fired = fireTriggers(after.state, after.events, ctx);',
    '    const fired = { state: after.state, events: [] };',
    'battle after a closed reaction window fires nothing',
  ],
  [
    CHAIN,
    '    current.pendingPrompt === null &&\n',
    '',
    'settle auto-passes over a trigger prompt',
  ],

  // handlers
  [
    SUMMON,
    'const triggers = collectTriggers(placedState, [event], ctx);',
    'const triggers = collectTriggers(placedState, [], ctx);',
    'Normal Summon fires no OnSummon',
  ],
  [
    SUMMON,
    "      { kind: 'SummonReaction', responder: opponentIndex },",
    '      null,',
    'declined OnSummon: no reaction window for the opponent',
  ],
  [
    ATTACK,
    'const fired = fireTriggers(resolved.state, resolved.events, ctx);',
    'const fired = { state: resolved.state, events: [] };',
    'battle destruction fires no OnDestroyed',
  ],
  [
    ANSWER,
    "    if (!ready.optional) bad('a mandatory trigger cannot be declined.');",
    '',
    'mandatory trigger can be declined',
  ],
  [
    ANSWER,
    "    if (chosen.length > 0) bad('declining takes no card ids.');",
    '',
    'decline with ids accepted',
  ],
  [
    ANSWER,
    '    for (const id of chosen) if (!allowed.has(id)) bad(`${id} is not a legal target.`);',
    '',
    'any id accepted as target',
  ],
  [
    ANSWER,
    '  const rest = runTriggers(current, saved.remaining, saved.afterward, ctx, canActivate);',
    '  const rest = { state: current, events: [] };',
    'remaining triggers / afterward dropped after an answer',
  ],
  [
    ANSWER,
    '  const settled = settle(rest.state, ctx, canActivate);',
    '  const settled = { state: rest.state, events: [] };',
    'answer does not settle priority (chain never resolves)',
  ],
  [
    PROMPT,
    "  if (action.payload.decline === true && prompt.kind !== 'TriggerActivation') {",
    '  if (false) {',
    'decline accepted on other prompts',
  ],
  [
    LEGAL,
    '      payload: { playerIndex: seat, promptId: prompt.promptId, cardInstanceIds: [], decline: true },',
    '      payload: { playerIndex: seat, promptId: prompt.promptId, cardInstanceIds: [] },',
    'legalActions never offers decline',
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
