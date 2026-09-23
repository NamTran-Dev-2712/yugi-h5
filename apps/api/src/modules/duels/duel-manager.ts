import { randomUUID } from 'node:crypto';
import {
  applyAction,
  EngineError,
  type Action,
  type GameEvent,
  type GameState,
  type StartDuelAction,
} from '@yugi/game-engine';
import type { CardDefinition, EventView, RulesetConfig, StateView } from '@yugi/shared';
import { DuelServiceError } from './duel-errors';
import { toEventViews } from './event-view';
import type { DuelSession, DuelStore } from './duel-store';
import { toStateView } from './state-view';

export interface CreateDuelConfig {
  readonly playerIds: readonly [string, string];
  /** Card definition ids in deck order (pre-shuffle), one list per player. */
  readonly deckLists: readonly [readonly string[], readonly string[]];
  readonly ruleset?: Partial<RulesetConfig>;
  readonly startingLP?: readonly [number, number];
  /** Tests/replays only; production leaves it out and the server picks one. */
  readonly seed?: string;
}

export interface DuelManagerOptions {
  readonly store: DuelStore;
  /** Pure lookup used both to validate decks and as the engine ctx.cardDefinitions. */
  readonly cardDefinitions: (definitionId: string) => CardDefinition | undefined;
  readonly newDuelId?: () => string;
  readonly newSeed?: () => string;
}

export interface SubmitActionResult {
  /** The SENDER view (never the opponent view). */
  readonly view: StateView;
  /** The events the SENDER may see (same array as `eventsByViewer[sender]`). */
  readonly events: readonly EventView[];
  /**
   * Events already filtered per viewer, indexed by player: forward `eventsByViewer[i]` to player i only.
   * The engine raw events never leave this class.
   */
  readonly eventsByViewer: readonly [readonly EventView[], readonly EventView[]];
}

/**
 * Framework-free duel loop: holds sessions in a `DuelStore`, validates who may act, runs the engine and
 * stores the result. Actions on one duel run strictly one at a time (see `runExclusive`).
 */
export class DuelManager {
  private readonly store: DuelStore;
  private readonly cardDefinitions: DuelManagerOptions['cardDefinitions'];
  private readonly newDuelId: () => string;
  private readonly newSeed: () => string;
  /** Tail of the pending-work chain per duel; this is the mutex. */
  private readonly tails = new Map<string, Promise<void>>();

  constructor(options: DuelManagerOptions) {
    this.store = options.store;
    this.cardDefinitions = options.cardDefinitions;
    this.newDuelId = options.newDuelId ?? randomUUID;
    this.newSeed = options.newSeed ?? randomUUID;
  }

  async createDuel(config: CreateDuelConfig): Promise<{ duelId: string }> {
    this.validateConfig(config);
    const duelId = this.newDuelId();
    const seed = config.seed ?? this.newSeed();
    const startAction: StartDuelAction = {
      type: 'StartDuel',
      payload: {
        matchId: duelId,
        seed,
        playerIds: config.playerIds,
        deckLists: config.deckLists,
        ...(config.ruleset ? { ruleset: config.ruleset } : {}),
        ...(config.startingLP ? { startingLP: config.startingLP } : {}),
      },
    };
    let state: GameState;
    try {
      state = applyAction(null, startAction).state;
    } catch (e) {
      if (e instanceof EngineError) throw new DuelServiceError('INVALID_CONFIG', e.message);
      throw new DuelServiceError('INTERNAL_ERROR', 'Failed to start the duel.');
    }
    await this.store.save({ duelId, seed, startAction, state, actionLog: [] });
    return { duelId };
  }

  submitAction(duelId: string, playerIndex: 0 | 1, action: Action): Promise<SubmitActionResult> {
    // State-independent checks first: they must not queue behind other work.
    if (action.type === 'StartDuel' || action.type === 'Draw') {
      return Promise.reject(
        new DuelServiceError(
          'FORBIDDEN_ACTION',
          `Action "${action.type}" cannot be sent by a player.`,
        ),
      );
    }
    if (action.payload.playerIndex !== playerIndex) {
      return Promise.reject(
        new DuelServiceError('PLAYER_MISMATCH', 'Action playerIndex does not match the caller.'),
      );
    }
    return this.runExclusive(duelId, async () => {
      const session = await this.requireSession(duelId);
      let result: { state: GameState; events: GameEvent[] };
      try {
        result = applyAction(session.state, action, { cardDefinitions: this.cardDefinitions });
      } catch (e) {
        if (e instanceof EngineError) {
          throw new DuelServiceError('ACTION_REJECTED', e.message, e.code);
        }
        throw new DuelServiceError('INTERNAL_ERROR', 'Unexpected error while applying the action.');
      }
      await this.store.save({
        ...session,
        state: result.state,
        actionLog: [...session.actionLog, { playerIndex, action, version: result.state.version }],
      });
      const eventsByViewer = [
        toEventViews(result.events, 0),
        toEventViews(result.events, 1),
      ] as const;
      return {
        view: toStateView(result.state, playerIndex),
        events: eventsByViewer[playerIndex],
        eventsByViewer,
      };
    });
  }

  async getView(duelId: string, viewerIndex: 0 | 1): Promise<StateView> {
    const session = await this.requireSession(duelId);
    return toStateView(session.state, viewerIndex);
  }

  /** INTERNAL: the raw session (full GameState). Never return this to a client; use `getView`. */
  getDuel(duelId: string): Promise<DuelSession> {
    return this.requireSession(duelId);
  }

  closeDuel(duelId: string): Promise<void> {
    return this.runExclusive(duelId, async () => {
      await this.requireSession(duelId);
      await this.store.delete(duelId);
    });
  }

  private async requireSession(duelId: string): Promise<DuelSession> {
    const session = await this.store.get(duelId);
    if (!session) throw new DuelServiceError('DUEL_NOT_FOUND', `Duel "${duelId}" does not exist.`);
    return session;
  }

  /** Runs `task` after everything already queued for this duel; a failing task never wedges the queue. */
  private runExclusive<T>(duelId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(duelId) ?? Promise.resolve();
    const run = previous.then(task);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(duelId, tail);
    void tail.then(() => {
      if (this.tails.get(duelId) === tail) this.tails.delete(duelId);
    });
    return run;
  }

  private validateConfig(config: CreateDuelConfig): void {
    const { playerIds, deckLists } = config;
    if (
      !Array.isArray(playerIds) ||
      playerIds.length !== 2 ||
      playerIds.some((id) => typeof id !== 'string' || id === '')
    ) {
      throw new DuelServiceError('INVALID_CONFIG', 'playerIds must be two non-empty strings.');
    }
    if (
      !Array.isArray(deckLists) ||
      deckLists.length !== 2 ||
      deckLists.some((d) => !Array.isArray(d) || d.length === 0)
    ) {
      throw new DuelServiceError('INVALID_CONFIG', 'deckLists must be two non-empty arrays.');
    }
    for (const id of deckLists.flat()) {
      if (!this.cardDefinitions(id)) {
        throw new DuelServiceError('UNKNOWN_CARD', `Unknown card definition "${id}".`);
      }
    }
  }
}
