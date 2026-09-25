import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLang, initI18n, interpolate, lookup, resolveLang, setLang, t } from './i18n';

describe('interpolate', () => {
  it('replaces every {param}, including repeats', () => {
    expect(interpolate('{a} và {b} và {a}', { a: 'X', b: 2 })).toBe('X và 2 và X');
  });
  it('keeps a missing {param} visible instead of swallowing it', () => {
    expect(interpolate('Chào {name}', {})).toBe('Chào {name}');
    expect(interpolate('Chào {name}')).toBe('Chào {name}');
  });
  it('does not re-interpolate substituted values', () => {
    expect(interpolate('{a}', { a: '{b}', b: 'no' })).toBe('{b}');
  });
});

describe('resolveLang', () => {
  it('defaults to vi', () => {
    expect(resolveLang({ search: '', stored: null })).toBe('vi');
  });
  it('?lang wins over storage', () => {
    expect(resolveLang({ search: '?lang=en', stored: 'vi' })).toBe('en');
    expect(resolveLang({ search: '?x=1&lang=vi', stored: 'en' })).toBe('vi');
  });
  it('uses storage when there is no valid ?lang', () => {
    expect(resolveLang({ search: '', stored: 'en' })).toBe('en');
    expect(resolveLang({ search: '?lang=fr', stored: 'en' })).toBe('en');
  });
  it('ignores garbage everywhere', () => {
    expect(resolveLang({ search: '?lang=', stored: 'xx' })).toBe('vi');
    expect(resolveLang({ search: '?lang=EN', stored: null })).toBe('vi');
  });
});

describe('t / setLang', () => {
  beforeEach(() => setLang('vi'));
  afterEach(() => setLang('vi'));

  it('follows the current language on every call', () => {
    expect(t('duel.endTurn')).toBe('Kết thúc lượt');
    setLang('en');
    expect(getLang()).toBe('en');
    expect(t('duel.endTurn')).toBe('End turn');
  });
  it('interpolates params', () => {
    expect(t('event.damageDealt', { player: 'P1', amount: 500 })).toBe('P1 mất 500 LP');
    setLang('en');
    expect(t('event.damageDealt', { player: 'P1', amount: 500 })).toBe('P1 loses 500 LP');
  });
  it('lookup returns null for an unknown key and never falls back to the other language', () => {
    expect(lookup('nope.nope')).toBeNull();
    expect(lookup('error.engine.ZONE_OCCUPIED')).toBe('Ô này đã có quái.');
  });
});

describe('initI18n', () => {
  beforeEach(() => {
    localStorage.clear();
    setLang('vi');
  });
  afterEach(() => {
    localStorage.clear();
    setLang('vi');
  });

  it('reads ?lang, applies it and remembers it', () => {
    expect(initI18n('?lang=en')).toBe('en');
    expect(getLang()).toBe('en');
    expect(localStorage.getItem('yugi.lang')).toBe('en');
  });
  it('falls back to stored language, then vi', () => {
    localStorage.setItem('yugi.lang', 'en');
    expect(initI18n('')).toBe('en');
    localStorage.clear();
    expect(initI18n('')).toBe('vi');
  });
  it('does not overwrite storage for an invalid ?lang', () => {
    localStorage.setItem('yugi.lang', 'en');
    initI18n('?lang=zz');
    expect(localStorage.getItem('yugi.lang')).toBe('en');
  });
});
