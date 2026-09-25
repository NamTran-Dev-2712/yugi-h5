import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import vi from './locales/vi.json';

const viKeys = Object.keys(vi as Record<string, string>).sort();
const enKeys = Object.keys(en as Record<string, string>).sort();
const params = (s: string): string[] =>
  [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].sort();
const VI_DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

describe('locale files', () => {
  it('vi and en have exactly the same keys (no silent English fallback)', () => {
    const missingInEn = viKeys.filter((k) => !enKeys.includes(k));
    const missingInVi = enKeys.filter((k) => !viKeys.includes(k));
    expect({ missingInEn, missingInVi }).toEqual({ missingInEn: [], missingInVi: [] });
  });
  it('every key has the same {params} on both sides', () => {
    const bad = viKeys.filter(
      (k) =>
        JSON.stringify(params((vi as Record<string, string>)[k]!)) !==
        JSON.stringify(params((en as Record<string, string>)[k]!)),
    );
    expect(bad).toEqual([]);
  });
  it('no empty values', () => {
    for (const [k, v] of [...Object.entries(vi), ...Object.entries(en)]) expect(v, k).not.toBe('');
  });
  it('en contains no Vietnamese diacritics (an untranslated leftover)', () => {
    const bad = Object.entries(en as Record<string, string>).filter(([, v]) =>
      VI_DIACRITICS.test(v),
    );
    expect(bad).toEqual([]);
  });
  it('covers every engine error code in both languages', () => {
    const src = readFileSync(
      resolve(process.cwd(), '../../packages/game-engine/src/errors.ts'),
      'utf8',
    );
    const start = src.indexOf('type EngineErrorCode');
    const union = src.slice(start, src.indexOf(';', start));
    const codes = [...union.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]!);
    expect(codes.length).toBeGreaterThanOrEqual(30);
    const missing = codes.filter(
      (c) => !viKeys.includes(`error.engine.${c}`) || !enKeys.includes(`error.engine.${c}`),
    );
    expect(missing).toEqual([]);
  });
});

describe('no hardcoded Vietnamese in translated modules', () => {
  const files = [
    'duel/strings.ts',
    'duel/labels.ts',
    'duel/detail-text.ts',
    'duel/error-messages.ts',
    'debug/describe-event.ts',
    'debug/describe-ai-action.ts',
  ];
  for (const f of files) {
    it(f, () => {
      const src = readFileSync(resolve(process.cwd(), 'src', f), 'utf8');
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((l) => l.replace(/\/\/.*$/, ''))
        .join('\n');
      expect(code).not.toMatch(VI_DIACRITICS);
    });
  }
  it('locale dir has only the two locale files', () => {
    expect(readdirSync(resolve(process.cwd(), 'src/i18n/locales')).sort()).toEqual([
      'en.json',
      'vi.json',
    ]);
  });
});
