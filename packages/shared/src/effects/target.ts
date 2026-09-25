import { z } from 'zod';
import { CardFilterSchema } from './filter.js';
import { EffectZoneSchema, SideSchema } from './zone.js';

/** Chosen on activation (not on resolution). */
export const TargetSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('Card'),
      zone: EffectZoneSchema,
      side: SideSchema,
      count: z.number().int().min(1).max(20),
      filter: CardFilterSchema.optional(),
    })
    .strict(),
  z.object({ kind: z.literal('Player'), who: SideSchema }).strict(),
]);
export type Target = z.infer<typeof TargetSchema>;
