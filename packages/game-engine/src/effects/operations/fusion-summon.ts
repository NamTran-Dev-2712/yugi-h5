import type { EffectDefinition, Operation } from '@yugi/shared';
import type { ActionContext } from '../../actions/types.js';
import type { GameEvent } from '../../events/types.js';
import { shuffle } from '../../rng/seeded-rng.js';
import type { CardInstance, GameState, PlayerState } from '../../state/types.js';
import type { PendingTrigger } from '../triggers.js';
import { freeMonsterZones } from './special-summon.js';
import type { OperationHandler } from './types.js';

/*
 * Task 4.5 — Fusion Summon. Unlike every other operation this one needs the player's input while it RESOLVES (which
 * Fusion Monster, which materials), so it does not run through `OPERATION_HANDLERS`: `effects/chain.ts` pauses the
 * chain on its link, two prompts collect the choices (`actions/handlers/fusion-prompt.ts`) and `applyFusion` does the
 * move. Everything here is pure and reads only the controller's own cards.
 */

export type FusionSummonOperation = Extract<Operation, { kind: 'FusionSummon' }>;

/** A card of the controller that may be used as a material, and where it is. */
export interface MaterialCandidate {
  readonly card: CardInstance;
  readonly from: 'Hand' | 'MonsterZone' | 'Deck';
  /** Monster Zone index (only for `MonsterZone`). */
  readonly zoneIndex?: number;
}

/** A Fusion Monster the controller can make right now. */
export interface FusionOption {
  /** The Fusion Monster in the controller's Extra Deck. */
  readonly fusion: CardInstance;
  /** Its `fusionMaterials`: the definition ids to provide (a repeated id = that many different cards). */
  readonly materials: readonly string[];
  /** The controller's cards that may serve as one of those materials (hand, then Monster Zones, then Deck). */
  readonly candidates: readonly MaterialCandidate[];
}

/**
 * `PendingPrompt.payload` of kind `SelectFusionMonster`: the chain is paused on link `linkId` (still on `chainStack`);
 * the player picks 1 Fusion Monster of their Extra Deck among the candidates.
 */
export interface SelectFusionMonsterPayload {
  readonly linkId: string;
  /** Fusion Monsters in the prompted player's Extra Deck that can be made right now (Extra Deck order). */
  readonly candidateInstanceIds: readonly string[];
  readonly count: 1;
  /** Triggers fired by the links that already resolved; they go on the chain once the Fusion Summon is done. */
  readonly owedTriggers: readonly PendingTrigger[];
  /** Links of the chain being resolved (for its `ChainResolved`). */
  readonly linkCount: number;
}

/** `PendingPrompt.payload` of kind `SelectFusionMaterials`: the materials of `fusionInstanceId`, `count` of them. */
export interface SelectFusionMaterialsPayload {
  readonly linkId: string;
  readonly fusionInstanceId: string;
  /** The prompted player's cards that may serve as a material (hand, then Monster Zones, then Deck). */
  readonly candidateInstanceIds: readonly string[];
  /** Exactly this many ids must be chosen: one card per entry of the monster's `fusionMaterials`. */
  readonly count: number;
  readonly owedTriggers: readonly PendingTrigger[];
  readonly linkCount: number;
}

/** The effect's `FusionSummon` operation, if it has one. */
export function fusionOperationOf(effect: EffectDefinition): FusionSummonOperation | undefined {
  return effect.operations.find((o): o is FusionSummonOperation => o.kind === 'FusionSummon');
}

