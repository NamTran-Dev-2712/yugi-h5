import { SAMPLE_CARDS } from '@yugi/shared';
import { createDuelApi, type TokenStorage } from '../api/duel-api';
import { createAnimatorHost } from './animation-player';
import { createDuelController, type DuelController } from './duel-controller';
import type { CardLookup } from './presenter';

const byId = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));

/** Card data comes from @yugi/shared; the placeholder pool until the real card set lands. */
export const cardLookup: CardLookup = (id) => byId.get(id);

function browserStorage(): TokenStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined; // blocked (private window, disabled site data)
  }
}

/** The duel scene attaches its animation player here while it is on screen (see `animation-player.ts`). */
export const animatorHost = createAnimatorHost();

export function createAppController(): DuelController {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  return createDuelController({
    api: createDuelApi({
      baseUrl,
      fetch: (url, init) => window.fetch(url, init),
      storage: browserStorage(),
    }),
    lookup: cardLookup,
    animator: animatorHost.animator,
  });
}
