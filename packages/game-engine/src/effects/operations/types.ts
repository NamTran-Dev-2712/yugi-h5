import type { Operation, OperationKind } from '@yugi/shared';
import type { GameEvent } from '../../events/types.js';
import type { GameState } from '../../state/types.js';

/** What an operation may read besides its own params. Pure data: no callbacks that could hide nondeterminism. */
export interface OperationContext {
  /** Player who controls the effect ("self" in operation params). */
  readonly controller: 0 | 1;
  /** Cards chosen for the effect's `Card` target (empty when it has none). */
  readonly targetInstanceIds: readonly string[];
}

export interface OperationResult {
  readonly state: GameState;
  readonly events: GameEvent[];
}

/**
 * Operations are pure: (state, params, ctx) -> {state, events}. They never bump `state.version` (the activation does,
 * once) and never look at `pendingPrompt`.
 */
export type OperationHandler<K extends OperationKind> = (
  state: GameState,
  op: Extract<Operation, { kind: K }>,
  ctx: OperationContext,
) => OperationResult;