/** The controller's own cards in the operation's `sources`: hand, Monster Zones (face-down included), Deck. */
function materialPool(
  state: GameState,
  controller: 0 | 1,
  op: FusionSummonOperation,
): MaterialCandidate[] {
  const player = state.players[controller];
  const pool: MaterialCandidate[] = [];
  if (op.sources.includes('Hand')) {
    for (const card of player.hand) pool.push({ card, from: 'Hand' });
  }
  if (op.sources.includes('Field')) {
    player.board.monsterZones.forEach((card, zoneIndex) => {
      if (card !== null) pool.push({ card, from: 'MonsterZone', zoneIndex });
    });
  }
  if (op.sources.includes('Deck')) {
    for (const card of player.deck) pool.push({ card, from: 'Deck' });
  }
  return pool;
}

const countOf = (list: readonly string[], id: string): number =>
  list.filter((x) => x === id).length;

/** Every Fusion Monster in the Extra Deck whose materials are all in the pool — with or without room to Summon it. */
function madeFromPool(
  state: GameState,
  controller: 0 | 1,
  op: FusionSummonOperation,
  ctx: ActionContext,
): FusionOption[] {
  const pool = materialPool(state, controller, op);
  const options: FusionOption[] = [];
  for (const fusion of state.players[controller].extraDeck) {
    const definition = ctx.cardDefinitions(fusion.definitionId);
    if (definition?.kind !== 'Monster' || definition.category !== 'Fusion') continue;
    const materials = definition.fusionMaterials ?? [];
    if (materials.length === 0) continue;
    const candidates = pool.filter((c) => materials.includes(c.card.definitionId));
    const enough = materials.every(
      (id) => candidates.filter((c) => c.card.definitionId === id).length >= countOf(materials, id),
    );
    if (enough) options.push({ fusion, materials, candidates });
  }
  return options;
}

/**
 * [RULE] no room, no Summon: with every Monster Zone taken, a material must come from the field (it frees its zone).
 * Any needed id that has a copy on the field can be served by that copy, so one field candidate is enough.
 */
function hasRoom(state: GameState, controller: 0 | 1, option: FusionOption): boolean {
  return (
    freeMonsterZones(state.players[controller]).length > 0 ||
    option.candidates.some((c) => c.from === 'MonsterZone')
  );
}

/** The Fusion Monsters `controller` can Fusion Summon right now with `op` (Extra Deck order). */
export function fusionOptions(
  state: GameState,
  controller: 0 | 1,
  op: FusionSummonOperation,
  ctx: ActionContext,
): FusionOption[] {
  return madeFromPool(state, controller, op, ctx).filter((o) => hasRoom(state, controller, o));
}

/**
 * Why an effect with `FusionSummon` cannot be activated, or null when it can (or has no such operation): no Fusion
 * Monster with all its materials (`NOT_ACTIVATABLE`), or materials but no way to have an empty Monster Zone
 * (`NO_FREE_MONSTER_ZONE`).
 */
export function fusionBlocked(
  state: GameState,
  controller: 0 | 1,
  effect: EffectDefinition,
  ctx: ActionContext,
): 'NOT_ACTIVATABLE' | 'NO_FREE_MONSTER_ZONE' | null {
  const op = fusionOperationOf(effect);
  if (!op) return null;
  const made = madeFromPool(state, controller, op, ctx);
  if (made.length === 0) return 'NOT_ACTIVATABLE';
  return made.some((o) => hasRoom(state, controller, o)) ? null : 'NO_FREE_MONSTER_ZONE';
}

/**
 * The chosen materials when `chosenIds` is a legal answer for `option`: different cards, all candidates, exactly the
 * option's materials (same ids, same number of copies), leaving an empty Monster Zone. null otherwise.
 */
export function chosenMaterials(
  state: GameState,
  controller: 0 | 1,
  option: FusionOption,
  chosenIds: readonly string[],
): MaterialCandidate[] | null {
  if (chosenIds.length !== option.materials.length) return null;
  if (new Set(chosenIds).size !== chosenIds.length) return null;
  const chosen: MaterialCandidate[] = [];
  for (const id of chosenIds) {
    const candidate = option.candidates.find((c) => c.card.instanceId === id);
    if (!candidate) return null;
    chosen.push(candidate);
  }
  const provided = chosen.map((c) => c.card.definitionId);
  if (!option.materials.every((id) => countOf(provided, id) === countOf(option.materials, id)))
    return null;
  const freed = chosen.some((c) => c.from === 'MonsterZone');
  if (!freed && freeMonsterZones(state.players[controller]).length === 0) return null;
  return chosen;
}

