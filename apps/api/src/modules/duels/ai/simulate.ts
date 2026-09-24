import {
  applyAction,
  EngineError,
  getLegalActions,
  type Action,
  type ActionContext,
  type GameState,
} from '@yugi/game-engine';
import { STARTER_DECK, type PlayerAction } from '@yugi/shared';
import { lookupCard } from '../card-pool';
import { toStateView } from '../state-view';
import { createAiRng } from './ai-rng';
import { chooseAction, type AiPolicy } from './choose-action';

/**
 * Test/tool support: plays whole duels between two policies straight on the engine (no HTTP, no store), giving each
 * policy exactly what the server gives the AI — its own StateView and its legal actions. Used by the simulation and
 * strength specs; not part of the server.
 */

const ctx: ActionContext = { cardDefinitions: lookupCard };

/** Uniformly random legal action, never Surrender (the weak baseline). */
export const randomPolicy: AiPolicy = ({ legalActions, rng }) => {
  const options = legalActions.filter((a) => a.type !== 'Surrender');
  return options[Math.floor(rng() * options.length)]!;
};

export interface SimOptions {
  readonly seed: string;
  /** Policy per seat. */
  readonly policies: readonly [AiPolicy, AiPolicy];
  readonly deck?: readonly string[];
  /** Safety valve: a game still running after this many actions counts as "stuck". */
  readonly maxActions?: number;
}

export interface SimResult {
  readonly seed: string;
  readonly winner: 0 | 1 | 'draw' | null;
  readonly turns: number;
  readonly actions: number;
  /** Actions the engine refused (must be 0: policies only pick from legalActions). */
  readonly rejected: number;
  readonly surrenders: number;
  readonly stuck: boolean;
}

export function simulate(options: SimOptions): SimResult {
  const deck = options.deck ?? STARTER_DECK;
  const maxActions = options.maxActions ?? 4000;
  let state: GameState = applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: `sim-${options.seed}`,
      seed: options.seed,
      playerIds: ['sim-a', 'sim-b'],
      deckLists: [deck, deck],
    },
  }).state;
  let actions = 0;
  let rejected = 0;
  let surrenders = 0;
  while (state.winnerIndex === null && actions < maxActions) {
    const seat = state.pendingPrompt?.playerIndex ?? state.turnPlayerIndex;
    const legal = getLegalActions(state, seat, ctx).filter(
      (a) => a.type !== 'StartDuel' && a.type !== 'Draw',
    ) as unknown as PlayerAction[];
    const action = options.policies[seat]({
      view: toStateView(state, seat),
      legalActions: legal,
      cardDefinitions: lookupCard,
      rng: createAiRng(`${options.seed}:${seat}:${actions}`),
    });
    if (action.type === 'Surrender') surrenders++;
    try {
      state = applyAction(state, action as unknown as Action, ctx).state;
    } catch (e) {
      if (!(e instanceof EngineError)) throw e;
      rejected++;
      break;
    }
    actions++;
  }
  return {
    seed: options.seed,
    winner: state.winnerIndex,
    turns: state.turnCount,
    actions,
    rejected,
    surrenders,
    stuck: state.winnerIndex === null,
  };
}

export interface SimSummary {
  readonly games: number;
  readonly finished: number;
  readonly stuck: number;
  readonly rejected: number;
  readonly surrenders: number;
  readonly meanTurns: number;
  readonly meanActions: number;
  /** Wins per seat (draws not counted). */
  readonly seatWins: readonly [number, number];
  readonly draws: number;
}

export function summarize(results: readonly SimResult[]): SimSummary {
  const seatWins: [number, number] = [0, 0];
  let draws = 0;
  for (const r of results) {
    if (r.winner === 0) seatWins[0]++;
    else if (r.winner === 1) seatWins[1]++;
    else if (r.winner === 'draw') draws++;
  }
  const n = Math.max(1, results.length);
  return {
    games: results.length,
    finished: results.filter((r) => !r.stuck).length,
    stuck: results.filter((r) => r.stuck).length,
    rejected: results.reduce((s, r) => s + r.rejected, 0),
    surrenders: results.reduce((s, r) => s + r.surrenders, 0),
    meanTurns: results.reduce((s, r) => s + r.turns, 0) / n,
    meanActions: results.reduce((s, r) => s + r.actions, 0) / n,
    seatWins,
    draws,
  };
}

export { chooseAction };
