import type { EffectDefinition } from '@yugi/shared';
import { EngineError } from '../errors.js';
import type { ActionContext } from '../actions/types.js';
import type { CardInstance, GameState } from '../state/types.js';
import { matchesFilter, sideIndex } from './filter.js';

type CardTarget = Extract<NonNullable<EffectDefinition['target']>, { kind: 'Card' }>;

/**
 * Where a targeted card currently is (needed to destroy it and to name the right event). Task 4.3: `FieldZone` has one
 * slot (`zoneIndex` 0).
 */
export interface FieldLocation {
  readonly ownerIndex: 0 | 1;
  readonly zone: 'MonsterZone' | 'SpellTrapZone' | 'FieldZone';
  readonly zoneIndex: number;
  readonly card: CardInstance;
}

export function findOnField(state: GameState, instanceId: string): FieldLocation | null {
  for (const ownerIndex of [0, 1] as const) {
    const { monsterZones, spellTrapZones, fieldZone } = state.players[ownerIndex].board;
    const m = monsterZones.findIndex((c) => c?.instanceId === instanceId);
    if (m !== -1) return { ownerIndex, zone: 'MonsterZone', zoneIndex: m, card: monsterZones[m]! };
    const s = spellTrapZones.findIndex((c) => c?.instanceId === instanceId);
    if (s !== -1)
      return { ownerIndex, zone: 'SpellTrapZone', zoneIndex: s, card: spellTrapZones[s]! };
    if (fieldZone?.instanceId === instanceId)
      return { ownerIndex, zone: 'FieldZone', zoneIndex: 0, card: fieldZone };
  }
  return null;
}

/** Where a card chosen in the hand or graveyard (task 4.2a) currently is. */
export function findInHandOrGraveyard(
  state: GameState,
  playerIndex: 0 | 1,
  instanceId: string,
): { card: CardInstance; zone: 'Hand' | 'Graveyard' } | null {
  const player = state.players[playerIndex];
  const inHand = player.hand.find((c) => c.instanceId === instanceId);
  if (inHand) return { card: inHand, zone: 'Hand' };
  const inGraveyard = player.graveyard.find((c) => c.instanceId === instanceId);
  return inGraveyard ? { card: inGraveyard, zone: 'Graveyard' } : null;
}

/**
 * The candidates of `effect`'s `Card` target (`targetCandidates`) — minus, task 4.5 [DECISION], every Fusion Monster
 * when the effect Special Summons its target: a Fusion Monster only reaches the field by a Fusion Summon. Used wherever
 * an effect's targets are listed or re-checked (activation, trigger, resolution).
 */
export function effectTargetCandidates(
  state: GameState,
  controller: 0 | 1,
  effect: EffectDefinition,
  target: CardTarget,
  ctx: ActionContext,
): string[] {
  const candidates = targetCandidates(state, controller, target, ctx);
  if (!effect.operations.some((o) => o.kind === 'SpecialSummon')) return candidates;
  return candidates.filter((id) => {
    const found = findInHandOrGraveyard(state, controller, id);
    const definition = found ? ctx.cardDefinitions(found.card.definitionId) : undefined;
    return !(definition?.kind === 'Monster' && definition.category === 'Fusion');
  });
}

/**
 * Instance ids that can be chosen for a `Card` target, in zone order: field zones (task 3.2; `SpellTrapZone` also
 * covers the Field Zone, task 4.3), your own hand and either graveyard (task 4.2a; a graveyard is public). A face-down card on the field is a legal target only when the effect has
 * no `filter` (a filter would read its hidden identity). The opponent's hand and any deck stay unsupported (hidden).
 */
export function targetCandidates(
  state: GameState,
  controller: 0 | 1,
  target: CardTarget,
  ctx: ActionContext,
): string[] {
  const side = sideIndex(controller, target.side);
  const unsupported = target.zone === 'Deck' || (target.zone === 'Hand' && side !== controller);
  if (unsupported) {
    throw new EngineError(
      'NOT_ACTIVATABLE',
      `ActivateEffect rejected: targets in the ${target.side} ${target.zone} are not supported.`,
    );
  }
  const player = state.players[side];
  const board = player.board;
  const zone =
    target.zone === 'Hand'
      ? player.hand
      : target.zone === 'Graveyard'
        ? player.graveyard
        : target.zone === 'MonsterZone'
          ? board.monsterZones
          : // Task 4.3 [RULE]: "a Spell/Trap on the field" includes the card in the Field Zone (listed last).
            [...board.spellTrapZones, board.fieldZone];
  const out: string[] = [];
  for (const card of zone) {
    if (card === null) continue;
    if (target.filter) {
      if (card.position === 'DefenseDown') continue;
      const def = ctx.cardDefinitions(card.definitionId);
      if (!def || !matchesFilter(def, target.filter)) continue;
    }
    out.push(card.instanceId);
  }
  return out;
}
