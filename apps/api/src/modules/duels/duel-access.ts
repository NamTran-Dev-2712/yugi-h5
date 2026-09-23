import { DuelServiceError } from './duel-errors';
import type { DuelMode } from './duel-store';

/** What the access rules need to know about a duel. Missing fields mean "deny" (fail closed). */
export interface DuelMeta {
  readonly mode?: DuelMode;
  readonly ownerId?: string;
}

/**
 * The single place that maps a caller (guest id) to the seats (playerIndex) it may act as or look at.
 * `solo-debug` (no AI yet): the guest that created the duel owns both seats. Future modes (`solo-vs-ai`, `pvp`)
 * add a branch here; controllers never decide this themselves.
 */
function ownedSeats(meta: DuelMeta, guestId: string): readonly (0 | 1)[] {
  if (meta.mode === 'solo-debug' && meta.ownerId !== undefined && meta.ownerId === guestId) {
    return [0, 1];
  }
  return [];
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

/** Engine `playerIds` for a new duel of `mode` owned by `ownerId`. */
export function playerIdsFor(mode: DuelMode, ownerId: string): readonly [string, string] {
  switch (mode) {
    case 'solo-debug':
      return [`${ownerId}:0`, `${ownerId}:1`];
  }
}
