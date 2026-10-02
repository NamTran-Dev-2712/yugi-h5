import type { EffectDefinition } from '@yugi/shared';
import type { ActionContext } from '../actions/types.js';
import type { GameState } from '../state/types.js';

/*
 * Task 4.4 — what a Negate operation needs in order to be ACTIVATED (the operations themselves live in
 * `operations/negate-*.ts`). Read from the effect's operations, never from a card id. Checked by `prepare`
 * (`actions/handlers/activate-effect.ts`), so `legalActions`, the auto-pass and the reaction windows follow by dry run.
 */

/**
 * True when `effect` holds a Negate operation that has nothing to negate right now for `seat`:
 * - `NegateActivation`: the top chain link must be the OPPONENT's, of a card kind listed in `cardKinds` (when given);
 * - `NegateAttack`: an attack of the OPPONENT is being declared (attack reaction window, task 3.4c);
 * - `NegateSummon`: the opponent's Normal / Flip Summon is being answered directly — the Summon reaction window still
 *   has an empty chain [ASSUMED] and the Summoned monster is still face-up in its zone.
 */
export function negateRequirementUnmet(
  state: GameState,
  seat: 0 | 1,
  effect: EffectDefinition,
  ctx: ActionContext,
): boolean {
  for (const op of effect.operations) {
    if (op.kind === 'NegateActivation') {
      const top = state.chainStack.at(-1);
      if (!top || top.playerIndex === seat) return true;
      if (op.cardKinds !== undefined) {
        const kind = ctx.cardDefinitions(top.card.definitionId)?.kind;
        if (kind === undefined || !op.cardKinds.includes(kind)) return true;
      }
    } else if (op.kind === 'NegateAttack') {
      const reactionTo = state.chainWindow?.reactionTo;
      if (reactionTo?.kind !== 'Attack' || reactionTo.playerIndex === seat) return true;
    } else if (op.kind === 'NegateSummon') {
      const summoned = state.chainWindow?.summoned;
      if (!summoned || summoned.playerIndex === seat || state.chainStack.length > 0) return true;
      const monster = state.players[summoned.playerIndex].board.monsterZones.find(
        (c) => c?.instanceId === summoned.instanceId,
      );
      if (!monster || monster.position === 'DefenseDown') return true;
    }
  }
  return false;
}
