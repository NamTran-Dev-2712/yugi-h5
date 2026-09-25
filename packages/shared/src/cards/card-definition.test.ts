import { describe, expect, it } from 'vitest';
import { CardDefinitionSchema } from './card-definition.js';
import { SAMPLE_CARDS } from './sample-cards.js';

describe('CardDefinitionSchema', () => {
  it('accepts every sample card', () => {
    for (const card of SAMPLE_CARDS) {
      expect(CardDefinitionSchema.safeParse(card).success).toBe(true);
    }
  });

  it('rejects a monster with level out of range', () => {
    const result = CardDefinitionSchema.safeParse({
      id: 'BAD-001',
      kind: 'Monster',
      name: { vi: 'Lá hỏng', en: 'Broken Card' },
      category: 'Normal',
      attribute: 'DARK',
      race: 'Fiend',
      level: 13,
      atk: 100,
      def: 100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a card with unknown kind', () => {
    const result = CardDefinitionSchema.safeParse({
      id: 'BAD-002',
      kind: 'Ritual',
      name: 'Not A Real Kind',
    });
    expect(result.success).toBe(false);
  });
});
