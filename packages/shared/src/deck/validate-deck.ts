import type { CardDefinition } from '../cards/card-definition.js';

/** Deck size: min 40 [RULE], max 60 [REF]. Copies per card: max 3 [REF]. */
export const DECK_MIN_SIZE = 40;
export const DECK_MAX_SIZE = 60;
export const DECK_MAX_COPIES = 3;

export type DeckError =
  | { readonly code: 'TOO_FEW'; readonly size: number; readonly min: number }
  | { readonly code: 'TOO_MANY'; readonly size: number; readonly max: number }
  | {
      readonly code: 'TOO_MANY_COPIES';
      readonly definitionId: string;
      readonly count: number;
      readonly max: number;
    }
  | { readonly code: 'UNKNOWN_CARD'; readonly definitionId: string };

export type DeckValidation =
  { readonly ok: true } | { readonly ok: false; readonly errors: readonly DeckError[] };

/**
 * Pure deck check reusable by the API (solo/PvP) and the Deck Builder. Reports every problem at once, in a
 * stable order: size, then unknown ids (first-seen order), then over-limit copies (first-seen order).
 * Unknown ids are reported once each and are not counted towards the copy limit.
 */
export function validateDeck(
  deck: readonly string[],
  lookup: (definitionId: string) => CardDefinition | undefined,
): DeckValidation {
  const errors: DeckError[] = [];

  if (deck.length < DECK_MIN_SIZE) {
    errors.push({ code: 'TOO_FEW', size: deck.length, min: DECK_MIN_SIZE });
  } else if (deck.length > DECK_MAX_SIZE) {
    errors.push({ code: 'TOO_MANY', size: deck.length, max: DECK_MAX_SIZE });
  }

  const counts = new Map<string, number>();
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);

  const known: [string, number][] = [];
  for (const [id, count] of counts) {
    if (lookup(id)) known.push([id, count]);
    else errors.push({ code: 'UNKNOWN_CARD', definitionId: id });
  }
  for (const [id, count] of known) {
    if (count > DECK_MAX_COPIES) {
      errors.push({ code: 'TOO_MANY_COPIES', definitionId: id, count, max: DECK_MAX_COPIES });
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
