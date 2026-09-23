import type { Action, GameState, StartDuelAction } from '@yugi/game-engine';

/** `solo-debug`: one guest drives both seats (no AI yet). `solo-vs-ai` and `pvp` come later. */
export type DuelMode = 'solo-debug';

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
  readonly seed: string;
  readonly startAction: StartDuelAction;
  readonly state: GameState;
  readonly actionLog: readonly LoggedAction[];
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
