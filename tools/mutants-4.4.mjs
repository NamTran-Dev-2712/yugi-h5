// Manual mutation testing for task 4.4 (Counter Trap + the Negate operations NegateActivation / NegateAttack /
// NegateSummon). Usage: node tools/mutants-4.4.mjs   (from the repo root)
// Each mutant edits one source snippet, runs the relevant tests and expects a FAILURE (= mutant killed).
// Mutants tagged 'shared' run the shared schema/card tests; the others run the engine tests + tsc.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ENGINE = 'packages/game-engine/src/';
const engineTests =
  'src/rules src/actions src/effects src/cards src/legal-actions.spells.test.ts src/testing/golden src/testing/fuzz';

const ACTIVATE = ENGINE + 'actions/handlers/activate-effect.ts';
const SUMMON = ENGINE + 'actions/handlers/summon.ts';
const FLIP = ENGINE + 'actions/handlers/flip-summon.ts';
const TRIGGER_ANSWER = ENGINE + 'actions/handlers/trigger-activation.ts';
const CHAIN = ENGINE + 'effects/chain.ts';
const NEGATE = ENGINE + 'effects/negate.ts';
const OP_ACTIVATION = ENGINE + 'effects/operations/negate-activation.ts';
const OP_ATTACK = ENGINE + 'effects/operations/negate-attack.ts';
const OP_SUMMON = ENGINE + 'effects/operations/negate-summon.ts';
const OPERATION = 'packages/shared/src/effects/operation.ts';
const REGISTRY = 'packages/shared/src/effects/registry.ts';
const EFFECT_DEF = 'packages/shared/src/effects/effect-definition.ts';
const SAMPLE = 'packages/shared/src/cards/sample-cards.ts';

