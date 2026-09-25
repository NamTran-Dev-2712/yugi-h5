import { z } from 'zod';
import { AttributeSchema } from '../cards/attribute.js';

const LevelRangeSchema = z
  .object({
    min: z.number().int().min(1).max(12).optional(),
    max: z.number().int().min(1).max(12).optional(),
  })
  .strict()
  .refine((r) => r.min !== undefined || r.max !== undefined, {
    message: 'level needs min and/or max',
  })
  .refine((r) => r.min === undefined || r.max === undefined || r.min <= r.max, {
    message: 'level.min must be <= level.max',
  });

/** Filter over cards (Target/Cost/Condition). All present criteria must match (AND). */
export const CardFilterSchema = z
  .object({
    kind: z.enum(['Monster', 'Spell', 'Trap']).optional(),
    level: LevelRangeSchema.optional(),
    attribute: AttributeSchema.optional(),
    race: z.string().min(1).optional(),
  })
  .strict()
  .refine((f) => Object.values(f).some((v) => v !== undefined), {
    message: 'filter needs at least one criterion',
  });
export type CardFilter = z.infer<typeof CardFilterSchema>;
