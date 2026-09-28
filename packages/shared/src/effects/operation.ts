import { z } from 'zod';
import { CardFilterSchema } from './filter.js';
import { SideSchema } from './zone.js';

/**
 * Batch 1 operations. `Destroy` acts on the effect's Card target (see EffectDefinition.target);
 * the others name the affected player. `ModifyStat` (task 3.6) is the first CONTINUOUS operation: it is not run on
 * resolution but read by the engine whenever it needs a monster's ATK/DEF, as long as its card is face-up on the field.
 * It names what it affects itself (a Continuous effect has no `target`): the face-up monsters on `side` (relative to
 * the card's controller) matching `filter`, minus the card itself when `excludeSource`.
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
  z
    .object({
      kind: z.literal('ModifyStat'),
      stat: z.enum(['atk', 'def']),
      /** Negative = the stat is lowered. Never 0. */
      amount: z
        .number()
        .int()
        .min(-10000)
        .max(10000)
        .refine((n) => n !== 0, { message: 'amount must not be 0' }),
      side: SideSchema,
      filter: CardFilterSchema.optional(),
      excludeSource: z.boolean().optional(),
    })
    .strict(),
]);
export type Operation = z.infer<typeof OperationSchema>;
