import { z } from 'zod';

export const AttributeSchema = z.enum([
  'DARK',
  'LIGHT',
  'EARTH',
  'WATER',
  'FIRE',
  'WIND',
  'DIVINE',
]);
export type Attribute = z.infer<typeof AttributeSchema>;
