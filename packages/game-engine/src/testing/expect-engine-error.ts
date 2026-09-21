import { expect } from 'vitest';
import { EngineError, type EngineErrorCode } from '../errors.js';

/** Asserts `fn` throws an `EngineError` with exactly this `code` (never matches on the message text). */
export function expectEngineError(fn: () => unknown, code: EngineErrorCode): void {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  expect(thrown, `expected EngineError ${code}, but nothing was thrown`).toBeInstanceOf(
    EngineError,
  );
  expect((thrown as EngineError).code).toBe(code);
}
