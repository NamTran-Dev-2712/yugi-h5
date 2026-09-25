import type { OperationKind } from '@yugi/shared';
import { applyDamage } from './damage.js';
import { applyDestroy } from './destroy.js';
import { applyDrawOperation } from './draw.js';
import { applyHeal } from './heal.js';
import type { OperationHandler } from './types.js';

/**
 * One handler per `OperationKind` (a new kind in `packages/shared` without a handler here is a `tsc` error).
 * `packages/shared`'s `OPERATION_REGISTRY` only says whether a kind is implemented; the functions live here.
 */
export const OPERATION_HANDLERS: { readonly [K in OperationKind]: OperationHandler<K> } = {
  Damage: applyDamage,
  Heal: applyHeal,
  Draw: applyDrawOperation,
  Destroy: applyDestroy,
};
