import { z } from 'zod';

/** Batch 1 triggers. `Continuous` never goes on the chain. */
export const TriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('OnSummon') }).strict(),
  z.object({ kind: z.literal('OnFlip') }).strict(),
  z.object({ kind: z.literal('Continuous') }).strict(),
  z.object({ kind: z.literal('Ignition') }).strict(),
  z.object({ kind: z.literal('Quick') }).strict(),
]);
export type Trigger = z.infer<typeof TriggerSchema>;
