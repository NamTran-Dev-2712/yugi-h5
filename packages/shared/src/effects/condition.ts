import { z } from 'zod';
import { EffectZoneSchema, SideSchema } from './zone.js';

export const PhaseSchema = z.enum(['Draw', 'Standby', 'Main1', 'Battle', 'Main2', 'End']);

/**
 * Batch 1 conditions. A list of conditions on an effect is AND.
 * (Refinements sit on the union: zod v3 discriminated unions only take plain objects.)
 */
export const ConditionSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('PhaseIs'), phase: PhaseSchema }).strict(),
    z.object({ kind: z.literal('IsMyTurn') }).strict(),
    z
      .object({
        kind: z.literal('ZoneCount'),
        zone: EffectZoneSchema,
        side: SideSchema,
        min: z.number().int().min(0).optional(),
        max: z.number().int().min(0).optional(),
      })
      .strict(),
  ])
  .superRefine((c, ctx) => {
    if (c.kind !== 'ZoneCount') return;
    if (c.min === undefined && c.max === undefined) {
      ctx.addIssue({ code: 'custom', message: 'ZoneCount needs min and/or max' });
    } else if (c.min !== undefined && c.max !== undefined && c.min > c.max) {
      ctx.addIssue({ code: 'custom', message: 'ZoneCount.min must be <= max' });
    }
  });
export type Condition = z.infer<typeof ConditionSchema>;
