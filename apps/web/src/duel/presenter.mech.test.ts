import { SAMPLE_CARDS, type StateView } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { loadFixture } from './fixtures';
import { computeLayout } from './layout';
import { pickerCards, present, type RenderModel } from './presenter';

/** Task 4.2d — the Equip relation (`equippedTo` from the server) and the effective ATK it causes (G16). */

const byId = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));
const layout = computeLayout();
const model = (view: StateView): RenderModel =>
  present(view, loadFixture('equip').legalActions, { lookup: (id) => byId.get(id), layout });
const card = (m: RenderModel, id: string) => m.cards.find((c) => c.id === id)!;

describe('present — Equip relation (task 4.2d)', () => {
  const m = model(loadFixture('equip').view);

  it('carries equippedTo on the face-up Equip cards only', () => {
    expect(card(m, 'p0-20').equippedTo).toBe('p0-10');
    expect(card(m, 'p1-21').equippedTo).toBe('p1-13');
    expect(card(m, 'p1-24').equippedTo).toBeNull();
    expect(card(m, 'p0-10').equippedTo).toBeNull();
  });

  it('lists one link per Equip whose monster is on the board', () => {
    expect(m.equipLinks).toEqual([
      { equipId: 'p0-20', monsterId: 'p0-10' },
      { equipId: 'p1-21', monsterId: 'p1-13' },
    ]);
  });

  it('drops a link whose monster is not rendered (never guesses)', () => {
    const v = loadFixture('equip').view;
    const self = v.players[0];
    const noMonster: StateView = {
      ...v,
      players: [
        {
          ...self,
          board: {
            ...self.board,
            monsterZones: [null, null, null, null, null],
          },
        },
        v.players[1],
      ],
    };
    expect(model(noMonster).equipLinks).toEqual([{ equipId: 'p1-21', monsterId: 'p1-13' }]);
  });

  it('the equipped monster shows its effective ATK next to the printed one', () => {
    expect(card(m, 'p0-10').label).toMatchObject({ atk: 1200, effAtk: 1700, effDef: null });
  });

  it('no Equip on the board → no links', () => {
    expect(model(loadFixture('flip').view).equipLinks).toEqual([]);
  });
});

describe('pickerCards (task 4.2d)', () => {
  it('draws graveyard candidates face-up at their slots and skips ids it cannot see', () => {
    const f = loadFixture('gy-target');
    const rect = { x: 1, y: 2, w: 3, h: 4 };
    const cards = pickerCards(
      f.view,
      [
        { id: 'p0-40', rect },
        { id: 'nope', rect },
      ],
      (id) => byId.get(id),
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: 'p0-40',
      rect,
      faceDown: false,
      label: { name: expect.any(String) },
    });
  });
});
