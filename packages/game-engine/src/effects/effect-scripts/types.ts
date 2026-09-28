import type { GameState } from '../../state/types.js';
import type { OperationContext, OperationResult } from '../operations/types.js';

/** What a script may read besides the state: the same pure data as an operation (controller + chosen targets). */
export type ScriptContext = OperationContext;

/**
 * An effect script (task 3.6): behaviour the effect DSL cannot express, keyed by `EffectDefinition.scriptId`. Runs on
 * resolution, after the effect's operations, only while the duel is still going. Same contract as an operation: pure
 * and deterministic, never bumps `version`, never touches `pendingPrompt`/`chainStack`.
 */
export type EffectScriptHandler = (state: GameState, ctx: ScriptContext) => OperationResult;
