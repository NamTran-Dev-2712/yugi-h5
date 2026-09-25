import en from './locales/en.json';
import vi from './locales/vi.json';

/**
 * Minimal i18n: pure lookup + `{param}` interpolation, no Phaser, no dependency. Locale files are flat
 * (`duel.endTurn`, `error.engine.ZONE_OCCUPIED`); `vi.json` is the source of the key type, and a test keeps both files
 * on the same keys. An unknown key is shown as the key itself, never as the other language.
 */
export type Lang = 'vi' | 'en';
export type MessageKey = keyof typeof vi;
export type Params = Readonly<Record<string, string | number>>;

const CATALOGS: Record<Lang, Readonly<Record<string, string>>> = { vi, en };
export const STORAGE_KEY = 'yugi.lang';

let current: Lang = 'vi';

const isLang = (v: unknown): v is Lang => v === 'vi' || v === 'en';

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
}

/** Replaces `{name}` in one pass (substituted values are not re-scanned); a missing param stays visible. */
export function interpolate(template: string, params?: Params): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params?.[name];
    return value === undefined ? whole : String(value);
  });
}

/** Translation for a key that is only known at runtime (e.g. an error code); `null` when the key does not exist. */
export function lookup(key: string, params?: Params): string | null {
  const template = CATALOGS[current][key];
  return template === undefined ? null : interpolate(template, params);
}

export function t(key: MessageKey, params?: Params): string {
  return lookup(key, params) ?? key;
}

/** `?lang=vi|en` wins, then the stored choice, then `vi`. Anything else is ignored. */
export function resolveLang(input: { search: string; stored: string | null }): Lang {
  const fromQuery = new URLSearchParams(input.search).get('lang');
  if (isLang(fromQuery)) return fromQuery;
  return isLang(input.stored) ? input.stored : 'vi';
}

/** Browser bootstrap: reads the query string and localStorage (both optional), applies the language, remembers a valid ?lang. */
export function initI18n(search: string = safe(() => window.location.search) ?? ''): Lang {
  const stored = safe(() => localStorage.getItem(STORAGE_KEY)) ?? null;
  const lang = resolveLang({ search, stored });
  setLang(lang);
  const fromQuery = new URLSearchParams(search).get('lang');
  if (isLang(fromQuery)) safe(() => localStorage.setItem(STORAGE_KEY, fromQuery));
  return lang;
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
