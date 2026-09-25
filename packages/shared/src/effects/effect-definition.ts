import { z } from 'zod';
import { ConditionSchema } from './condition.js';
import { CostSchema } from './cost.js';
import { OperationSchema } from './operation.js';
import { TargetSchema } from './target.js';
import { TriggerSchema } from './trigger.js';

/** Data-driven effect. See docs/design/effect-dsl.md. */
export const EffectDefinitionSchema = z
  .object({
    /** Unique within one CardDefinition. */
    id: z.string().min(1),
    trigger: TriggerSchema,
    /** AND — all must hold to activate/resolve. */
    condition: z.array(ConditionSchema).min(1).optional(),
    /** Paid on activation. */
    cost: z.array(CostSchema).min(1).optional(),
    target: TargetSchema.optional(),
    /** Run in order on resolution. */
    operations: z.array(OperationSchema).min(1),
  })
  .strict()
  .refine((e) => e.trigger.kind !== 'Continuous' || (!e.cost && !e.target), {
    message: 'Continuous effects never go on the chain: no cost/target allowed',
  });
export type EffectDefinition = z.infer<typeof EffectDefinitionSchema>;
