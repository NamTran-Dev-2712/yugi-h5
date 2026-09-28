import type { ContinuousOperationKind, EffectDefinition, Operation } from '@yugi/shared';
import type { ActionContext } from '../actions/types.js';
import { resolveMonster } from '../cards/resolve-monster.js';
import { EngineError, type EngineErrorCode } from '../errors.js';
import type { CardInstance, GameState } from '../state/types.js';
import { conditionsHold } from './conditions.js';
import { matchesFilter, sideIndex } from './filter.js';

/*
 * Continuous effects (task 3.6) [RULE]: never activated, never on the chain. They hold while their card is face-up on
 * the field and stop the moment it leaves or turns face-down. Nothing is stored in the state: every read (battle
 * damage calc, …) recomputes them from the board and the card data, so there is no "remove the effect" code anywhere.
 * Pure helpers; nothing here bumps `version` or emits events.
 */

/** A Continuous effect currently in force. */
export interface ActiveContinuous {
  /** Player who controls the source card (its side of the field). */
  readonly controller: 0 | 1;
  readonly source: CardInstance;
  readonly effect: EffectDefinition;
}

/** ATK/DEF after every Continuous modifier. */
export interface Stats {
  readonly atk: number;
  readonly def: number;
}

/** What a continuous handler knows about the monster it may modify. */
export interface ContinuousTarget {
  readonly card: CardInstance;
  /** Player whose monster zones hold `card`. */
  readonly controller: 0 | 1;
}

/** Stat delta one continuous operation applies to `target` (zero when it does not apply). Pure. */
export type ContinuousHandler<K extends ContinuousOperationKind> = (
  op: Extract<Operation, { kind: K }>,
  active: ActiveContinuous,
  target: ContinuousTarget,
  ctx: ActionContext,
) => Stats;

const NONE: Stats = { atk: 0, def: 0 };

const isFaceUp = (card: CardInstance): boolean =>
  card.position === 'Attack' || card.position === 'DefenseUp';

/** Face-up monsters on the relative `side` matching the filter, minus the source itself when `excludeSource`. */
const modifyStat: ContinuousHandler<'ModifyStat'> = (op, active, target, ctx) => {
  if (target.controller !== sideIndex(active.controller, op.side)) return NONE;
  if (op.excludeSource && target.card.instanceId === active.source.instanceId) return NONE;
  if (op.filter) {
    const def = ctx.cardDefinitions(target.card.definitionId);
    if (!def || !matchesFilter(def, op.filter)) return NONE;
  }
  return op.stat === 'atk' ? { atk: op.amount, def: 0 } : { atk: 0, def: op.amount };
};

/**
 * One handler per continuous operation kind (a new kind in `CONTINUOUS_OPERATION_KINDS` without a handler here is a
 * `tsc` error). Resolve-time operations live in `operations/index.ts`.
 */
export const CONTINUOUS_HANDLERS: {
  readonly [K in ContinuousOperationKind]: ContinuousHandler<K>;
} = {
  ModifyStat: modifyStat,
};

/**
 * Every Continuous effect in force, in a fixed order: player 0 then 1; monster zones 0–4 then Spell/Trap Zones 0–4.
 * Sources: face-up monsters, and face-up Spell/Traps (a Continuous Spell/Trap can only be placed face-up by a fixture
 * or scenario until P4 lets it be activated). The effect's conditions are checked now, from its controller's view.
 */
export function activeContinuousEffects(state: GameState, ctx: ActionContext): ActiveContinuous[] {
  const out: ActiveContinuous[] = [];
  for (const controller of [0, 1] as const) {
    const { monsterZones, spellTrapZones } = state.players[controller].board;
    for (const source of [...monsterZones, ...spellTrapZones]) {
      if (source === null || !isFaceUp(source)) continue;
      for (const effect of ctx.cardDefinitions(source.definitionId)?.effects ?? []) {
        if (effect.trigger.kind !== 'Continuous') continue;
        if (!conditionsHold(state, controller, effect.condition)) continue;
        out.push({ controller, source, effect });
      }
    }
  }
  return out;
}

function applyOperation(
  op: Operation,
  active: ActiveContinuous,
  target: ContinuousTarget,
  ctx: ActionContext,
): Stats {
  switch (op.kind) {
    case 'ModifyStat':
      return CONTINUOUS_HANDLERS.ModifyStat(op, active, target, ctx);
    default:
      // The schema keeps resolve-time operations out of Continuous effects.
      return NONE;
  }
}

const rejectStats = (code: EngineErrorCode, reason: string): never => {
  throw new EngineError(code, `Stat lookup failed: ${reason}`);
};

/**
 * `card`'s ATK/DEF right now: printed stats plus every Continuous modifier in force, never below 0 [RULE]. Only a
 * face-up monster on the field is modified; anything else (face-down, not on the field) keeps its printed stats.
 */
export function effectiveStats(state: GameState, card: CardInstance, ctx: ActionContext): Stats {
  const printed = resolveMonster(card, ctx, rejectStats);
  // Read the card as it is in `state` (the caller's copy may be older, e.g. before a flip).
  let target: ContinuousTarget | null = null;
  for (const controller of [0, 1] as const) {
    const onField = state.players[controller].board.monsterZones.find(
      (c) => c?.instanceId === card.instanceId,
    );
    if (onField) target = { card: onField, controller };
  }
  if (target === null || !isFaceUp(target.card)) return { atk: printed.atk, def: printed.def };

  let atk = printed.atk;
  let def = printed.def;
  for (const active of activeContinuousEffects(state, ctx)) {
    for (const op of active.effect.operations) {
      const delta = applyOperation(op, active, target, ctx);
      atk += delta.atk;
      def += delta.def;
    }
  }
  return { atk: Math.max(0, atk), def: Math.max(0, def) };
}
