import type { CardInstance, GameState } from '../../state/types.js';

/** Stub for the red run of task 4.5 (replaced by the implementation in the next commit). */
export function fusionOptions(
  _state: GameState,
  _controller: 0 | 1,
  _op: unknown,
  _ctx: unknown,
): {
  fusion: CardInstance;
  materials: string[];
  candidates: { card: CardInstance; from: string }[];
}[] {
  return [];
}
