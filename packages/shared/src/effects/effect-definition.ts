import { z } from 'zod';
import { ConditionSchema } from './condition.js';
import { CostSchema } from './cost.js';
import { OperationSchema } from './operation.js';
import { isContinuousOperationKind, isNegateOperationKind } from './registry.js';
import { TargetSchema } from './target.js';
import { TriggerSchema } from './trigger.js';

/** Data-driven effect. See docs/design/effect-dsl.md. */
export const EffectDefinitionSchema = z
  .object({
    /** Unique within one CardDefinition. */
    id: z.string().min(1),
    trigger: TriggerSchema,
    /**
     * Spell Speed on the chain (task 3.4). Omitted = derived by the engine from the card: Counter Trap 3, other Traps
     * and Quick-Play Spells 2, everything else 1 [RULE]. Set it only for cards that break that default.
     */
    spellSpeed: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    /** AND — all must hold to activate/resolve. */
    condition: z.array(ConditionSchema).min(1).optional(),
    /** Paid on activation. */
    cost: z.array(CostSchema).min(1).optional(),
    target: TargetSchema.optional(),
    /**
     * Run in order on resolution; for a `Continuous` effect, the modifiers that hold while the card is face-up.
     * May be empty only when `scriptId` does the work, or (task 4.3) on the `Ignition`/`Quick` effect that merely
     * activates a card that stays on the field (`CardDefinitionSchema` checks which cards may have one).
     */
    operations: z.array(OperationSchema),
    /**
     * Engine script run on resolution, after `operations` (task 3.6), for behaviour the DSL cannot express. The engine
     * refuses to activate an effect whose script is not registered. Not allowed on `Continuous` effects.
     */
    scriptId: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (e) =>
      e.operations.length > 0 ||
      e.scriptId !== undefined ||
      e.trigger.kind === 'Ignition' ||
      e.trigger.kind === 'Quick',
    {
      message:
        'an effect needs at least one operation or a scriptId (only a card-activation effect may be empty)',
    },
  )
  .refine(
    (e) =>
      e.operations.every(
        (o) => isContinuousOperationKind(o.kind) === (e.trigger.kind === 'Continuous'),
      ),
    {
      message:
        'Continuous effects hold only continuous operations (ModifyStat), other effects none',
    },
  )
  .refine((e) => e.trigger.kind !== 'Continuous' || e.scriptId === undefined, {
    message: 'a scriptId runs on resolution: not allowed on a Continuous effect',
  })
  .refine((e) => e.trigger.kind !== 'Continuous' || (!e.cost && !e.target), {
    message: 'Continuous effects never go on the chain: no cost/target allowed',
  })
  .refine(
    (e) =>
      (e.trigger.kind !== 'OnSummon' &&
        e.trigger.kind !== 'OnDestroyed' &&
        e.trigger.kind !== 'OnFlip') ||
      (e.cost ?? []).every((c) => c.kind === 'PayLP'),
    // Task 3.5 (OnFlip: 4.2b): a trigger is activated by the engine, which cannot pick cost cards (no cost prompt yet).
    { message: 'Trigger effects (OnSummon/OnDestroyed/OnFlip) may only cost PayLP for now' },
  )
  .refine(
    (e) =>
      !e.operations.some((o) => o.kind === 'SpecialSummon') ||
      (e.target?.kind === 'Card' &&
        (e.target.zone === 'Hand' || e.target.zone === 'Graveyard') &&
        e.target.side === 'self' &&
        e.target.filter?.kind === 'Monster'),
    // Task 4.2a [DECISION]: only your own monsters (no change of control yet), from places the engine can read.
    {
      message:
        'SpecialSummon needs a Card target in your own Hand or Graveyard with filter kind Monster',
    },
  )
  .refine(
    (e) =>
      !e.operations.some((o) => o.kind === 'Equip') ||
      (e.target?.kind === 'Card' &&
        e.target.zone === 'MonsterZone' &&
        e.target.count === 1 &&
        e.target.filter?.kind === 'Monster'),
    // Task 4.2c [RULE]: one monster; the filter also keeps face-down monsters out (an Equip needs a face-up monster).
    { message: 'Equip needs a Card target: 1 monster in a MonsterZone, with filter kind Monster' },
  )
  .refine(
    (e) =>
      e.operations.every(
        (o) =>
          o.kind !== 'ModifyStat' ||
          (o.equipped === true
            ? o.side === undefined && o.filter === undefined && o.excludeSource === undefined
            : o.side !== undefined),
      ),
    // Task 4.2c: either every face-up monster on a side (filtered), or only the equipped monster.
    {
      message:
        'ModifyStat needs exactly one of side / equipped (equipped takes no filter/excludeSource)',
    },
  )
  .refine(
    (e) => e.trigger.kind === 'Quick' || !e.operations.some((o) => isNegateOperationKind(o.kind)),
    // Task 4.4 [RULE]: a negation answers an activation, an attack or a Summon, so it is always a response.
    {
      message:
        'NegateActivation / NegateAttack / NegateSummon only answer something: the effect must be Quick',
    },
  )
  .refine(
    (e) =>
      !e.operations.some((o) => o.kind === 'FusionSummon') ||
      (e.trigger.kind === 'Ignition' &&
        e.operations.length === 1 &&
        e.target === undefined &&
        e.scriptId === undefined &&
        (e.spellSpeed === undefined || e.spellSpeed === 1)),
    // Task 4.5: the player chooses while the effect RESOLVES, so the engine pauses the chain there. Spell Speed 1 makes
    // the effect chain link 1 — the last one to resolve — which is the only place the engine pauses [ASSUMED].
    {
      message:
        'FusionSummon must be the only operation of an Ignition effect (Spell Speed 1) without target or scriptId',
    },
  );

/** True when the effect Fusion Summons (task 4.5): only a Normal Spell may carry it (see CardDefinitionSchema). */
export function isFusionEffect(effect: { operations: readonly { kind: string }[] }): boolean {
  return effect.operations.some((o) => o.kind === 'FusionSummon');
}

/** True when the effect only makes sense on an Equip Spell (task 4.2c): it equips, or modifies the equipped monster. */
export function isEquipEffect(effect: {
  operations: readonly { kind: string; equipped?: true | undefined }[];
}): boolean {
  return effect.operations.some(
    (o) => o.kind === 'Equip' || (o.kind === 'ModifyStat' && o.equipped === true),
  );
}

/**
 * True for an effect that does nothing when it resolves (task 4.3): it only puts its card face-up on the field, where
 * the card's `Continuous` effects then hold.
 */
export function isActivationOnlyEffect(effect: {
  operations: readonly unknown[];
  scriptId?: string | undefined;
}): boolean {
  return effect.operations.length === 0 && effect.scriptId === undefined;
}
export type EffectDefinition = z.infer<typeof EffectDefinitionSchema>;
