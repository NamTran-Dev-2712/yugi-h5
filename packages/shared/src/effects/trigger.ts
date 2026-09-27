import { z } from 'zod';

/**
 * `mandatory` (task 3.5) on trigger effects: false/omitted = optional (the owner is asked), true = always activates.
 */
const TriggeredSchemaFields = { mandatory: z.boolean().optional() };

/** Batch 1 triggers (+ `OnDestroyed`, task 3.5). `Continuous` never goes on the chain. */
export const TriggerSchema = z.discriminatedUnion('kind', [
  /** When this monster is Normal Summoned (Tribute Summon included; a Set is not a Summon) [RULE]. */
  z.object({ kind: z.literal('OnSummon'), ...TriggeredSchemaFields }).strict(),
  z.object({ kind: z.literal('OnFlip') }).strict(),
  z.object({ kind: z.literal('Continuous') }).strict(),
  z.object({ kind: z.literal('Ignition') }).strict(),
  z.object({ kind: z.literal('Quick') }).strict(),
  /** When this card is destroyed (by battle or by an effect) and sent to the graveyard. */
  z.object({ kind: z.literal('OnDestroyed'), ...TriggeredSchemaFields }).strict(),
]);
export type Trigger = z.infer<typeof TriggerSchema>;
