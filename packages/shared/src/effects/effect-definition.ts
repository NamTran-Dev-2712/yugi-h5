import { z } from 'zod';
import { ConditionSchema } from './condition.js';
import { CostSchema } from './cost.js';
import { OperationSchema } from './operation.js';
import { isContinuousOperationKind } from './registry.js';
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
     * May be empty only when `scriptId` does the work.
     */
    operations: z.array(OperationSchema),
    /**
     * Engine script run on resolution, after `operations` (task 3.6), for behaviour the DSL cannot express. The engine
     * refuses to activate an effect whose script is not registered. Not allowed on `Continuous` effects.
     */
    scriptId: z.string().min(1).optional(),
  })
  .strict()
  .refine((e) => e.operations.length > 0 || e.scriptId !== undefined, {
    message: 'an effect needs at least one operation or a scriptId',
  })
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
      (e.trigger.kind !== 'OnSummon' && e.trigger.kind !== 'OnDestroyed') ||
      (e.cost ?? []).every((c) => c.kind === 'PayLP'),
    // Task 3.5: a trigger is activated by the engine, which cannot pick cost cards (no cost prompt yet).
    { message: 'Trigger effects (OnSummon/OnDestroyed) may only cost PayLP for now' },
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
  );
export type EffectDefinition = z.infer<typeof EffectDefinitionSchema>;
