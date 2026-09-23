import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../cards/card-definition.js';
import { SAMPLE_CARDS } from '../cards/sample-cards.js';
import { STARTER_DECK } from './starter-deck.js';
import { validateDeck } from './validate-deck.js';

const defs = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));

describe('STARTER_DECK', () => {
  it('passes validateDeck against the sample pool', () => {
    expect(validateDeck(STARTER_DECK, (id) => defs.get(id))).toEqual({ ok: true });
  });

  it('is a playable mix: has monsters of level 1-4 so turn 1 can Normal Summon', () => {
    const lowMonsters = STARTER_DECK.filter((id) => {
      const d = defs.get(id);
      return d?.kind === 'Monster' && d.level <= 4;
    });
    expect(lowMonsters.length).toBeGreaterThan(10);
  });
});
