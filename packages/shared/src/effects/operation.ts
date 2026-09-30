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
  /**
   * Task 4.2a: Special Summons the effect's Card target (a monster in your own hand/graveyard, see the refine in
   * EffectDefinitionSchema) into your lowest empty Monster Zones. Face-up only; omitted = Attack Position [ASSUMED].
   */
  z
    .object({
      kind: z.literal('SpecialSummon'),
      position: z.enum(['Attack', 'DefenseUp']).optional(),
    })
    .strict(),
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
      /** Relative to the card's controller. Exactly one of `side` / `equipped` (refine in EffectDefinitionSchema). */
      side: SideSchema.optional(),
      /** Task 4.2c: only the monster this Equip Spell is equipped to (no `filter`/`excludeSource`). */
      equipped: z.literal(true).optional(),
      filter: CardFilterSchema.optional(),
      excludeSource: z.boolean().optional(),
    })
    .strict(),
  /**
   * Task 4.2c: equips this card (an Equip Spell) to the effect's Card target — one face-up monster (refine in
   * EffectDefinitionSchema). The card then stays on the field, linked to that monster, until either leaves the field.
   */
  z.object({ kind: z.literal('Equip') }).strict(),
]);
export type Operation = z.infer<typeof OperationSchema>;
