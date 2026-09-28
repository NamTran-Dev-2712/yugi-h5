// Manual mutation testing for task 3.7 (chain UI in the Phaser duel scene: tap a Set card, "Bỏ qua", chain banner,
// trigger Yes/No overlay, effective ATK/DEF). Only apps/web changed.
// Usage: node tools/mutants-3.7.mjs   (from the repo root; build packages/shared first — web reads its dist)
// Each mutant edits one source snippet, runs the web unit tests and expects a FAILURE (= mutant killed).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const DUEL = 'apps/web/src/duel/';
const LEGAL = DUEL + 'legal-index.ts';
const MACHINE = DUEL + 'interaction.ts';
const PRESENTER = DUEL + 'presenter.ts';
const DETAIL = DUEL + 'detail-text.ts';
const CONTROLLER = DUEL + 'duel-controller.ts';

const mutants = [
  // legal-index — filtering only
  [
    LEGAL,
    "a.type === 'PassPriority' && mine(a, viewer)",
    "a.type === 'PassPriority'",
    'passAction takes the other seat’s PassPriority',
  ],
  [
    LEGAL,
    'setCardIds.filter((id) => activations(legal, viewer, id).length > 0)',
    'setCardIds.filter(() => true)',
    'every Set card counted as activatable',
  ],
  [
    LEGAL,
    'answers: all.filter((a) => a.payload.decline !== true),',
    'answers: all,',
    'decline mixed into the activating answers',
  ],
  [
    LEGAL,
    'decline: all.find((a) => a.payload.decline === true) ?? null,',
    'decline: null,',
    'decline never found',
  ],
  // interaction — tap a Set card, trigger selection
  [
    MACHINE,
    "  if (card.zone === 'spellTrap' && activations(ctx.legalActions, viewer, card.id).length > 0) {",
    "  if (card.zone === 'spellTrap') {",
    'any of my Set cards starts a tap (even without a listed activation)',
  ],
  [
    MACHINE,
    "    if (card?.zone === 'spellTrap') return activateSetCard(card.id, point, ctx);\n",
    '',
    'tapping a Set card does nothing',
  ],
  [
    MACHINE,
    '    group.push(a);\n    byEffect.set(a.payload.effectId, group);',
    "    group.push(a);\n    byEffect.set('all', group);",
    'several effects are not split into menu entries',
  ],
  [
    MACHINE,
    "  if (prompt.kind === 'TriggerActivation') {",
    "  if (prompt.kind === 'TriggerActivation-x') {",
    'trigger prompt does not open its selection',
  ],
  [
    MACHINE,
    '    if (state.decline) return emit(state.decline, ctx);\n',
    '',
    '"Không" does not decline',
  ],
  [
    MACHINE,
    '          showCancel: cancellable(state.purpose) || state.decline !== undefined,',
    '          showCancel: cancellable(state.purpose),',
    '"Không" button never shown',
  ],
  [
    MACHINE,
    '  return i === -1 ? settle(ctx, []) : resolveGroup(state.options[i]!.actions, ctx);',
    '  return i === -1 ? stay(IDLE) : resolveGroup(state.options[i]!.actions, ctx);',
    'missing a menu leaves a pending prompt stuck',
  ],
  // presenter
  [
    PRESENTER,
    '      cards.push(activatable.has(c.instanceId) ? { ...r, activatable: true } : r);',
    '      cards.push(r);',
    'no Set card outlined',
  ],
  [
    PRESENTER,
    "      side === 'self'\n        ? new Set(",
    "      side === 'self' || true\n        ? new Set(",
    'opponent Set cards looked up as activatable',
  ],
  [PRESENTER, '    pass\n      ? {', '    pass && false\n      ? {', '"Bỏ qua" button never shown'],
  [
    PRESENTER,
    "  if (w.priorityPlayer !== view.viewerIndex) return { text: t('chain.waitOpponent'), mine: false };",
    '',
    'waiting-for-opponent banner said to be mine',
  ],
  [
    PRESENTER,
    "  if (w.reactionTo?.kind === 'Summon') return { text: t('chain.reactionSummon'), mine: true };",
    "  if (w.reactionTo?.kind === 'Summon') return { text: t('chain.reactionAttack'), mine: true };",
    'summon reaction uses the attack sentence',
  ],
  [
    PRESENTER,
    '  const top = view.chain[view.chain.length - 1];',
    '  const top = view.chain[0];',
    'banner names the bottom link, not the top',
  ],
  [
    PRESENTER,
    "              ? triggerPromptText(prompt.payload, ctx.lookup)",
    '              ? strings.promptOther',
    'trigger prompt does not name the card',
  ],
  [
    PRESENTER,
    '  printed !== null && effective !== undefined && effective !== printed ? effective : null;',
    '  printed !== null && effective !== undefined ? effective : null;',
    'unchanged effective stats reported as changed',
  ],
  [
    PRESENTER,
    '    effAtk: changed(atk, effective?.atk),',
    '    effAtk: changed(atk, effective?.def),',
    'effective ATK read from DEF',
  ],
  // detail text
  [
    DETAIL,
    '    if (modified) lines.push(',
    '    if (true) lines.push(',
    'printed stats line shown without a modifier',
  ],
  [
    DETAIL,
    "      t('detail.atkDef', { atk: detail.effAtk ?? detail.atk, def: detail.effDef ?? detail.def }),",
    "      t('detail.atkDef', { atk: detail.atk, def: detail.def }),",
    'detail panel shows only the printed stats',
  ],
  // controller
  [
    CONTROLLER,
    "        const action = legal('PassPriority');",
    "        const action = legal('EndPhase');",
    '"Bỏ qua" sends EndPhase',
  ],
  [
    CONTROLLER,
    '        else await run(action, true);',
    '        else await run(action, false);',
    '"Bỏ qua" does not show "thinking"',
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
    execSync('pnpm --filter @yugi/web exec vitest run src/duel src/i18n', { stdio: 'pipe' });
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
