import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { messageFor } from './error-messages';

/** Engine error codes are read from the engine source as TEXT (web may not import the engine): a new code without a
 *  Vietnamese sentence turns this test red. */
function engineCodes(): string[] {
  // vitest runs with cwd = apps/web (jsdom makes import.meta.url a non-file URL).
  const src = readFileSync(
    resolve(process.cwd(), '../../packages/game-engine/src/errors.ts'),
    'utf8',
  );
  const union = src.slice(
    src.indexOf('type EngineErrorCode'),
    src.indexOf(';', src.indexOf('type EngineErrorCode')),
  );
  return [...union.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]!);
}

describe('messageFor', () => {
  it('reads a plausible number of engine codes from the engine source', () => {
    expect(engineCodes().length).toBeGreaterThanOrEqual(30);
  });

  it('has a specific Vietnamese sentence for every engine code', () => {
    for (const code of engineCodes()) {
      const text = messageFor({ status: 409, code: 'ACTION_REJECTED', engineCode: code });
      expect(text, code).not.toBe('');
      expect(text, code).not.toContain(code); // a specific sentence, not the generic fallback with the code
      expect(text, code).not.toMatch(/undefined|\[object/);
    }
  });

  it('maps API codes and network failures', () => {
    expect(messageFor({ status: 403, code: 'NOT_OWNER' })).not.toBe('');
    expect(messageFor({ status: 400, code: 'VALIDATION_FAILED' })).not.toBe('');
    expect(messageFor({ status: 401, code: 'UNAUTHORIZED' })).not.toBe('');
    expect(messageFor({ status: 0, code: 'NETWORK_ERROR' })).toMatch(/kết nối|mạng/i);
  });

  it('prefers the engine code over the generic ACTION_REJECTED', () => {
    const a = messageFor({ status: 409, code: 'ACTION_REJECTED', engineCode: 'ZONE_OCCUPIED' });
    const b = messageFor({ status: 409, code: 'ACTION_REJECTED', engineCode: 'NOT_TURN_PLAYER' });
    expect(a).not.toBe(b);
  });

  it('unknown codes get a generic sentence that shows the code', () => {
    const text = messageFor({ status: 418, code: 'TEAPOT', engineCode: 'SOMETHING_NEW' });
    expect(text).toContain('SOMETHING_NEW');
    expect(messageFor({ status: 500, code: 'WEIRD' })).toContain('WEIRD');
  });
});
