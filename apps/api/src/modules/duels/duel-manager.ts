import { randomUUID } from 'node:crypto';
import {
  applyAction,
  EngineError,
  getLegalActions,
  type Action,
  type GameEvent,
  type GameState,
  type StartDuelAction,
} from '@yugi/game-engine';
import type {
  AiActionView,
  CardDefinition,
  EventView,
  PlayerAction,
  RulesetConfig,
  StateView,
} from '@yugi/shared';
import { MAX_AI_ACTIONS_PER_REQUEST } from './ai/ai-config';
import { createAiRng } from './ai/ai-rng';
import { chooseAction, type AiPolicy } from './ai/choose-action';
import { DuelServiceError } from './duel-errors';
import { toEventViews } from './event-view';
import type { DuelMode, DuelSession, DuelStore } from './duel-store';
import type { DuelMeta } from './duel-access';
import { toStateView } from './state-view';

export interface CreateDuelConfig {
  readonly playerIds: readonly [string, string];
  /** Card definition ids in deck order (pre-shuffle), one list per player. */
  readonly deckLists: readonly [readonly string[], readonly string[]];
  readonly ruleset?: Partial<RulesetConfig>;
  readonly startingLP?: readonly [number, number];
  /** Tests/replays only; production leaves it out and the server picks one. */
  readonly seed?: string;
  /** Who may act/view (see `duel-access.ts`); a session without them is unreachable over HTTP. */
  readonly mode?: DuelMode;
  readonly ownerId?: string;
  /** Required for `solo-vs-ai`: the seat the server plays. */
  readonly aiSeat?: 0 | 1;
}

/** Sandbox load (dev tool): a state built by `scenarioToState` plus how to reach it over HTTP. */
export interface CreateDuelFromStateConfig {
  readonly state: GameState;
  readonly seed: string;
  readonly mode?: DuelMode;
  readonly ownerId?: string;
  readonly aiSeat?: 0 | 1;
  /** Applied in order (each action's own `playerIndex`) right after loading. */
  readonly script?: readonly PlayerAction[];
}

export interface CreateDuelResult {
  readonly duelId: string;
  /** Opening state per seat (already filtered: index i is what player i may see). */
  readonly views: readonly [StateView, StateView];
  /** Opening events (`DuelStarted` + opening `CardDrawn`s) already filtered per viewer. */
  readonly eventsByViewer: readonly [readonly EventView[], readonly EventView[]];
  /** Opening legal actions per seat (index i = what seat i may submit now). */
  readonly legalActionsByViewer: readonly [readonly PlayerAction[], readonly PlayerAction[]];
  /**
   * `solo-vs-ai` when the AI moved first: what it did, as slices of `eventsByViewer[human seat]`
   * (the opening events come before the first slice).
   */
  readonly aiActions?: readonly AiActionView[];
}

export interface DuelManagerOptions {
  readonly store: DuelStore;
  /** Pure lookup used both to validate decks and as the engine ctx.cardDefinitions. */
  readonly cardDefinitions: (definitionId: string) => CardDefinition | undefined;
  readonly newDuelId?: () => string;
  readonly newSeed?: () => string;
  /** The AI brain for `solo-vs-ai`; tests inject fakes. Default: the rule-based `chooseAction`. */
  readonly aiPolicy?: AiPolicy;
  /** Hard cap on AI actions inside one request (loop guard). Default `MAX_AI_ACTIONS_PER_REQUEST`. */
  readonly maxAiActionsPerRequest?: number;
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
  /** What the SENDER seat may submit next (state after this action). */
  readonly legalActions: readonly PlayerAction[];
  /**
   * `solo-vs-ai`: the actions the AI played after this one, in order; `eventsFrom`/`eventsTo` slice `events`
   * (the sender's filtered events; the AI's come after the sender's own). `[]` when the AI did not move.
   */
  readonly aiActions: readonly AiActionView[];
}

/** One AI action already applied and saved. */
interface AiStep {
  readonly action: PlayerAction;
  readonly events: readonly GameEvent[];
}

