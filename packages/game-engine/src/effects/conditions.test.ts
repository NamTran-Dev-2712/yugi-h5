import { describe, expect, it } from 'vitest';
import { fixtureState } from '../testing/effect-fixtures.js';
import { conditionsHold } from './conditions.js';

describe('conditionsHold', () => {
  const state = fixtureState({
    hand: ['DRAW', 'M1', 'M1'],
    phase: 'Main2',
    myMonsters: [[0, 'M1']],
    oppMonsters: [
      [0, 'M1'],
      [1, 'M1'],
    ],
  });

  it('an absent or empty list holds', () => {
    expect(conditionsHold(state, 0, undefined)).toBe(true);
    expect(conditionsHold(state, 0, [])).toBe(true);
  });

  it('PhaseIs compares with the current phase', () => {
    expect(conditionsHold(state, 0, [{ kind: 'PhaseIs', phase: 'Main2' }])).toBe(true);
    expect(conditionsHold(state, 0, [{ kind: 'PhaseIs', phase: 'Main1' }])).toBe(false);
  });

  it('IsMyTurn is relative to the controller', () => {
    expect(conditionsHold(state, 0, [{ kind: 'IsMyTurn' }])).toBe(true);
    expect(conditionsHold(state, 1, [{ kind: 'IsMyTurn' }])).toBe(false);
  });

  it('ZoneCount honours min, max and the side, per zone', () => {
    const count = (
      zone: 'Hand' | 'MonsterZone' | 'SpellTrapZone' | 'Graveyard' | 'Deck',
      side: 'self' | 'opponent',
      min?: number,
      max?: number,
    ) =>
      conditionsHold(state, 0, [
        {
          kind: 'ZoneCount',
          zone,
          side,
          ...(min !== undefined ? { min } : {}),
          ...(max !== undefined ? { max } : {}),
        },
      ]);
    expect(count('Hand', 'self', 3, 3)).toBe(true);
    expect(count('Hand', 'self', 4)).toBe(false);
    expect(count('MonsterZone', 'self', 1, 1)).toBe(true);
    expect(count('MonsterZone', 'opponent', 2, 2)).toBe(true);
    expect(count('MonsterZone', 'opponent', undefined, 1)).toBe(false);
    expect(count('SpellTrapZone', 'opponent', undefined, 0)).toBe(true);
    expect(count('Graveyard', 'self', 1)).toBe(false);
    expect(count('Deck', 'self', 1)).toBe(true);
  });

  it('conditions are ANDed', () => {
    expect(
      conditionsHold(state, 0, [{ kind: 'IsMyTurn' }, { kind: 'PhaseIs', phase: 'Main1' }]),
    ).toBe(false);
  });
});
