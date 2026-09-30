import { SAMPLE_CARDS, type MonsterCardDefinition } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import type { Action } from '../../actions/types.js';
import { apply, attack, battle, lp, main, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.1 — Tier A (vanilla) smoke test, one run per vanilla monster of SAMPLE_CARDS (card-and-effect-plan.md
 * "Quy ước test mỗi card"): Normal Summon works with the [RULE] tribute count for its Level, and a direct attack deals
 * exactly its ATK. The stat table is snapshotted so a changed ATK/DEF/Level is a visible diff.
 */

const VANILLA = SAMPLE_CARDS.filter(
  (c): c is MonsterCardDefinition =>
    c.kind === 'Monster' && c.category === 'Normal' && (c.effects?.length ?? 0) === 0,
);

const tributesFor = (level: number): number => (level >= 7 ? 2 : level >= 5 ? 1 : 0);

describe('vanilla monsters (Tier A)', () => {
  it('every vanilla has no effect data at all', () => {
    for (const card of VANILLA) {
      expect(card.effectText, card.id).toBeUndefined();
      expect(card.scriptId, card.id).toBeUndefined();
    }
  });

  it.each(VANILLA.map((c) => [c.id, c] as const))(
    '%s: Normal Summon with the right number of tributes',
    (_id, card) => {
      const n = tributesFor(card.level);
      const fodder = Array.from({ length: n }, (_, i) => [i + 1, 'M1'] as [number, string]);
      const before = main({ hand: [card.id], myMonsters: fodder });
      const action: Action = {
        type: 'NormalSummon',
        payload: {
          playerIndex: 0,
          cardInstanceId: 'h0',
          zoneIndex: 0,
          ...(n > 0 ? { tributeInstanceIds: fodder.map(([z]) => `m0-${z}`) } : {}),
        },
      };
      const { state, events } = apply(before, action);
      expect(types(events).filter((t) => t === 'MonsterTributed')).toHaveLength(n);
      expect(state.players[0].board.monsterZones[0]).toMatchObject({
        definitionId: card.id,
        position: 'Attack',
      });
    },
  );

  it.each(VANILLA.map((c) => [c.id, c] as const))(
    '%s: a direct attack deals exactly its ATK',
    (_id, card) => {
      const { state } = apply(battle({ myMonsters: [[0, card.id]] }), attack('m0-0'));
      expect(lp(state)).toEqual([8000, Math.max(0, 8000 - card.atk)]);
    },
  );

  it('stat table', () => {
    expect(
      VANILLA.map(({ id, attribute, race, level, atk, def }) => ({
        id,
        attribute,
        race,
        level,
        atk,
        def,
      })),
    ).toMatchSnapshot();
  });
});
