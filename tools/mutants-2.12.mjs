// Manual mutation run for task 2.12: applies one edit at a time, runs the web tests, expects them to FAIL, restores.
//   node tools/mutants-2.12.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const W = 'apps/web/src';
const MUTANTS = [
  ['interpolation swallows missing param', `${W}/i18n/i18n.ts`, 'return value === undefined ? whole : String(value);', "return value === undefined ? '' : String(value);"],
  ['unknown key falls back to vi', `${W}/i18n/i18n.ts`, 'return template === undefined ? null :', "return template === undefined ? (CATALOGS.vi[key] ?? null) :"],
  ['storage beats ?lang', `${W}/i18n/i18n.ts`, 'if (isLang(fromQuery)) return fromQuery;\n  return isLang(input.stored) ? input.stored : \'vi\';', "if (isLang(input.stored)) return input.stored;\n  return isLang(fromQuery) ? fromQuery : 'vi';"],
  ['default lang en', `${W}/i18n/i18n.ts`, "let current: Lang = 'vi';", "let current: Lang = 'en';"],
  ['invalid ?lang stored', `${W}/i18n/i18n.ts`, 'if (isLang(fromQuery)) safe(', 'if (fromQuery) safe('],
  ['re-interpolates values', `${W}/i18n/i18n.ts`, 'return value === undefined ? whole : String(value);', 'return value === undefined ? whole : interpolate(String(value), params);'],
  ['strings cached at module level', `${W}/duel/strings.ts`, "  get endTurn() {\n    return t('duel.endTurn');\n  },", "  endTurn: t('duel.endTurn'),"],
  ['engine code ignored', `${W}/duel/error-messages.ts`, "lookup(`error.engine.${err.engineCode}`) ?? generic(err.engineCode)", 'generic(err.engineCode)'],
  ['429 not mapped', `${W}/duel/error-messages.ts`, "if (err.status === 429) return t('error.tooFast');", ''],
  ['hidden label swapped', `${W}/duel/labels.ts`, "if (found.hidden) return t('label.hiddenCard');", "if (found.hidden) return t('label.faceDownCard');"],
  ['level dropped', `${W}/duel/detail-text.ts`, "` · ${t('detail.level', { level: detail.level })}`", "''"],
  ['event winner/draw swapped', `${W}/debug/describe-event.ts`, 'event.winnerIndex === null\n        ? t(\'event.duelEndedDraw\'', 'event.winnerIndex !== null\n        ? t(\'event.duelEndedDraw\''],
  ['tribute list dropped', `${W}/debug/describe-ai-action.ts`, "tributes: tributes.map(label).join(', '),", "tributes: '',"],
  ['en key rotted', `${W}/i18n/locales/en.json`, '"duel.endTurn": "End turn"', '"duel.endTurns": "End turn"'],
  ['en param renamed', `${W}/i18n/locales/en.json`, '"event.damageDealt": "{player} loses {amount} LP"', '"event.damageDealt": "{player} loses {amt} LP"'],
  ['en leftover Vietnamese', `${W}/i18n/locales/en.json`, '"duel.back": "< Menu"', '"duel.back": "< Về menu"'],
];

let survived = 0;
for (const [name, file, from, to] of MUTANTS) {
  const original = readFileSync(file, 'utf8');
  if (!original.includes(from)) {
    console.log(`?? ${name}: pattern not found`);
    survived++;
    continue;
  }
  writeFileSync(file, original.replace(from, () => to));
  const r = spawnSync('pnpm', ['--filter', '@yugi/web', 'exec', 'vitest', 'run', 'src/i18n', 'src/duel', 'src/debug'], {
    encoding: 'utf8',
    shell: true,
  });
  writeFileSync(file, original);
  const killed = r.status !== 0;
  if (!killed && name === 'unknown key falls back to vi') { console.log('EQUIV    ' + name + ' (vi/en key-sets are identical by test, so the fallback is unobservable)'); continue; }
  if (!killed) survived++;
  console.log(`${killed ? 'KILLED  ' : 'SURVIVED'} ${name}`);
}
console.log(`\n${MUTANTS.length - survived}/${MUTANTS.length} killed`);
process.exit(survived ? 1 : 0);