/**
 * The Fusion Summon itself (`materials` already validated by `chosenMaterials`): each material goes to the controller's
 * graveyard in the chosen order (sent, not destroyed); a Deck that gave a material is shuffled with the state rng
 * [RULE]; the Fusion Monster leaves the Extra Deck for the lowest empty Monster Zone [ASSUMED], face-up. Like a Special
 * Summon it stamps `summonedTurn` and leaves `hasNormalSummonedThisTurn` alone [RULE].
 */
export function applyFusion(
  state: GameState,
  controller: 0 | 1,
  op: FusionSummonOperation,
  fusion: CardInstance,
  materials: readonly MaterialCandidate[],
): { state: GameState; events: GameEvent[] } {
  const player = state.players[controller];
  const used = new Set(materials.map((m) => m.card.instanceId));
  const position = op.position ?? 'Attack';

  const cleared = player.board.monsterZones.map((slot) =>
    slot !== null && used.has(slot.instanceId) ? null : slot,
  );
  const zoneIndex = cleared.findIndex((slot) => slot === null);
  // Built fresh (not `...card`) so nothing from an earlier life of the card carries over.
  const placed: CardInstance = {
    instanceId: fusion.instanceId,
    definitionId: fusion.definitionId,
    ownerIndex: fusion.ownerIndex,
    position,
    summonedTurn: state.turnCount,
  };

  let rng = state.rng;
  let deck = player.deck;
  if (materials.some((m) => m.from === 'Deck')) {
    const [shuffled, nextRng] = shuffle(
      rng,
      deck.filter((c) => !used.has(c.instanceId)),
    );
    deck = shuffled;
    rng = nextRng;
  }

  const next: PlayerState = {
    ...player,
    hand: player.hand.filter((c) => !used.has(c.instanceId)),
    deck,
    extraDeck: player.extraDeck.filter((c) => c.instanceId !== fusion.instanceId),
    graveyard: [
      ...player.graveyard,
      ...materials.map((m): CardInstance => ({
        instanceId: m.card.instanceId,
        definitionId: m.card.definitionId,
        ownerIndex: m.card.ownerIndex,
        position: null,
      })),
    ],
    board: {
      ...player.board,
      monsterZones: cleared.map((slot, i) =>
        i === zoneIndex ? placed : slot,
      ) as unknown as PlayerState['board']['monsterZones'],
    },
  };

  const events: GameEvent[] = materials.map((m) => ({
    type: 'FusionMaterialSent',
    ownerIndex: controller,
    instanceId: m.card.instanceId,
    definitionId: m.card.definitionId,
    from: m.from,
    ...(m.zoneIndex === undefined ? {} : { zoneIndex: m.zoneIndex }),
  }));
  events.push({
    type: 'MonsterFusionSummoned',
    playerIndex: controller,
    instanceId: placed.instanceId,
    definitionId: placed.definitionId,
    zoneIndex,
    position,
    materialInstanceIds: materials.map((m) => m.card.instanceId),
  });

  return {
    state: {
      ...state,
      rng,
      players: controller === 0 ? [next, state.players[1]] : [state.players[0], next],
    },
    events,
  };
}

/**
 * Registered so every resolve-time operation kind has a handler, but never the way a Fusion Summon happens: the chain
 * pauses on a `FusionSummon` link before its operations run (`effects/chain.ts`). Reached only for a link the chain
 * could not pause on — it then does nothing.
 */
export const applyFusionSummon: OperationHandler<'FusionSummon'> = (state) => ({
  state,
  events: [],
});
