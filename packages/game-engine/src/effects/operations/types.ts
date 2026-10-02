import type { Operation, OperationKind } from '@yugi/shared';
import type { GameEvent } from '../../events/types.js';
import type { ChainLink, ChainWindow, GameState } from '../../state/types.js';

/** What an operation may read besides its own params. Pure data: no callbacks that could hide nondeterminism. */
export interface OperationContext {
  /** Player who controls the effect ("self" in operation params). */
  readonly controller: 0 | 1;
  /** Cards chosen for the effect's `Card` target (empty when it has none). */
  readonly targetInstanceIds: readonly string[];
  /** Task 4.2c: the card whose effect resolves (an Equip Spell equips itself). */
  readonly sourceInstanceId: string;
  /** Task 4.4: the chain link directly below the resolving one — the activation it answered (absent for link 1). */
  readonly respondsTo?: ChainLink;
  /**
   * Task 4.4: the window the chain was built in (`state.chainWindow` is already null while it resolves): what a
   * NegateAttack / NegateSummon answers. `reactionTo` is dropped once an attack was negated earlier in the same chain.
   */
  readonly window?: ChainWindow;
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
