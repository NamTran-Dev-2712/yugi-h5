import { lookup, t } from '../i18n/i18n';

/**
 * Server error codes -> one short sentence for a toast, in the current language (`error.engine.*` / `error.api.*` in
 * the locale files). The engine codes are the ones in packages/game-engine/src/errors.ts (a test reads that file, so a
 * new code without a sentence turns it red). Unknown codes get a generic sentence that shows the code, so nothing is
 * ever silently swallowed.
 */
export interface ErrorLike {
  readonly status?: number | undefined;
  readonly code?: string | undefined;
  readonly engineCode?: string | undefined;
}

const generic = (code: string): string => t('error.generic', { code });

export function messageFor(err: ErrorLike): string {
  if (err.engineCode) return lookup(`error.engine.${err.engineCode}`) ?? generic(err.engineCode);
  if (err.status === 0) return t('error.api.NETWORK_ERROR');
  if (err.status === 401) return t('error.api.UNAUTHORIZED');
  if (err.status === 429) return t('error.tooFast');
  if (err.code) {
    const known = lookup(`error.api.${err.code}`);
    if (known !== null) return known;
  }
  return generic(err.code ?? 'UNKNOWN');
}
