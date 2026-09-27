import type { CardDefinition, EffectDefinition } from '@yugi/shared';

/**
 * Spell Speed of an effect on the chain (task 3.4). An explicit `effect.spellSpeed` wins; otherwise the [RULE] default
 * from the card: Counter Trap 3, any other Trap 2, Quick-Play Spell 2, everything else (Normal Spell, ...) 1.
 */
export function spellSpeedOf(definition: CardDefinition, effect: EffectDefinition): 1 | 2 | 3 {
  if (effect.spellSpeed !== undefined) return effect.spellSpeed;
  if (definition.kind === 'Trap') return definition.subType === 'Counter' ? 3 : 2;
  if (definition.kind === 'Spell' && definition.subType === 'QuickPlay') return 2;
  return 1;
}
