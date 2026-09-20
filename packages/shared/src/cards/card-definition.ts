import { z } from 'zod';

/**
 * Static, author-time definition of a card. Runtime state (position, zone,
 * counters, current ATK/DEF after modifiers...) lives in the engine's
 * CardInstance, never here — CardDefinition is immutable content data.
 */

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

export const MonsterCategorySchema = z.enum(['Normal', 'Effect', 'Fusion', 'Ritual']);
export type MonsterCategory = z.infer<typeof MonsterCategorySchema>;

export const SpellSubTypeSchema = z.enum([
  'Normal',
  'Continuous',
  'QuickPlay',
  'Equip',
  'Field',
  'Ritual',
]);
export type SpellSubType = z.infer<typeof SpellSubTypeSchema>;

export const TrapSubTypeSchema = z.enum(['Normal', 'Continuous', 'Counter']);
export type TrapSubType = z.infer<typeof TrapSubTypeSchema>;

const CardDefinitionBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  effectText: z.string().optional(),
  /** Handler key for effects too complex to express via the effect DSL. See docs/design/effect-dsl.md */
  scriptId: z.string().optional(),
});

export const MonsterCardDefinitionSchema = CardDefinitionBaseSchema.extend({
  kind: z.literal('Monster'),
  category: MonsterCategorySchema,
  attribute: AttributeSchema,
  race: z.string().min(1),
  level: z.number().int().min(1).max(12),
  atk: z.number().int().min(0),
  def: z.number().int().min(0),
});
export type MonsterCardDefinition = z.infer<typeof MonsterCardDefinitionSchema>;

export const SpellCardDefinitionSchema = CardDefinitionBaseSchema.extend({
  kind: z.literal('Spell'),
  subType: SpellSubTypeSchema,
});
export type SpellCardDefinition = z.infer<typeof SpellCardDefinitionSchema>;

export const TrapCardDefinitionSchema = CardDefinitionBaseSchema.extend({
  kind: z.literal('Trap'),
  subType: TrapSubTypeSchema,
});
export type TrapCardDefinition = z.infer<typeof TrapCardDefinitionSchema>;

export const CardDefinitionSchema = z.discriminatedUnion('kind', [
  MonsterCardDefinitionSchema,
  SpellCardDefinitionSchema,
  TrapCardDefinitionSchema,
]);
export type CardDefinition = z.infer<typeof CardDefinitionSchema>;
