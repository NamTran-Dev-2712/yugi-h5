import { SAMPLE_CARDS, type CardDefinition } from '@yugi/shared';

const CARDS_BY_ID = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));

/** The card pool the server knows (placeholder set until real card data lands). */
export const lookupCard = (definitionId: string): CardDefinition | undefined =>
  CARDS_BY_ID.get(definitionId);
