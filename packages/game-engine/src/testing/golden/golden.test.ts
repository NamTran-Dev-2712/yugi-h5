import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GOLDEN_CASES } from './cases.js';
import { replay, toJson } from './replay.js';

/*
 * Golden replays: every case is replayed through the real engine and compared to its committed baseline in
 * src/__golden__/<name>.json. A red test means engine behaviour changed. If the change is intended, review the
 * diff and re-record with:  UPDATE_GOLDEN=1 pnpm --filter @yugi/game-engine test golden
 */
const GOLDEN_DIR = new URL('../../__golden__/', import.meta.url);
const updating = process.env['UPDATE_GOLDEN'] === '1';

describe('golden replay', () => {
  it('has unique case names', () => {
    const names = GOLDEN_CASES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(GOLDEN_CASES.map((c) => [c.name, c] as const))('%s', async (name, golden) => {
    const actual = toJson(replay(golden));
    if (updating) {
      mkdirSync(GOLDEN_DIR, { recursive: true });
      writeFileSync(new URL(`${name}.json`, GOLDEN_DIR), `${JSON.stringify(actual, null, 2)}\n`);
      return;
    }
    const baseline = (await import(`../../__golden__/${name}.json`, {
      with: { type: 'json' },
    })) as {
      default: unknown;
    };
    expect(actual).toEqual(baseline.default);
  });
});
