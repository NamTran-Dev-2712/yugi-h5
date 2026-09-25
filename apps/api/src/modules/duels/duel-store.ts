import { applyAction, type Action, type GameState, type StartDuelAction } from '@yugi/game-engine';

/** `solo-debug`: one guest drives both seats. `solo-vs-ai`: the guest plays one seat, the server plays the other. `pvp` comes later. */
export type DuelMode = 'solo-debug' | 'solo-vs-ai';

/** An action the engine ACCEPTED, with the state `version` it produced. Rejected actions are never logged. */
export interface LoggedAction {
  readonly playerIndex: 0 | 1;
  readonly action: Action;
  readonly version: number;
}

/**
 * Everything the server knows about one duel. Treated as immutable: every change saves a NEW object,
 * so a store may hand out references safely. `startAction` + `actionLog` (with the engine determinism)
 * are enough to replay the duel.
 */
export interface DuelSession {
  readonly duelId: string;
  /** Who may do what is decided from these two by `duel-access.ts`; absent = nobody (fail closed). */
  readonly mode?: DuelMode;
  readonly ownerId?: string;
  /** `solo-vs-ai` only: the seat the server plays. Missing in that mode = nobody may act (fail closed). */
  readonly aiSeat?: 0 | 1;
  readonly seed: string;
  /** How a normal duel began. Absent for a Sandbox scenario, which begins at `initialState` instead. */
  readonly startAction?: StartDuelAction;
  /** Sandbox scenario only (dev tool): the state the duel was loaded with; replay starts here. */
  readonly initialState?: GameState;
  readonly state: GameState;
  readonly actionLog: readonly LoggedAction[];
}

/** The state a replay of `actionLog` starts from: the loaded scenario state, or the result of `StartDuel`. */
export function initialStateOf(session: DuelSession): GameState {
  if (session.initialState) return session.initialState;
  if (session.startAction) return applyAction(null, session.startAction).state;
  throw new Error(`Duel ${session.duelId} has no starting point`);
}

/** Persistence seam: swap the in-memory Map for a DB/Redis implementation without touching DuelManager. */
export interface DuelStore {
  get(duelId: string): Promise<DuelSession | undefined>;
  save(session: DuelSession): Promise<void>;
  delete(duelId: string): Promise<void>;
}

export class InMemoryDuelStore implements DuelStore {
  private readonly sessions = new Map<string, DuelSession>();

  get(duelId: string): Promise<DuelSession | undefined> {
    return Promise.resolve(this.sessions.get(duelId));
  }

  save(session: DuelSession): Promise<void> {
    this.sessions.set(session.duelId, session);
    return Promise.resolve();
  }

  delete(duelId: string): Promise<void> {
    this.sessions.delete(duelId);
    return Promise.resolve();
  }
}
