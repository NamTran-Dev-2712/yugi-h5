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
    /** Run in order on resolution. */
    operations: z.array(OperationSchema).min(1),
  })
  .strict()
  .refine((e) => e.trigger.kind !== 'Continuous' || (!e.cost && !e.target), {
    message: 'Continuous effects never go on the chain: no cost/target allowed',
  })
  .refine(
    (e) =>
      (e.trigger.kind !== 'OnSummon' && e.trigger.kind !== 'OnDestroyed') ||
      (e.cost ?? []).every((c) => c.kind === 'PayLP'),
    // Task 3.5: a trigger is activated by the engine, which cannot pick cost cards (no cost prompt yet).
    { message: 'Trigger effects (OnSummon/OnDestroyed) may only cost PayLP for now' },
  );
export type EffectDefinition = z.infer<typeof EffectDefinitionSchema>;
