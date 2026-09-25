import { z } from 'zod';
import { SideSchema } from './zone.js';

/**
 * Batch 1 operations. `Destroy` acts on the effect's Card target (see EffectDefinition.target);
 * the others name the affected player.
 */
export const OperationSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('Damage'), amount: z.number().int().min(1), target: SideSchema })
    .strict(),
  z
    .object({ kind: z.literal('Heal'), amount: z.number().int().min(1), target: SideSchema })
    .strict(),
  z
    .object({
      kind: z.literal('Draw'),
      count: z.number().int().min(1).max(20),
      target: SideSchema,
    })
    .strict(),
  z.object({ kind: z.literal('Destroy') }).strict(),
]);
export type Operation = z.infer<typeof OperationSchema>;
