import { Inject, Injectable } from '@nestjs/common';
import { SAMPLE_CARDS, type CardDefinition } from '@yugi/shared';
import { DuelManager } from './duel-manager';
import type { DuelStore } from './duel-store';

export const DUEL_STORE = Symbol('DUEL_STORE');

const CARDS_BY_ID = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));

/**
 * Nest wrapper: all logic lives in the framework-free `DuelManager`; this only wires the store and the
 * card pool (placeholder set until real card data lands). Every duel state change must go through here.
 */
@Injectable()
export class DuelService extends DuelManager {
  constructor(@Inject(DUEL_STORE) store: DuelStore) {
    super({ store, cardDefinitions: (id) => CARDS_BY_ID.get(id) });
  }
}
