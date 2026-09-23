import type { CardDefinition } from '@yugi/shared';
import type { Action, ActionContext, StartDuelAction } from '../../actions/types.js';
import { applyAction } from '../../apply-action.js';
import { EngineError } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type { GameState } from '../../state/types.js';
import { deepFreeze } from '../deep-freeze.js';

/** A golden scenario: only INPUT lives here. Expected output is recorded from the engine, never hand-written. */
export interface GoldenCase {
  readonly name: string;
  readonly start: StartDuelAction;
  readonly actions: readonly Action[];
  /** Card table for `ctx.cardDefinitions`. */
  readonly definitions: Readonly<Record<string, CardDefinition>>;
}

export type GoldenStep =
  | {
      readonly action: Action;
      readonly ok: true;
      readonly version: number;
      readonly events: GameEvent[];
    }
  | { readonly action: Action; readonly ok: false; readonly errorCode: string };

/** JSON-shaped output of replaying a case; this is exactly what a golden file stores. */
export interface GoldenRecord {
  readonly name: string;
  readonly steps: GoldenStep[];
  readonly finalState: GameState;
}

/**
 * Runs a case through the real engine. Rejected actions (EngineError) are recorded by code and leave the state
 * untouched, so validation behaviour is frozen too. States are deep-frozen so a handler that mutates its input throws.
 * Any non-EngineError exception propagates: it is a bug, not a golden outcome.
 */
export function replay(golden: GoldenCase): GoldenRecord {
  const ctx: ActionContext = { cardDefinitions: (id) => golden.definitions[id] };
  const steps: GoldenStep[] = [];

  const start = applyAction(null, golden.start, ctx);
  let state = deepFreeze(start.state);
  steps.push({ action: golden.start, ok: true, version: state.version, events: start.events });

  for (const action of golden.actions) {
    try {
      const result = applyAction(state, action, ctx);
      state = deepFreeze(result.state);
      steps.push({ action, ok: true, version: state.version, events: result.events });
    } catch (error) {
      if (!(error instanceof EngineError)) throw error;
      steps.push({ action, ok: false, errorCode: error.code });
    }
  }

  return { name: golden.name, steps, finalState: state };
}

/** Normalises to plain JSON (drops `undefined` fields) so comparison with a parsed golden file is exact. */
export function toJson(record: GoldenRecord): unknown {
  return JSON.parse(JSON.stringify(record));
}
