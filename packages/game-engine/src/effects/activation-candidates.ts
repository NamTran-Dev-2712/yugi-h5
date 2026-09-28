import type { Cost } from '@yugi/shared';
import type { ActionContext, ActivateEffectAction } from '../actions/types.js';
import type { CardInstance, GameState } from '../state/types.js';

/*
 * Structural candidates for `ActivateEffect` (no rules here). Shared by `getLegalActions` and by the chain's
 * auto-pass check ("does the priority holder have ANY legal activation?"), which both keep only the candidates the
 * engine itself accepts.
 */

/** Upper bound on generated combinations (C(n, k) can explode for big hands). */
export const MAX_ANSWER_COMBINATIONS = 200;

export function combinations<T>(items: readonly T[], size: number, limit: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, chosen: T[]): void => {
    if (out.length >= limit) return;
    if (chosen.length === size) {
      out.push([...chosen]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      chosen.push(items[i]!);
      pick(i + 1, chosen);
      chosen.pop();
    }
  };
  pick(0, []);
  return out;
}

/**
 * Candidate cost-id lists for an effect: the cartesian product, per cost, of every way to pick `count` cards from the
 * pool that kind of cost draws on (hand without the activating card / own monsters). PayLP contributes no ids.
 * Structure only — whether a selection is actually payable is decided by the engine (dry run).
 */
function costSelections(
  costs: readonly Cost[] | undefined,
  source: CardInstance,
  hand: readonly CardInstance[],
  monsters: readonly CardInstance[],
): string[][] {
  let selections: string[][] = [[]];
  for (const cost of costs ?? []) {
    if (cost.kind === 'PayLP') continue;
    const pool =
      cost.kind === 'Discard' ? hand.filter((c) => c.instanceId !== source.instanceId) : monsters;
    const picks = combinations(pool, cost.count, MAX_ANSWER_COMBINATIONS).map((c) =>
      c.map((x) => x.instanceId),
    );
    const next: string[][] = [];
    for (const base of selections) {
      for (const pick of picks) {
        if (next.length >= MAX_ANSWER_COMBINATIONS) break;
        next.push([...base, ...pick]);
      }
    }
    selections = next;
  }
  return selections;
}

/**
 * Every effect of every non-Monster card in `seat`'s hand, then of every card in their Spell/Trap Zones (task 3.4),
 * × every candidate cost selection. Deterministic order.
 */
export function activationCandidates(
  state: GameState,
  seat: 0 | 1,
  ctx: ActionContext,
): ActivateEffectAction[] {
  const me = state.players[seat];
  const ownMonsters = me.board.monsterZones.filter((c): c is CardInstance => c !== null);
  const backrow = me.board.spellTrapZones.filter((c): c is CardInstance => c !== null);
  const out: ActivateEffectAction[] = [];
  for (const source of [...me.hand, ...backrow]) {
    const def = ctx.cardDefinitions(source.definitionId);
    if (!def || def.kind === 'Monster') continue;
    for (const effect of def.effects ?? []) {
      // Task 3.6: a Continuous effect is never activated (structural: it is not a player action at all).
      if (effect.trigger.kind === 'Continuous') continue;
      for (const costInstanceIds of costSelections(effect.cost, source, me.hand, ownMonsters)) {
        out.push({
          type: 'ActivateEffect',
          payload: {
            playerIndex: seat,
            cardInstanceId: source.instanceId,
            effectId: effect.id,
            ...(costInstanceIds.length > 0 ? { costInstanceIds } : {}),
          },
        });
      }
    }
  }
  return out;
}