/** Who has to act now: the prompted player if a prompt is pending, else the turn player. */
/**
 * Engine actions (task 3.2) that the wire contract (`PlayerActionSchema`), the event view and the web client do not
 * support yet — task 3.2b wires them. Never listed in `legalActions`, refused if submitted.
 */
const ENGINE_ONLY_ACTIONS: ReadonlySet<Action['type']> = new Set([
  'SetSpellTrap',
  'ActivateEffect',
]);

const actorOf = (state: GameState): 0 | 1 =>
  state.pendingPrompt?.playerIndex ?? state.turnPlayerIndex;

/**
 * Framework-free duel loop: holds sessions in a `DuelStore`, validates who may act, runs the engine and
 * stores the result. Actions on one duel run strictly one at a time (see `runExclusive`).
 */
export class DuelManager {
  private readonly store: DuelStore;
  private readonly cardDefinitions: DuelManagerOptions['cardDefinitions'];
  private readonly newDuelId: () => string;
  private readonly newSeed: () => string;
  private readonly aiPolicy: AiPolicy;
  private readonly maxAiActions: number;
  /** Tail of the pending-work chain per duel; this is the mutex. */
  private readonly tails = new Map<string, Promise<void>>();

  constructor(options: DuelManagerOptions) {
    this.store = options.store;
    this.cardDefinitions = options.cardDefinitions;
    this.newDuelId = options.newDuelId ?? randomUUID;
    this.newSeed = options.newSeed ?? randomUUID;
    this.aiPolicy = options.aiPolicy ?? chooseAction;
    this.maxAiActions = options.maxAiActionsPerRequest ?? MAX_AI_ACTIONS_PER_REQUEST;
  }

  async createDuel(config: CreateDuelConfig): Promise<CreateDuelResult> {
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
    let events: GameEvent[];
    try {
      ({ state, events } = applyAction(null, startAction));
    } catch (e) {
      if (e instanceof EngineError) throw new DuelServiceError('INVALID_CONFIG', e.message);
      throw new DuelServiceError('INTERNAL_ERROR', 'Failed to start the duel.');
    }
    const session: DuelSession = {
      duelId,
      ...(config.mode !== undefined ? { mode: config.mode } : {}),
      ...(config.ownerId !== undefined ? { ownerId: config.ownerId } : {}),
      ...(config.aiSeat !== undefined ? { aiSeat: config.aiSeat } : {}),
      seed,
      startAction,
      state,
      actionLog: [],
    };
    await this.store.save(session);
    // The AI may hold the first seat: let it play before anyone sees the duel. Same lock as any other change.
    return this.runExclusive(duelId, () => this.openingResult(session, events));
  }

  /**
   * Sandbox (dev tool): opens a duel on a state built elsewhere (`scenarioToState`) instead of `StartDuel`; the duel
   * id is the state's `matchId`. The optional `script` is applied in order through `applyAndSave` (the normal engine
   * path); one refused step fails the whole load and removes the session. Replay starts from `initialState`.
   */
  async createDuelFromState(config: CreateDuelFromStateConfig): Promise<CreateDuelResult> {
    const duelId = config.state.matchId;
    const loaded: DuelSession = {
      duelId,
      ...(config.mode !== undefined ? { mode: config.mode } : {}),
      ...(config.ownerId !== undefined ? { ownerId: config.ownerId } : {}),
      ...(config.aiSeat !== undefined ? { aiSeat: config.aiSeat } : {}),
      seed: config.seed,
      initialState: config.state,
      state: config.state,
      actionLog: [],
    };
    await this.store.save(loaded);
    return this.runExclusive(duelId, async () => {
      let session = loaded;
      const events: GameEvent[] = [];
      for (const [i, action] of (config.script ?? []).entries()) {
        try {
          const applied = await this.applyAndSave(
            session,
            action.payload.playerIndex,
            action as unknown as Action,
          );
          session = applied.session;
          events.push(...applied.events);
        } catch (e) {
          await this.store.delete(duelId);
          if (e instanceof DuelServiceError && e.code === 'ACTION_REJECTED') {
            throw new DuelServiceError(
              'ACTION_REJECTED',
              `Script step ${i + 1} (${action.type}) was refused: ${e.message}`,
              e.engineCode,
            );
          }
          throw e;
        }
      }
      return this.openingResult(session, events);
    });
  }

