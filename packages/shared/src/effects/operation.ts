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
  /**
   * Task 4.4: negates the activation of the chain link this effect answers (the link directly below its own). That
   * link's operations never run and its Spell/Trap card goes to the graveyard, even one that would have stayed on the
   * field. `cardKinds` restricts what may be answered (omitted = any activation, a monster's trigger effect included).
   */
  z
    .object({
      kind: z.literal('NegateActivation'),
      cardKinds: z
        .array(z.enum(['Monster', 'Spell', 'Trap']))
        .min(1)
        .optional(),
    })
    .strict(),
  /** Task 4.4: ends the opponent's declared attack (attack reaction window): no flip, no destruction, no damage. */
  z.object({ kind: z.literal('NegateAttack') }).strict(),
  /**
   * Task 4.4: negates the opponent's Normal / Flip Summon it answers (Summon reaction window, first link); the monster
   * goes to the graveyard.
   */
  z.object({ kind: z.literal('NegateSummon') }).strict(),
  /**
   * Task 4.5: Fusion Summons one Fusion Monster from your Extra Deck. On resolution the player picks the monster, then
   * its `fusionMaterials` among their own cards in `sources` (`Field` = their Monster Zones, face-down included); the
   * materials go to the graveyard and the monster to their lowest empty Monster Zone. Face-up only; omitted = Attack
   * Position [ASSUMED]. No `target`: nothing is chosen at activation (refine in EffectDefinitionSchema).
   */
  z
    .object({
      kind: z.literal('FusionSummon'),
      sources: z
        .array(z.enum(['Hand', 'Field', 'Deck']))
        .min(1)
        .refine((list) => new Set(list).size === list.length, {
          message: 'sources must not repeat',
        }),
      position: z.enum(['Attack', 'DefenseUp']).optional(),
    })
    .strict(),
]);
export type Operation = z.infer<typeof OperationSchema>;
