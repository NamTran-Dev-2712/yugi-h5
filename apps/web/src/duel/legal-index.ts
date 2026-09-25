import type { PlayerAction, PlayerIndex } from '@yugi/shared';

/**
 * `legalActions` (what the server lists for the viewer) -> the small lookups the interaction layer needs. This only
 * filters and groups what the server sent; it never decides whether something is allowed. Every action it hands
 * back is an element of the list it was given.
 */

export type SummonAction = Extract<PlayerAction, { type: 'NormalSummon' | 'SetMonster' }>;
export type ChangePositionAction = Extract<PlayerAction, { type: 'ChangePosition' }>;
export type ResolvePromptAction = Extract<PlayerAction, { type: 'ResolvePendingPrompt' }>;
export type AttackAction = Extract<PlayerAction, { type: 'DeclareAttack' }>;

export interface ZoneOption {
  readonly zoneIndex: number;
  readonly normal: readonly SummonAction[];
  readonly set: readonly SummonAction[];
}

export interface AttackTarget {
  /** null = direct attack. */
  readonly targetInstanceId: string | null;
  readonly action: AttackAction;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k) &&
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/** Structural equality, independent of key order. */
export function sameAction(a: PlayerAction, b: PlayerAction): boolean {
  return deepEqual(a, b);
}

export function isListed(legal: readonly PlayerAction[], action: PlayerAction): boolean {
  return legal.some((a) => sameAction(a, action));
}

const mine = (a: PlayerAction, viewer: PlayerIndex): boolean => a.payload.playerIndex === viewer;

const isSummon = (a: PlayerAction): a is SummonAction =>
  a.type === 'NormalSummon' || a.type === 'SetMonster';

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/** Hand cards for which the server lists at least one Summon/Set. */
export function draggableHandCards(legal: readonly PlayerAction[], viewer: PlayerIndex): string[] {
  return unique(
    legal
      .filter((a): a is SummonAction => isSummon(a) && mine(a, viewer))
      .map((a) => a.payload.cardInstanceId),
  );
}

/** Per zone the server lists for this card: its Normal Summon and Set actions (one per tribute choice). */
export function summonOptions(
  legal: readonly PlayerAction[],
  viewer: PlayerIndex,
  cardId: string,
): ZoneOption[] {
  const byZone = new Map<number, { normal: SummonAction[]; set: SummonAction[] }>();
  for (const a of legal) {
    if (!isSummon(a) || !mine(a, viewer) || a.payload.cardInstanceId !== cardId) continue;
    const entry = byZone.get(a.payload.zoneIndex) ?? { normal: [], set: [] };
    (a.type === 'NormalSummon' ? entry.normal : entry.set).push(a);
    byZone.set(a.payload.zoneIndex, entry);
  }
  return [...byZone.entries()]
    .sort(([x], [y]) => x - y)
    .map(([zoneIndex, e]) => ({ zoneIndex, normal: e.normal, set: e.set }));
}

const isAttack = (a: PlayerAction): a is AttackAction => a.type === 'DeclareAttack';

export function attackers(legal: readonly PlayerAction[], viewer: PlayerIndex): string[] {
  return unique(
    legal
      .filter((a): a is AttackAction => isAttack(a) && mine(a, viewer))
      .map((a) => a.payload.attackerInstanceId),
  );
}

export function attackTargets(
  legal: readonly PlayerAction[],
  viewer: PlayerIndex,
  attackerId: string,
): AttackTarget[] {
  return legal
    .filter(
      (a): a is AttackAction =>
        isAttack(a) && mine(a, viewer) && a.payload.attackerInstanceId === attackerId,
    )
    .map((action) => ({ targetInstanceId: action.payload.targetInstanceId ?? null, action }));
}

export function positionOptions(
  legal: readonly PlayerAction[],
  viewer: PlayerIndex,
  monsterId: string,
): ChangePositionAction[] {
  return legal.filter(
    (a): a is ChangePositionAction =>
      a.type === 'ChangePosition' && mine(a, viewer) && a.payload.cardInstanceId === monsterId,
  );
}

export function promptAnswers(
  legal: readonly PlayerAction[],
  viewer: PlayerIndex,
  promptId: string,
): ResolvePromptAction[] {
  return legal.filter(
    (a): a is ResolvePromptAction =>
      a.type === 'ResolvePendingPrompt' && mine(a, viewer) && a.payload.promptId === promptId,
  );
}
