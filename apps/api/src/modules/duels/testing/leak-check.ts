import type { CardInstance, GameState } from '@yugi/game-engine';

/**
 * Test-only oracle for the "no hidden definitionId reaches the wrong viewer" invariant (task 3.2b gate).
 *
 * It walks ANY JSON a viewer receives (view, events, legalActions, prompt…) without knowing its shape, collects every
 * object that carries a `definitionId`, and checks each against the raw server state AFTER the action:
 *  - the card must exist and carry that very definitionId;
 *  - it may be shown only if it is in a graveyard/banished/a chain link (public), face-up on the field, or the viewer's own card in
 *    hand or on the field (face-down included). A card in a deck or Extra Deck is never shown, not even to its owner;
 *  - a `definitionId` without an `instanceId` next to it is flagged too (it cannot be checked, so it is not allowed).
 * Knowing nothing about the wire shape is the point: a new field that smuggles a card identity is caught as well.
 * Task 4.3b: the Field Zone is a field zone like the others here (a face-down Field Spell is hidden from the opponent
 * wherever its definitionId shows up), and a face-down Set event (`MonsterSet` / `SpellTrapSet` / `FieldSpellSet`) that
 * carries a `definitionId` is flagged for BOTH seats (one more rule; none was relaxed).
 * Task 4.4b: an id-only event (`AttackNegated`) that names a card anywhere inside it is flagged for BOTH seats too (one
 * more rule; none was relaxed). `ChainLinkNegated` / `SummonNegated` carry a `definitionId` + `instanceId` and are checked
 * by the rules above like any other pair.
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
  | { zone: 'field'; card: CardInstance }
  /** Task 3.4b: a card activated from the hand lives in its chain link until it resolves — public (it was revealed). */
  | { zone: 'chain'; card: CardInstance };

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
  // Only a card found nowhere else: a Set card's link holds a copy of the card still in its zone.
  const link = state.chainStack.find((l) => l.card.instanceId === instanceId);
  if (link) return { zone: 'chain', card: link.card };
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
    case 'chain':
      return null;
    case 'hand':
      return card.ownerIndex === viewer ? null : "card is in the opponent's hand";
    case 'field':
      return card.ownerIndex === viewer || card.position !== 'DefenseDown'
        ? null
        : 'card is face-down on the opponent field';
  }
}

/** A key naming instance ids that POINT at cards (targets, costs, answers…); `instanceId` itself is excluded. */
const POINTER_KEY = /InstanceIds?$/;

/**
 * Task 4.2d: every id under a pointer key (`targetInstanceIds`, `cardInstanceIds`, `targetInstanceId`…, any depth), and
 * every `equippedTo`. The plain `instanceId` of a hidden card is fine (the view lists the opponent's hand that way); what
 * leaks is a list that singles out one of them.
 */
