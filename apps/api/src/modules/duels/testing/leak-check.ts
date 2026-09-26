import type { CardInstance, GameState } from '@yugi/game-engine';

/**
 * Test-only oracle for the "no hidden definitionId reaches the wrong viewer" invariant (task 3.2b gate).
 *
 * It walks ANY JSON a viewer receives (view, events, legalActions, prompt…) without knowing its shape, collects every
 * object that carries a `definitionId`, and checks each against the raw server state AFTER the action:
 *  - the card must exist and carry that very definitionId;
 *  - it may be shown only if it is in a graveyard/banished (public), face-up on the field, or the viewer's own card in
 *    hand or on the field (face-down included). A card in a deck or Extra Deck is never shown, not even to its owner;
 *  - a `definitionId` without an `instanceId` next to it is flagged too (it cannot be checked, so it is not allowed).
 * Knowing nothing about the wire shape is the point: a new field that smuggles a card identity is caught as well.
 */

export interface LeakViolation {
  readonly viewer: 0 | 1;
  readonly path: string;
  readonly instanceId: string | null;
  readonly definitionId: string;
  readonly reason: string;
}

type Place =
  | { zone: 'deck' | 'extraDeck' | 'hand' | 'graveyard' | 'banished'; card: CardInstance }
  | { zone: 'field'; card: CardInstance };

function locate(state: GameState, instanceId: string): Place | null {
  for (const p of state.players) {
    for (const zone of ['deck', 'extraDeck', 'hand', 'graveyard', 'banished'] as const) {
      const card = p[zone].find((c) => c.instanceId === instanceId);
      if (card) return { zone, card };
    }
    for (const card of [...p.board.monsterZones, ...p.board.spellTrapZones, p.board.fieldZone]) {
      if (card?.instanceId === instanceId) return { zone: 'field', card };
    }
  }
  return null;
}

interface Pair {
  readonly path: string;
  readonly instanceId: string | null;
  readonly definitionId: string;
}

/** Every object (at any depth) that has a string `definitionId`, with the `instanceId` next to it if any. */
export function collectDefinitionIds(value: unknown, path = '$'): Pair[] {
  const out: Pair[] = [];
  const walk = (v: unknown, p: string): void => {
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${p}[${i}]`));
      return;
    }
    if (typeof v !== 'object' || v === null) return;
    const rec = v as Record<string, unknown>;
    if (typeof rec['definitionId'] === 'string') {
      out.push({
        path: p,
        instanceId: typeof rec['instanceId'] === 'string' ? rec['instanceId'] : null,
        definitionId: rec['definitionId'],
      });
    }
    for (const [k, child] of Object.entries(rec)) walk(child, `${p}.${k}`);
  };
  walk(value, path);
  return out;
}

function reasonToHide(place: Place | null, viewer: 0 | 1): string | null {
  if (place === null) return 'unknown instance';
  const { zone, card } = place;
  switch (zone) {
    case 'deck':
    case 'extraDeck':
      return `card is in a ${zone}`;
    case 'graveyard':
    case 'banished':
      return null;
    case 'hand':
      return card.ownerIndex === viewer ? null : "card is in the opponent's hand";
    case 'field':
      return card.ownerIndex === viewer || card.position !== 'DefenseDown'
        ? null
        : 'card is face-down on the opponent field';
  }
}

/** All violations in `payload` (whatever the viewer received) against the raw state after the action. */
export function findLeaks(state: GameState, viewer: 0 | 1, payload: unknown): LeakViolation[] {
  const violations: LeakViolation[] = [];
  for (const pair of collectDefinitionIds(payload)) {
    const fail = (reason: string) => violations.push({ viewer, ...pair, reason });
    if (pair.instanceId === null) {
      fail('definitionId without instanceId');
      continue;
    }
    const place = locate(state, pair.instanceId);
    if (place !== null && place.card.definitionId !== pair.definitionId) {
      fail(`wrong definitionId (server has ${place.card.definitionId})`);
      continue;
    }
    const reason = reasonToHide(place, viewer);
    if (reason !== null) fail(reason);
  }
  return violations;
}
