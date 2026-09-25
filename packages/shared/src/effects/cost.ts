import { z } from 'zod';
import { CardFilterSchema } from './filter.js';

const count = z.number().int().min(1).max(20);

/** Batch 1 costs (paid on activation, before the effect goes on the chain). */
export const CostSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('Discard'), count, filter: CardFilterSchema.optional() }).strict(),
  z.object({ kind: z.literal('Tribute'), count, filter: CardFilterSchema.optional() }).strict(),
  z.object({ kind: z.literal('PayLP'), amount: z.number().int().min(1) }).strict(),
]);
export type Cost = z.infer<typeof CostSchema>;
