import { z } from 'zod';
import {
  EffectDefinitionSchema,
  isActivationOnlyEffect,
  isEquipEffect,
  isFusionEffect,
} from '../effects/effect-definition.js';

/**
 * Static, author-time definition of a card. Runtime state (position, zone,
 * counters, current ATK/DEF after modifiers...) lives in the engine's
 * CardInstance, never here — CardDefinition is immutable content data.
 */

export { AttributeSchema, type Attribute } from './attribute.js';
import { AttributeSchema } from './attribute.js';

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

/** User-facing text in both supported languages (no fallback: both are required). */
export const LocalizedTextSchema = z.object({ vi: z.string().min(1), en: z.string().min(1) });
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

export type Lang = keyof LocalizedText;

export function pickText(text: LocalizedText, lang: Lang): string {
  return text[lang];
}

const CardDefinitionBaseSchema = z.object({
  id: z.string().min(1),
  name: LocalizedTextSchema,
  effectText: LocalizedTextSchema.optional(),
  /** Data-driven effects. See docs/design/effect-dsl.md */
  effects: z
    .array(EffectDefinitionSchema)
    .refine((list) => new Set(list.map((e) => e.id)).size === list.length, {
      message: 'effect ids must be unique within a card',
    })
    .optional(),
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
  /**
   * Task 4.5 [DECISION]: the materials of a Fusion Monster, each named by its card id (a repeated id = that many
   * copies). Exactly the Fusion Monsters have it (refine in CardDefinitionSchema). No generic materials yet.
   */
  fusionMaterials: z.array(z.string().min(1)).min(2).optional(),
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

export const CardDefinitionSchema = z
  .discriminatedUnion('kind', [
    MonsterCardDefinitionSchema,
    SpellCardDefinitionSchema,
    TrapCardDefinitionSchema,
  ])
  .refine(
    (card) =>
      (card.kind === 'Spell' && card.subType === 'Equip') ||
      !(card.effects ?? []).some(isEquipEffect),
    // Task 4.2c: Equip / ModifyStat.equipped only mean something on an Equip Spell.
    { message: 'Equip and ModifyStat.equipped belong to Equip Spells only' },
  )
  .refine(
    (card) =>
      !(card.effects ?? []).some(isActivationOnlyEffect) ||
      (staysOnField(card) && (card.effects ?? []).some((e) => e.trigger.kind === 'Continuous')),
    // Task 4.3: an effect that resolves into nothing only makes sense as the activation of a card that then stays
    // face-up and applies its Continuous effects.
    {
      message:
        'an empty activation effect belongs to a Continuous Spell/Trap or Field Spell that has a Continuous effect',
    },
  )
  .refine(
    (card) =>
      !(card.kind === 'Spell' && card.subType === 'Field') ||
      card.scriptId !== undefined ||
      (card.effects ?? []).some((e) => e.trigger.kind === 'Continuous' || e.scriptId !== undefined),
    // Task 4.3: a Field Spell does its work while it is face-up in the Field Zone.
    { message: 'a Field Spell needs a Continuous effect or a scriptId' },
  )
  .refine(
    (card) => {
      if (card.kind === 'Monster') return true;
      const effects = card.effects ?? [];
      if (!effects.some((e) => e.trigger.kind === 'Continuous')) return true;
      // [RULE] a Spell card is activated as Spell Speed 1 (Ignition), a Trap card as Quick.
      const activation = card.kind === 'Trap' ? 'Quick' : 'Ignition';
      return effects.some((e) => e.trigger.kind === activation);
    },
    // Task 4.3: a Continuous effect only holds once its card is face-up, and only an activation puts it there.
    {
      message:
        'a Spell/Trap with a Continuous effect needs an effect that activates the card (Spell: Ignition, Trap: Quick)',
    },
  )
  .refine(
    (card) =>
      card.kind !== 'Monster' ||
      (card.category === 'Fusion') === (card.fusionMaterials !== undefined),
    // Task 4.5: a Fusion Monster is Summoned from its materials only; nothing else has materials.
    { message: 'fusionMaterials belongs to Fusion Monsters, and every Fusion Monster needs it' },
  )
  .refine(
    (card) =>
      (card.kind === 'Spell' && card.subType === 'Normal') ||
      !(card.effects ?? []).some(isFusionEffect),
    // Task 4.5 [DECISION]: the fusion card is a Normal Spell (Spell Speed 1, your own Main Phase).
    { message: 'FusionSummon belongs to Normal Spells only' },
  );

/**
 * Task 4.3 [RULE]: after its activation resolves, a Continuous Spell/Trap or a Field Spell stays face-up on the field;
 * every other Spell/Trap goes to the graveyard (an Equip Spell stays only while equipped: the engine tracks that).
 */
export function staysOnField(card: { kind: string; subType?: string }): boolean {
  return (
    (card.kind === 'Spell' && (card.subType === 'Continuous' || card.subType === 'Field')) ||
    (card.kind === 'Trap' && card.subType === 'Continuous')
  );
}
export type CardDefinition = z.infer<typeof CardDefinitionSchema>;
