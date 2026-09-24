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

/** `POST /duels/:id/actions` → the sender seat's view + that seat's filtered events. */
export interface ViewResponse {
  readonly view: StateView;
  readonly events: readonly EventView[];
}

/** `POST /duels/solo` */
export interface CreateSoloResponse extends ViewResponse {
  readonly duelId: string;
  readonly mode: 'solo-debug';
  readonly viewer: PlayerIndex;
}

/** `GET /duels/:id?viewer=` */
export interface GetViewResponse {
  readonly view: StateView;
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