  /** Lets the AI move first when it holds the first seat, then builds what a new duel returns. Caller holds the lock. */
  private async openingResult(
    session: DuelSession,
    events: readonly GameEvent[],
  ): Promise<CreateDuelResult> {
    const driven = await this.driveAi(session);
    const finalState = driven.session.state;
    const eventsByViewer: [EventView[], EventView[]] = [
      toEventViews(events, 0),
      toEventViews(events, 1),
    ];
    let aiActions: AiActionView[] | undefined;
    if (driven.steps.length > 0 && session.aiSeat !== undefined) {
      const human = session.aiSeat === 0 ? 1 : 0;
      aiActions = this.appendAiSteps(eventsByViewer, driven.steps, human);
    }
    return {
      duelId: session.duelId,
      views: [toStateView(finalState, 0), toStateView(finalState, 1)],
      eventsByViewer,
      legalActionsByViewer: [
        this.legalActionsOf(finalState, 0),
        this.legalActionsOf(finalState, 1),
      ],
      ...(aiActions ? { aiActions } : {}),
    };
  }

  /**
   * Appends the AI steps' events to both viewers' lists (viewer order preserved) and returns the slices they
   * occupy in `human`'s list.
   */
  private appendAiSteps(
    eventsByViewer: [EventView[], EventView[]],
    steps: readonly AiStep[],
    human: 0 | 1,
  ): AiActionView[] {
    const out: AiActionView[] = [];
    for (const step of steps) {
      const eventsFrom = eventsByViewer[human].length;
      eventsByViewer[0].push(...toEventViews(step.events, 0));
      eventsByViewer[1].push(...toEventViews(step.events, 1));
      out.push({ action: step.action, eventsFrom, eventsTo: eventsByViewer[human].length });
    }
    return out;
  }

