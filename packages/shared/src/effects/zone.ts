import { z } from 'zod';

/** Zones an effect can talk about. Declared here (shared cannot import the engine). */
export const EffectZoneSchema = z.enum([
  'Hand',
  'Deck',
  'Graveyard',
  'MonsterZone',
  'SpellTrapZone',
]);
export type EffectZone = z.infer<typeof EffectZoneSchema>;

/** Whose zone: relative to the effect's controller. */
export const SideSchema = z.enum(['self', 'opponent']);
export type Side = z.infer<typeof SideSchema>;
