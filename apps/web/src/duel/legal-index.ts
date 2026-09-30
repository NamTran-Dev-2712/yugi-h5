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
export type SetSpellTrapAction = Extract<PlayerAction, { type: 'SetSpellTrap' }>;
export type ActivateEffectAction = Extract<PlayerAction, { type: 'ActivateEffect' }>;

export interface SpellZoneOption {
  readonly zoneIndex: number;
  readonly action: SetSpellTrapAction;
}

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

/** An action that takes a hand card to the field: Summon/Set a monster, Set a Spell/Trap, activate a Spell. */
type FromHandAction = SummonAction | SetSpellTrapAction | ActivateEffectAction;
const isFromHand = (a: PlayerAction): a is FromHandAction =>
  isSummon(a) || a.type === 'SetSpellTrap' || a.type === 'ActivateEffect';

/** Hand cards for which the server lists at least one Summon/Set, Spell/Trap Set or activation. */
export function draggableHandCards(legal: readonly PlayerAction[], viewer: PlayerIndex): string[] {
  return unique(
    legal
      .filter((a): a is FromHandAction => isFromHand(a) && mine(a, viewer))
      .map((a) => a.payload.cardInstanceId),
  );
}

/** Spell/Trap Zones the server lists a `SetSpellTrap` of this card for, in zone order. */
export function spellSetOptions(
  legal: readonly PlayerAction[],
  viewer: PlayerIndex,
  cardId: string,
): SpellZoneOption[] {
  return legal
    .filter(
      (a): a is SetSpellTrapAction =>
        a.type === 'SetSpellTrap' && mine(a, viewer) && a.payload.cardInstanceId === cardId,
    )
    .map((action) => ({ zoneIndex: action.payload.zoneIndex, action }))
    .sort((x, y) => x.zoneIndex - y.zoneIndex);
}

/** The listed activations of this card (one per effect and per cost choice). */
export function activations(
  legal: readonly PlayerAction[],
  viewer: PlayerIndex,
  cardId: string,
): ActivateEffectAction[] {
  return legal.filter(
    (a): a is ActivateEffectAction =>
      a.type === 'ActivateEffect' && mine(a, viewer) && a.payload.cardInstanceId === cardId,
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

export type PassPriorityAction = Extract<PlayerAction, { type: 'PassPriority' }>;

/** The viewer's listed PassPriority ("Bỏ qua"), or null when the server does not offer it. */
export function passAction(
  legal: readonly PlayerAction[],
  viewer: PlayerIndex,
): PassPriorityAction | null {
  return (
    legal.find((a): a is PassPriorityAction => a.type === 'PassPriority' && mine(a, viewer)) ?? null
  );
}

/** Of `setCardIds` (my Set cards), those the server lists at least one ActivateEffect for, in the given order. */
export function activatableSetCards(
  legal: readonly PlayerAction[],
  viewer: PlayerIndex,
  setCardIds: readonly string[],
): string[] {
  return setCardIds.filter((id) => activations(legal, viewer, id).length > 0);
}

/**
 * The listed answers to a TriggerActivation prompt: the activating ones (with their targets) and, apart, the decline
 * (only listed for an optional trigger).
 */
export function triggerAnswers(
  legal: readonly PlayerAction[],
  viewer: PlayerIndex,
  promptId: string,
): { answers: ResolvePromptAction[]; decline: ResolvePromptAction | null } {
  const all = promptAnswers(legal, viewer, promptId);
  return {
    answers: all.filter((a) => a.payload.decline !== true),
    decline: all.find((a) => a.payload.decline === true) ?? null,
  };
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

export type FlipSummonAction = Extract<PlayerAction, { type: 'FlipSummon' }>;

/** Task 4.2d: the listed FlipSummon of this face-down monster of mine, or null. */
export function flipSummonAction(
  legal: readonly PlayerAction[],
  viewer: PlayerIndex,
  monsterId: string,
): FlipSummonAction | null {
  return (
    legal.find(
      (a): a is FlipSummonAction =>
        a.type === 'FlipSummon' && mine(a, viewer) && a.payload.cardInstanceId === monsterId,
    ) ?? null
  );
}

/** The listed activations of this card, grouped by effect in list order (one group per effect id). */
export function activationsByEffect(
  legal: readonly PlayerAction[],
  viewer: PlayerIndex,
  cardId: string,
): ActivateEffectAction[][] {
  const byEffect = new Map<string, ActivateEffectAction[]>();
  for (const a of activations(legal, viewer, cardId)) {
    const group = byEffect.get(a.payload.effectId) ?? [];
    group.push(a);
    byEffect.set(a.payload.effectId, group);
  }
  return [...byEffect.values()];
}
