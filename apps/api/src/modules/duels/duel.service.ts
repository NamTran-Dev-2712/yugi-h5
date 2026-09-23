import { Inject, Injectable } from '@nestjs/common';
import { lookupCard } from './card-pool';
import { DuelManager } from './duel-manager';
import type { DuelStore } from './duel-store';

export const DUEL_STORE = Symbol('DUEL_STORE');

/**
 * Nest wrapper: all logic lives in the framework-free `DuelManager`; this only wires the store and the
 * card pool (placeholder set until real card data lands). Every duel state change must go through here.
 */
@Injectable()
export class DuelService extends DuelManager {
  constructor(@Inject(DUEL_STORE) store: DuelStore) {
    super({ store, cardDefinitions: lookupCard });
  }
}
