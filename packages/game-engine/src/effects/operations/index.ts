import type { ResolveOperationKind } from '@yugi/shared';
import { applyDamage } from './damage.js';
import { applyDestroy } from './destroy.js';
import { applyDrawOperation } from './draw.js';
import { applyHeal } from './heal.js';
import { applySpecialSummon } from './special-summon.js';
import type { OperationHandler } from './types.js';

/**
 * One handler per resolve-time `OperationKind` (a new kind in `packages/shared` without a handler here is a `tsc`
 * error). Continuous kinds (task 3.6) have their handlers in `effects/continuous.ts`.
 * `packages/shared`'s `OPERATION_REGISTRY` only says whether a kind is implemented; the functions live here.
 */
export const OPERATION_HANDLERS: { readonly [K in ResolveOperationKind]: OperationHandler<K> } = {
  Damage: applyDamage,
  Heal: applyHeal,
  Draw: applyDrawOperation,
  Destroy: applyDestroy,
  SpecialSummon: applySpecialSummon,
};
