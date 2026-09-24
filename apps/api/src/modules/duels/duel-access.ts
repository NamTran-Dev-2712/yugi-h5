import { DuelServiceError } from './duel-errors';
import type { DuelMode } from './duel-store';

/** What the access rules need to know about a duel. Missing fields mean "deny" (fail closed). */
export interface DuelMeta {
  readonly mode?: DuelMode;
  readonly ownerId?: string;
  readonly aiSeat?: 0 | 1;
}

/**
 * The single place that maps a caller (guest id) to the seats (playerIndex) it may act as or look at.
 * `solo-debug`: the guest that created the duel owns both seats. `solo-vs-ai`: the guest owns only the seat the AI does
 * NOT play — the AI seat can be neither controlled nor viewed (no peeking at the AI hand). Future modes (`pvp`) add a
 * branch here; controllers never decide this themselves.
 */
function ownedSeats(meta: DuelMeta, guestId: string): readonly (0 | 1)[] {
  if (meta.ownerId === undefined || meta.ownerId !== guestId) return [];
  switch (meta.mode) {
    case 'solo-debug':
      return [0, 1];
    case 'solo-vs-ai':
      return meta.aiSeat === undefined ? [] : [meta.aiSeat === 0 ? 1 : 0];
    default:
      return [];
  }
}

export function assertMayControl(meta: DuelMeta, guestId: string, playerIndex: 0 | 1): void {
  if (!ownedSeats(meta, guestId).includes(playerIndex)) {
    throw new DuelServiceError('NOT_OWNER', 'You do not control this seat of the duel.');
  }
}

export function assertMayView(meta: DuelMeta, guestId: string, viewerIndex: 0 | 1): void {
  if (!ownedSeats(meta, guestId).includes(viewerIndex)) {
    throw new DuelServiceError('NOT_OWNER', 'You cannot view this seat of the duel.');
  }
}

/** Engine `playerIds` for a new duel of `mode` owned by `ownerId` (the AI seat is named `<owner>:ai`). */
export function playerIdsFor(
  mode: DuelMode,
  ownerId: string,
  aiSeat?: 0 | 1,
): readonly [string, string] {
  switch (mode) {
    case 'solo-debug':
      return [`${ownerId}:0`, `${ownerId}:1`];
    case 'solo-vs-ai':
      return aiSeat === 0 ? [`${ownerId}:ai`, ownerId] : [ownerId, `${ownerId}:ai`];
  }
}