const mutants = [
  // actions/handlers/activate-effect.ts — the Counter Trap rule, Spell Speed, the Negate requirement
  [
    ACTIVATE,
    "  if (definition.kind === 'Trap' && definition.subType === 'Counter' && state.chainWindow === null)",
    '  if (false)',
    'a Counter Trap may start a chain (rule removed)',
  ],
  [
    ACTIVATE,
    "  if (definition.kind === 'Trap' && definition.subType === 'Counter' && state.chainWindow === null)",
    "  if (definition.kind === 'Trap' && state.chainWindow === null)",
    'every Trap needs a window (rule not limited to Counter Traps)',
  ],
  [
    ACTIVATE,
    '  if (top && (spellSpeed < 2 || spellSpeed < top.spellSpeed))',
    '  if (top && spellSpeed < 2)',
    'Spell Speed 2 answers a Spell Speed 3 link (speed check dropped)',
  ],
  [
    ACTIVATE,
    '  if (negateRequirementUnmet(state, playerIndex, effect, ctx))',
    '  if (false)',
    'a Negate effect is activatable with nothing to negate',
  ],
  // effects/negate.ts — what may be negated
  [
    NEGATE,
    '      if (!top || top.playerIndex === seat) return true;',
    '      if (!top) return true;',
    'NegateActivation may answer its own controller’s link',
  ],
  [
    NEGATE,
    '      if (op.cardKinds !== undefined) {',
    '      if (false) {',
    'NegateActivation ignores cardKinds (answers a monster effect)',
  ],
  [
    NEGATE,
    "      if (reactionTo?.kind !== 'Attack' || reactionTo.playerIndex === seat) return true;",
    "      if (reactionTo?.kind !== 'Attack') return true;",
    'the attacker may negate its own attack',
  ],
  [
    NEGATE,
    "      if (reactionTo?.kind !== 'Attack' || reactionTo.playerIndex === seat) return true;",
    '      if (reactionTo === undefined) return true;',
    'NegateAttack is activatable in a Summon window',
  ],
  [
    NEGATE,
    '      if (!summoned || summoned.playerIndex === seat || state.chainStack.length > 0) return true;',
    '      if (!summoned || summoned.playerIndex === seat) return true;',
    'NegateSummon may be chained after another card (not the first link)',
  ],
  // effects/chain.ts — resolution
  [
    CHAIN,
    '    if (negatedLinkIds.has(link.linkId)) continue;',
    '    if (false) continue;',
    'a negated link resolves anyway',
  ],
  [
    CHAIN,
    '      const sent = sendToGraveyard(current, below, ctx, true);',
    '      const sent = sendToGraveyard(current, below, ctx);',
    'a negated Continuous / Field / Equip card stays on the field (not forced to the graveyard)',
  ],
  [
    CHAIN,
    '  if (!negated && definition && staysOnField(definition)) return { state, events: [] };',
    '  if (definition && staysOnField(definition)) return { state, events: [] };',
    'a negated Continuous / Field card stays (staysOnField wins over negated)',
  ],
  [
    CHAIN,
    '    if (inField?.instanceId !== card.instanceId) return { state, events: [] };',
    '    if (card.instanceId !== undefined) return { state, events: [] };',
    'a negated Field Spell stays in the Field Zone',
  ],
  [
    CHAIN,
    '      const out = resolveLink(current, link, ctx, links[i - 1], window);',
    '      const out = resolveLink(current, link, ctx, links[i - 2], window);',
    'negates the wrong link (two below instead of the one answered)',
  ],
  [
    CHAIN,
    '      const out = resolveLink(current, link, ctx, links[i - 1], window);',
    '      const out = resolveLink(current, link, ctx, links[i - 1], undefined);',
    'operations get no window (NegateAttack / NegateSummon do nothing)',
  ],
  [
    CHAIN,
    '    attackNegated ? undefined : state.chainWindow?.reactionTo,',
    '    state.chainWindow?.reactionTo,',
    'a negated attack still goes on to damage',
  ],
  [
    CHAIN,
    '          window = rest;',
    '          void rest;',
    'a second NegateAttack in the same chain negates again',
  ],
  [
    CHAIN,
    '      const sent = sendToGraveyard(current, below, ctx, true);\n      current = sent.state;',
    "      const sent = sendToGraveyard(current, below, ctx, true);\n      current = {\n        ...sent.state,\n        players: sent.state.players.map((p, i) =>\n          i === below.playerIndex ? { ...p, lifePoints: p.lifePoints + below.lpPaid } : p,\n        ) as unknown as GameState['players'],\n      };",
    'the cost of a negated activation is refunded',
  ],
  [
    CHAIN,
    '    ...(reactionTo ? { reactionTo } : {}),\n    ...(summoned ? { summoned } : {}),',
    '    ...(reactionTo ? { reactionTo } : {}),',
    'the window forgets the Summoned monster once a link is added',
  ],
  [
    CHAIN,
    '      reactionTo,\n      ...(summoned ? { summoned } : {}),',
    '      reactionTo,',
    'the Summon reaction window never names the Summoned monster',
  ],
  // Summon handlers
  [
    SUMMON,
    "    position === 'Attack' ? { playerIndex, instanceId: card.instanceId } : undefined;",
    '    { playerIndex, instanceId: card.instanceId };',
    'a Set monster counts as Summoned (NegateSummon answers a Set)',
  ],
  [
    FLIP,
    '  const summoned = { playerIndex, instanceId: monster.instanceId };',
    '  const summoned = undefined;',
    'a Flip Summon cannot be negated',
  ],
  [
    TRIGGER_ANSWER,
    '      : { playerIndex: saved.trigger.playerIndex, instanceId: saved.trigger.instanceId };',
    '      : undefined;',
    'after a declined trigger the Summon window forgets the monster',
  ],
  // operations
  [
    OP_ACTIVATION,
    '        byInstanceId: ctx.sourceInstanceId,',
    '        byInstanceId: below.card.instanceId,',
    'ChainLinkNegated names the wrong negating card',
  ],
  [
    OP_ACTIVATION,
    '        playerIndex: below.playerIndex,',
    '        playerIndex: ctx.controller,',
    'ChainLinkNegated names the wrong player',
  ],
  [
    OP_ATTACK,
    '      i === zone && c ? ({ ...c, attackedTurn: state.turnCount } satisfies CardInstance) : c,',
    '      i === zone && c ? ({ ...c } satisfies CardInstance) : c,',
    'a negated attacker may attack again (no attackedTurn stamp)',
  ],
  [
    OP_ATTACK,
    "  if (attack?.kind !== 'Attack') return { state, events: [] };",
    "  if (attack?.kind !== 'Attack' || attack.targetInstanceId === null) return { state, events: [] };",
    'NegateAttack does nothing against a direct attack',
  ],
  [
    OP_SUMMON,
    '    i === zoneIndex ? null : c,',
    '    c,',
    'the negated monster stays on the field too (duplicated)',
  ],
  [
    OP_SUMMON,
    '      ...controller.graveyard,\n      {',
    '      {',
    'NegateSummon wipes the graveyard',
  ],
  [
    OP_SUMMON,
    "        type: 'SummonNegated',",
    "        type: 'MonsterDestroyed',\n        ownerIndex: summoned.playerIndex,",
    'the negated monster counts as destroyed (fires OnDestroyed)',
  ],
  // shared: schema, registry, card data
  [
    OPERATION,
    "        .array(z.enum(['Monster', 'Spell', 'Trap']))\n        .min(1)",
    "        .array(z.enum(['Monster', 'Spell', 'Trap']))",
    'NegateActivation accepts an empty cardKinds list',
    'shared',
  ],
  [
    REGISTRY,
    "  NegateAttack: { implemented: true, timing: 'resolve' },",
    "  NegateAttack: { implemented: false, timing: 'resolve' },",
    'registry says NegateAttack is not implemented',
    'shared',
  ],
  [
    EFFECT_DEF,
    "    (e) => e.trigger.kind === 'Quick' || !e.operations.some((o) => isNegateOperationKind(o.kind)),",
    '    () => true || isNegateOperationKind,',
    'a Negate operation is allowed on a non-Quick effect',
    'shared',
  ],
  [
    SAMPLE,
    "        operations: [{ kind: 'NegateAttack' }],",
    "        operations: [{ kind: 'NegateSummon' }],",
    'SMP-201 negates a Summon instead of an attack',
    'shared',
  ],
  [
    SAMPLE,
    "    name: { vi: 'Rào Chắn Hộ Vệ', en: 'Guardian Barrier' },\n    subType: 'Normal',",
    "    name: { vi: 'Rào Chắn Hộ Vệ', en: 'Guardian Barrier' },\n    subType: 'Counter',",
    'SMP-201 becomes a Counter Trap',
    'shared',
  ],
  [
    SAMPLE,
    "        id: 'sealing-rune',\n        trigger: { kind: 'Quick' },\n        cost: [{ kind: 'PayLP', amount: 1000 }],",
    "        id: 'sealing-rune',\n        trigger: { kind: 'Quick' },\n        cost: [{ kind: 'PayLP', amount: 500 }],",
    'SMP-209 costs 500 LP',
    'shared',
  ],
  [
    SAMPLE,
    "        operations: [{ kind: 'NegateActivation', cardKinds: ['Spell', 'Trap'] }],",
    "        operations: [{ kind: 'NegateActivation' }],",
    'SMP-209 negates monster effects too',
    'shared',
  ],
  [
    SAMPLE,
    "    name: { vi: 'Ấn Chú Phong Tỏa', en: 'Sealing Rune' },\n    subType: 'Counter',",
    "    name: { vi: 'Ấn Chú Phong Tỏa', en: 'Sealing Rune' },\n    subType: 'Normal',",
    'SMP-209 is a Normal Trap (Spell Speed 2)',
    'shared',
  ],
  [
    SAMPLE,
    "    name: { vi: 'Cổng Khước Từ', en: 'Gate of Refusal' },\n    subType: 'Counter',",
    "    name: { vi: 'Cổng Khước Từ', en: 'Gate of Refusal' },\n    subType: 'Normal',",
    'SMP-210 is a Normal Trap (Spell Speed 2)',
    'shared',
  ],
  [
    SAMPLE,
    "        operations: [{ kind: 'NegateSummon' }],",
    "        operations: [{ kind: 'NegateAttack' }],",
    'SMP-210 negates an attack instead of a Summon',
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