  submitAction(duelId: string, playerIndex: 0 | 1, action: Action): Promise<SubmitActionResult> {
    // State-independent checks first: they must not queue behind other work.
    if (
      action.type === 'StartDuel' ||
      action.type === 'Draw' ||
      ENGINE_ONLY_ACTIONS.has(action.type)
    ) {
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
      // In `solo-vs-ai` the AI seat is the server's: nobody else may act for it (duel-access checks this too).
      if (session.mode === 'solo-vs-ai' && playerIndex === session.aiSeat) {
        throw new DuelServiceError('NOT_OWNER', 'The AI seat cannot be controlled by a caller.');
      }
      const applied = await this.applyAndSave(session, playerIndex, action);
      const driven = await this.driveAi(applied.session);
      const eventsByViewer: [EventView[], EventView[]] = [
        toEventViews(applied.events, 0),
        toEventViews(applied.events, 1),
      ];
      const aiActions = this.appendAiSteps(eventsByViewer, driven.steps, playerIndex);
      const finalState = driven.session.state;
      return {
        view: toStateView(finalState, playerIndex),
        events: eventsByViewer[playerIndex],
        eventsByViewer,
        legalActions: this.legalActionsOf(finalState, playerIndex),
        aiActions,
      };
    });
  }

  /**
   * The ONE place a duel changes: runs the engine, logs the accepted action, saves. Player actions and AI actions both
   * come through here (caller holds the duel lock). Reject/unexpected error ⇒ nothing saved.
   */
  private async applyAndSave(
    session: DuelSession,
    playerIndex: 0 | 1,
    action: Action,
  ): Promise<{ session: DuelSession; events: GameEvent[] }> {
    let result: { state: GameState; events: GameEvent[] };
    try {
      result = applyAction(session.state, action, { cardDefinitions: this.cardDefinitions });
    } catch (e) {
      if (e instanceof EngineError) {
        throw new DuelServiceError('ACTION_REJECTED', e.message, e.code);
      }
      throw new DuelServiceError('INTERNAL_ERROR', 'Unexpected error while applying the action.');
    }
    const next: DuelSession = {
      ...session,
      state: result.state,
      actionLog: [...session.actionLog, { playerIndex, action, version: result.state.version }],
    };
    await this.store.save(next);
    return { session: next, events: result.events };
  }

  /**
   * `solo-vs-ai`: while the AI is the one to act (turn player, or the player a pending prompt waits for), ask the policy
   * — which sees only the AI seat's StateView and legal actions — and apply its answer through `applyAndSave`.
   * Runs inside the caller's duel lock, so no other request interleaves. Bounded by `maxAiActions`; hitting the cap
   * throws AI_LOOP_LIMIT and leaves the duel in the (valid, saved) state reached so far.
   */
  private async driveAi(
    start: DuelSession,
  ): Promise<{ session: DuelSession; steps: readonly AiStep[] }> {
    const aiSeat = start.aiSeat;
    if (start.mode !== 'solo-vs-ai' || aiSeat === undefined) return { session: start, steps: [] };
    let session = start;
    const steps: AiStep[] = [];
    while (session.state.winnerIndex === null && actorOf(session.state) === aiSeat) {
      if (steps.length >= this.maxAiActions) {
        throw new DuelServiceError(
          'AI_LOOP_LIMIT',
          `The AI exceeded ${this.maxAiActions} actions in one request.`,
        );
      }
      let action: PlayerAction;
      try {
        action = this.aiPolicy({
          view: toStateView(session.state, aiSeat),
          legalActions: this.legalActionsOf(session.state, aiSeat),
          cardDefinitions: this.cardDefinitions,
          rng: createAiRng(`${session.seed}:ai:${session.actionLog.length}`),
        });
      } catch {
        throw new DuelServiceError('INTERNAL_ERROR', 'The AI could not choose an action.');
      }
      // The AI never gives up, whatever the policy says.
      if (action.type === 'Surrender') {
        throw new DuelServiceError('INTERNAL_ERROR', 'The AI tried to surrender.');
      }
      let applied: { session: DuelSession; events: GameEvent[] };
      try {
        applied = await this.applyAndSave(session, aiSeat, action as unknown as Action);
      } catch (e) {
        // The engine refusing the AI's own move is a server bug, not the human's mistake (no 409 for them).
        if (e instanceof DuelServiceError && e.code === 'ACTION_REJECTED') {
          throw new DuelServiceError('INTERNAL_ERROR', 'The AI chose an illegal action.');
        }
        throw e;
      }
      session = applied.session;
      steps.push({ action, events: applied.events });
    }
    return { session, steps };
  }

  async getView(duelId: string, viewerIndex: 0 | 1): Promise<StateView> {
    const session = await this.requireSession(duelId);
    return toStateView(session.state, viewerIndex);
  }

  /** What `seat` may submit now: candidates filtered by the engine's own validators (see `getLegalActions`). */
  async getLegalActions(duelId: string, seat: 0 | 1): Promise<readonly PlayerAction[]> {
    const session = await this.requireSession(duelId);
    return this.legalActionsOf(session.state, seat);
  }

  private legalActionsOf(state: GameState, seat: 0 | 1): PlayerAction[] {
    const actions = getLegalActions(state, seat, { cardDefinitions: this.cardDefinitions });
    // The engine never lists StartDuel/Draw; the filter narrows the type to the wire shape (PlayerActionSchema).
    // SetSpellTrap/ActivateEffect (task 3.2) are engine-only until task 3.2b adds them to the wire schema, the
    // event view and the web client: hiding them keeps HTTP, the AI and the UI from ever reaching the new prompt.
    return actions.filter((a) => !ENGINE_ONLY_ACTIONS.has(a.type)) as unknown as PlayerAction[];
  }

  /** Who owns the duel and in which mode; no game state, safe for access checks. */
  async getMeta(duelId: string): Promise<DuelMeta> {
    const { mode, ownerId, aiSeat } = await this.requireSession(duelId);
    return {
      ...(mode !== undefined ? { mode } : {}),
      ...(ownerId !== undefined ? { ownerId } : {}),
      ...(aiSeat !== undefined ? { aiSeat } : {}),
    };
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
