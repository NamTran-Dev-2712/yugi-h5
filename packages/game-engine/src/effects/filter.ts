import type { CardDefinition, CardFilter, Side } from '@yugi/shared';

/** Player index a relative `side` refers to, from the effect controller's point of view. */
export function sideIndex(controller: 0 | 1, side: Side): 0 | 1 {
  return side === 'self' ? controller : controller === 0 ? 1 : 0;
}

/** Every criterion present in `filter` must hold. Level/attribute/race only ever match Monsters. */
export function matchesFilter(def: CardDefinition, filter: CardFilter): boolean {
  if (filter.kind !== undefined && def.kind !== filter.kind) return false;
  if (filter.level !== undefined) {
    if (def.kind !== 'Monster') return false;
    if (filter.level.min !== undefined && def.level < filter.level.min) return false;
    if (filter.level.max !== undefined && def.level > filter.level.max) return false;
  }
  if (filter.attribute !== undefined) {
    if (def.kind !== 'Monster' || def.attribute !== filter.attribute) return false;
  }
  if (filter.race !== undefined) {
    if (def.kind !== 'Monster' || def.race !== filter.race) return false;
  }
  return true;
}
