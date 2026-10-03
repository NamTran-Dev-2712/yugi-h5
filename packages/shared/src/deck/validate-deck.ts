import type { CardDefinition } from '../cards/card-definition.js';

/** Deck size: min 40 [RULE], max 60 [REF]. Copies per card: max 3 [REF]. */
export const DECK_MIN_SIZE = 40;
export const DECK_MAX_SIZE = 60;
export const DECK_MAX_COPIES = 3;
/** Task 4.5: Extra Deck size, C3 [REF, low: 1 source] — the default of `RulesetConfig.extraDeckSize`. */
export const EXTRA_DECK_MAX_SIZE = 20;

export type DeckError =
  | { readonly code: 'TOO_FEW'; readonly size: number; readonly min: number }
  | { readonly code: 'TOO_MANY'; readonly size: number; readonly max: number }
  | {
      readonly code: 'TOO_MANY_COPIES';
      readonly definitionId: string;
      readonly count: number;
      readonly max: number;
    }
  | { readonly code: 'UNKNOWN_CARD'; readonly definitionId: string }
  /** Task 4.5: a Fusion Monster lives in the Extra Deck, never in the Main Deck. */
  | { readonly code: 'FUSION_IN_MAIN_DECK'; readonly definitionId: string }
  | { readonly code: 'EXTRA_TOO_MANY'; readonly size: number; readonly max: number }
  /** Task 4.5: the Extra Deck holds Fusion Monsters only. */
  | { readonly code: 'EXTRA_NOT_FUSION'; readonly definitionId: string };

export type DeckValidation =
  { readonly ok: true } | { readonly ok: false; readonly errors: readonly DeckError[] };

const isFusion = (card: CardDefinition): boolean =>
  card.kind === 'Monster' && card.category === 'Fusion';

/**
 * Pure deck check reusable by the API (solo/PvP) and the Deck Builder. Reports every problem at once, in a
 * stable order: size, then unknown ids (first-seen order), then Fusion Monsters in the Main Deck, then over-limit
 * copies (first-seen order). Unknown ids are reported once each and are not counted towards the copy limit.
 * Task 4.5: `extraDeck` (optional) is checked after the Main Deck, in the same order: size (`extraDeckMax`, pass
 * `RulesetConfig.extraDeckSize`), unknown ids, cards that are not Fusion Monsters, over-limit copies.
 */
export function validateDeck(
  deck: readonly string[],
  lookup: (definitionId: string) => CardDefinition | undefined,
  extraDeck: readonly string[] = [],
  extraDeckMax: number = EXTRA_DECK_MAX_SIZE,
): DeckValidation {
  const errors: DeckError[] = [];

  if (deck.length < DECK_MIN_SIZE) {
    errors.push({ code: 'TOO_FEW', size: deck.length, min: DECK_MIN_SIZE });
  } else if (deck.length > DECK_MAX_SIZE) {
    errors.push({ code: 'TOO_MANY', size: deck.length, max: DECK_MAX_SIZE });
  }
  errors.push(...checkCards(deck, lookup, false));

  if (extraDeck.length > extraDeckMax) {
    errors.push({ code: 'EXTRA_TOO_MANY', size: extraDeck.length, max: extraDeckMax });
  }
  errors.push(...checkCards(extraDeck, lookup, true));

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** Unknown ids, then cards on the wrong side of the Main / Extra split, then over-limit copies of the rest. */
function checkCards(
  list: readonly string[],
  lookup: (definitionId: string) => CardDefinition | undefined,
  extra: boolean,
): DeckError[] {
  const counts = new Map<string, number>();
  for (const id of list) counts.set(id, (counts.get(id) ?? 0) + 1);

  const unknown: DeckError[] = [];
  const misplaced: DeckError[] = [];
  const copies: DeckError[] = [];
  for (const [id, count] of counts) {
    const card = lookup(id);
    if (!card) {
      unknown.push({ code: 'UNKNOWN_CARD', definitionId: id });
    } else if (isFusion(card) !== extra) {
      misplaced.push({
        code: extra ? 'EXTRA_NOT_FUSION' : 'FUSION_IN_MAIN_DECK',
        definitionId: id,
      });
    } else if (count > DECK_MAX_COPIES) {
      copies.push({ code: 'TOO_MANY_COPIES', definitionId: id, count, max: DECK_MAX_COPIES });
    }
  }
  return [...unknown, ...misplaced, ...copies];
}
