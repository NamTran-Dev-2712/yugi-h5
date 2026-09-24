import type { PlayerAction } from './action-schema.js';
import type { EventView } from './event-view.js';
import type { PlayerIndex, StateView } from './state-view.js';

/**
 * Response bodies of the solo-debug HTTP endpoints (docs/design/protocol.md). Types only: the server builds them,
 * clients (apps/web) read them. Each response only ever carries ONE seat's view and events.
 */

export interface GuestResponse {
  readonly guestId: string;
  readonly accessToken: string;
}

export type SoloMode = 'solo-debug' | 'solo-vs-ai';

/**
 * One action the server played for the AI seat during this request (`solo-vs-ai` only). `eventsFrom`/`eventsTo` is the
 * half-open slice `[from, to)` of the response's `events` this action produced, so a client can animate turn by turn.
 * Public information only: the action carries instance ids, which the matching events already reveal.
 */
export interface AiActionView {
  readonly action: PlayerAction;
  readonly eventsFrom: number;
  readonly eventsTo: number;
}

/** `POST /duels/:id/actions` → the sender seat's view + that seat's filtered events. */
export interface ViewResponse {
  readonly view: StateView;
  /** Human events first, then those caused by the AI (see `aiActions`); all filtered for the view's seat. */
  readonly events: readonly EventView[];
  /** Actions the view's seat (`view.viewerIndex`) may submit now; ids/zones only, never a hidden definitionId. */
  readonly legalActions: readonly PlayerAction[];
  /** `solo-vs-ai` only: what the AI did after the caller's action, in order. Empty when the AI did not move. */
  readonly aiActions?: readonly AiActionView[];
}

/** `POST /duels/solo` */
export interface CreateSoloResponse extends ViewResponse {
  readonly duelId: string;
  readonly mode: SoloMode;
  readonly viewer: PlayerIndex;
  /** `solo-vs-ai` only: the seat the server plays. Never viewable or controllable by the caller. */
  readonly aiSeat?: PlayerIndex;
}

/** `GET /duels/:id?viewer=` */
export interface GetViewResponse {
  readonly view: StateView;
  /** Same meaning as `ViewResponse.legalActions` (seat = `view.viewerIndex`). */
  readonly legalActions: readonly PlayerAction[];
}

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Error body of every non-2xx answer. `code` is the stable machine code (`ACTION_REJECTED`, `NOT_OWNER`,
 * `VALIDATION_FAILED`, ...); `engineCode` is present for 409 `ACTION_REJECTED` (the engine's reason).
 */
export interface ApiErrorBody {
  readonly statusCode: number;
  readonly code?: string;
  readonly message?: string;
  readonly engineCode?: string;
  /** 400 `VALIDATION_FAILED`: what was wrong in the request. */
  readonly issues?: readonly ValidationIssue[];
}
