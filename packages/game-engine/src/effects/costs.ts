import type { Cost } from '@yugi/shared';
import { EngineError } from '../errors.js';
import type { GameEvent } from '../events/types.js';
import type { ActionContext } from '../actions/types.js';
import type { CardInstance, GameState, PlayerState } from '../state/types.js';
import { matchesFilter } from './filter.js';

/** A validated cost, ready to be applied. Built by `planCosts` (pure, no state change). */
export type CostStep =
  | { readonly kind: 'Discard'; readonly cards: readonly CardInstance[] }
  | { readonly kind: 'Tribute'; readonly cards: readonly { card: CardInstance; zone: number }[] }
  | { readonly kind: 'PayLP'; readonly amount: number };

const invalid = (reason: string): never => {
  throw new EngineError('INVALID_COST', `cost rejected: ${reason}`);
};

/**
 * Checks `costInstanceIds` against the effect's `cost[]` and returns what will be paid. Ids are consumed in order:
 * each Discard/Tribute takes `count` ids; PayLP takes none. `sourceInstanceId` (the activating card) can never pay.
 */
export function planCosts(
  state: GameState,
  playerIndex: 0 | 1,
  sourceInstanceId: string,
  costs: readonly Cost[] | undefined,
  costInstanceIds: readonly string[],
  ctx: ActionContext,
): CostStep[] {
  const player = state.players[playerIndex];
  const used = new Set<string>();
  let cursor = 0;
  const steps: CostStep[] = [];

  for (const cost of costs ?? []) {
    if (cost.kind === 'PayLP') {
      if (player.lifePoints <= cost.amount) {
        invalid(`paying ${cost.amount} LP needs more than ${player.lifePoints} LP.`);
      }
      steps.push({ kind: 'PayLP', amount: cost.amount });
      continue;
    }

    const ids = costInstanceIds.slice(cursor, cursor + cost.count);
    if (ids.length !== cost.count) {
      invalid(`${cost.kind} needs ${cost.count} card(s), ids ran out.`);
    }
    cursor += cost.count;
    for (const id of ids) {
      if (used.has(id)) invalid(`${id} is used more than once.`);
      used.add(id);
    }

    if (cost.kind === 'Discard') {
      const cards = ids.map((id) => {
        const card = player.hand.find((c) => c.instanceId === id);
        if (!card || id === sourceInstanceId)
          return invalid(`${id} is not another card in your hand.`);
        if (cost.filter) {
          const def = ctx.cardDefinitions(card.definitionId);
          if (!def || !matchesFilter(def, cost.filter))
            return invalid(`${id} does not match the cost filter.`);
        }
        return card;
      });
      steps.push({ kind: 'Discard', cards });
    } else {
      const cards = ids.map((id) => {
        const zone = player.board.monsterZones.findIndex((c) => c?.instanceId === id);
        const card = zone === -1 ? null : player.board.monsterZones[zone];
        if (!card) return invalid(`${id} is not a monster on your field.`);
        if (cost.filter) {
          const def = ctx.cardDefinitions(card.definitionId);
          if (!def || !matchesFilter(def, cost.filter))
            return invalid(`${id} does not match the cost filter.`);
        }
        return { card, zone };
      });
      steps.push({ kind: 'Tribute', cards });
    }
  }

  if (cursor !== costInstanceIds.length) {
    invalid(`${costInstanceIds.length - cursor} unused cost id(s).`);
  }
  return steps;
}

const toGraveyard = (c: CardInstance): CardInstance => ({
  instanceId: c.instanceId,
  definitionId: c.definitionId,
  ownerIndex: c.ownerIndex,
  position: null,
});

/** Applies a plan from `planCosts` for `playerIndex`. Events follow the plan order. */
export function payCosts(
  state: GameState,
  playerIndex: 0 | 1,
  steps: readonly CostStep[],
): { state: GameState; events: GameEvent[] } {
  let player: PlayerState = state.players[playerIndex];
  const events: GameEvent[] = [];

  for (const step of steps) {
    if (step.kind === 'PayLP') {
      player = { ...player, lifePoints: player.lifePoints - step.amount };
      events.push({ type: 'LifePointsPaid', playerIndex, amount: step.amount });
    } else if (step.kind === 'Discard') {
      const gone = new Set(step.cards.map((c) => c.instanceId));
      player = {
        ...player,
        hand: player.hand.filter((c) => !gone.has(c.instanceId)),
        graveyard: [...player.graveyard, ...step.cards.map(toGraveyard)],
      };
      for (const c of step.cards) {
        events.push({
          type: 'CardDiscarded',
          playerIndex,
          instanceId: c.instanceId,
          definitionId: c.definitionId,
        });
      }
    } else {
      const zones = new Set(step.cards.map((t) => t.zone));
      const monsterZones = player.board.monsterZones.map((slot, i) =>
        zones.has(i) ? null : slot,
      ) as unknown as PlayerState['board']['monsterZones'];
      player = {
        ...player,
        board: { ...player.board, monsterZones },
        graveyard: [...player.graveyard, ...step.cards.map((t) => toGraveyard(t.card))],
      };
      for (const t of step.cards) {
        events.push({
          type: 'MonsterTributed',
          ownerIndex: playerIndex,
          instanceId: t.card.instanceId,
          definitionId: t.card.definitionId,
          zoneIndex: t.zone,
        });
      }
    }
  }

  const players: [PlayerState, PlayerState] =
    playerIndex === 0 ? [player, state.players[1]] : [state.players[0], player];
  return { state: { ...state, players }, events };
}