function collectPointers(value: unknown): {
  ids: { path: string; id: string }[];
  equips: { path: string; owner: Record<string, unknown>; id: string }[];
} {
  const ids: { path: string; id: string }[] = [];
  const equips: { path: string; owner: Record<string, unknown>; id: string }[] = [];
  const walk = (v: unknown, p: string): void => {
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${p}[${i}]`));
      return;
    }
    if (typeof v !== 'object' || v === null) return;
    const rec = v as Record<string, unknown>;
    for (const [k, child] of Object.entries(rec)) {
      if (k === 'equippedTo' && typeof child === 'string') {
        equips.push({ path: `${p}.${k}`, owner: rec, id: child });
      } else if (k !== 'instanceId' && POINTER_KEY.test(k)) {
        if (typeof child === 'string') ids.push({ path: `${p}.${k}`, id: child });
        if (Array.isArray(child)) {
          child.forEach((id, i) => {
            if (typeof id === 'string') ids.push({ path: `${p}.${k}[${i}]`, id });
          });
        }
      }
      walk(child, `${p}.${k}`);
    }
  };
  walk(value, '$');
  return { ids, equips };
}

/** Where a pointed-at id must not be for `viewer`: the opponent's hand, or any deck / Extra Deck. */
function pointsAtHidden(place: Place | null, viewer: 0 | 1): boolean {
  if (place === null) return false;
  if (place.zone === 'deck' || place.zone === 'extraDeck') return true;
  return place.zone === 'hand' && place.card.ownerIndex !== viewer;
}

/** `equippedTo` may only sit on a face-up card and name a face-up monster in a Monster Zone. */
function equipProblem(state: GameState, owner: Record<string, unknown>, id: string): string | null {
  if (owner['hidden'] !== false || owner['position'] === 'DefenseDown') {
    return 'equippedTo on a card that is not face-up';
  }
  for (const p of state.players) {
    const m = p.board.monsterZones.find((c) => c?.instanceId === id);
    if (m) return m.position === 'DefenseDown' ? 'equippedTo names a face-down monster' : null;
  }
  return 'equippedTo names a card that is not a monster on the field';
}

/** Events that tell "a card was Set face-down": they never carry the card's identity, for either seat. */
const SET_EVENT_TYPES: ReadonlySet<string> = new Set([
  'MonsterSet',
  'SpellTrapSet',
  'FieldSpellSet',
]);

/**
 * Task 4.3b: every object (any depth) typed as a face-down Set event that also has a `definitionId` key. The owner knows
 * the card, but the event is the same object for both seats, so the key itself is the leak.
 */
function collectNamedSetEvents(value: unknown): Pair[] {
  const out: Pair[] = [];
  const walk = (v: unknown, p: string): void => {
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${p}[${i}]`));
      return;
    }
    if (typeof v !== 'object' || v === null) return;
    const rec = v as Record<string, unknown>;
    if (
      typeof rec['type'] === 'string' &&
      SET_EVENT_TYPES.has(rec['type']) &&
      'definitionId' in rec
    ) {
      out.push({
        path: p,
        instanceId: typeof rec['instanceId'] === 'string' ? rec['instanceId'] : null,
        definitionId: String(rec['definitionId']),
      });
    }
    for (const [k, child] of Object.entries(rec)) walk(child, `${p}.${k}`);
  };
  walk(value, '$');
  return out;
}

/**
 * Events that only point at cards by id (task 4.4b): an attack may aim at a face-down monster, so the event never names
 * a card — not on itself and not in anything nested under it, for either seat.
 */
const ID_ONLY_EVENT_TYPES: ReadonlySet<string> = new Set(['AttackNegated']);

/** True when `value` (any depth) holds a `definitionId` key. */
function namesACard(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(namesACard);
  if (typeof value !== 'object' || value === null) return false;
  const rec = value as Record<string, unknown>;
  return 'definitionId' in rec || Object.values(rec).some(namesACard);
}

/** Task 4.4b: every object (any depth) typed as an id-only event that names a card somewhere inside it. */
function collectNamedIdOnlyEvents(value: unknown): Pair[] {
  const out: Pair[] = [];
  const walk = (v: unknown, p: string): void => {
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${p}[${i}]`));
      return;
    }
    if (typeof v !== 'object' || v === null) return;
    const rec = v as Record<string, unknown>;
    if (
      typeof rec['type'] === 'string' &&
      ID_ONLY_EVENT_TYPES.has(rec['type']) &&
      namesACard(rec)
    ) {
      out.push({ path: p, instanceId: null, definitionId: `(${rec['type']})` });
    }
    for (const [k, child] of Object.entries(rec)) walk(child, `${p}.${k}`);
  };
  walk(value, '$');
  return out;
}

/** All violations in `payload` (whatever the viewer received) against the raw state after the action. */
export function findLeaks(state: GameState, viewer: 0 | 1, payload: unknown): LeakViolation[] {
  const violations: LeakViolation[] = [];
  for (const pair of collectNamedSetEvents(payload)) {
    violations.push({ viewer, ...pair, reason: 'a face-down Set event carries a definitionId' });
  }
  for (const pair of collectNamedIdOnlyEvents(payload)) {
    violations.push({ viewer, ...pair, reason: 'an id-only event carries a definitionId' });
  }
  const pointers = collectPointers(payload);
  for (const { path, id } of pointers.ids) {
    if (pointsAtHidden(locate(state, id), viewer)) {
      violations.push({
        viewer,
        path,
        instanceId: id,
        definitionId: '(pointer)',
        reason: 'an id list points at a card hidden from the viewer',
      });
    }
  }
  for (const { path, owner, id } of pointers.equips) {
    const reason = equipProblem(state, owner, id);
    if (reason !== null) {
      violations.push({ viewer, path, instanceId: id, definitionId: '(equippedTo)', reason });
    }
  }
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
