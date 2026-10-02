import { SAMPLE_CARDS, type CardView, type StateView } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { FIXTURE_CARDS, loadFixture, type FixtureName } from './fixtures';
import { computeLayout } from './layout';
import { present, type RenderModel } from './presenter';
import { t } from '../i18n/i18n';

/**
 * Task 4.3b — the Field Zone and the cards that stay on the field in the render model: where the Field card is drawn,
 * what the viewer may know about it, which cards carry the "in force" mark, and the effective ATK the server sent (G16).
 * The presenter reads card data and the server view only; it never decides a rule.
 */

const byId = new Map([...SAMPLE_CARDS, ...FIXTURE_CARDS].map((c) => [c.id, c]));
const layout = computeLayout();
const modelOf = (view: StateView, legal = loadFixture('field').legalActions): RenderModel =>
  present(view, legal, { lookup: (id) => byId.get(id), layout });
const fixtureModel = (name: FixtureName): RenderModel => {
  const f = loadFixture(name);
  return present(f.view, f.legalActions, { lookup: (id) => byId.get(id), layout });
};
const card = (m: RenderModel, id: string) => {
  const c = m.cards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};

describe('present — the card in the Field Zone (task 4.3b)', () => {
  it('is drawn in the Field Zone of its side, upright, with the spell frame when face-up', () => {
    const m = fixtureModel('field-active');
    expect(card(m, 'p0-30')).toMatchObject({
      side: 'self',
      zone: 'field',
      rect: layout.self.fieldZone,
      faceDown: false,
      frame: 'spell',
      defense: false,
    });
    expect(card(m, 'p1-30')).toMatchObject({
      side: 'opp',
      zone: 'field',
      rect: layout.opp.fieldZone,
      faceDown: false,
    });
    expect(card(m, 'p0-30').detail?.name).toBe(byId.get('SMP-113')!.name.vi);
  });

  it('my Set Field Spell: face-down, upright, known to me, and tappable only when the server lists its activation', () => {
    const f = loadFixture('field-set');
    const m = fixtureModel('field-set');
    expect(card(m, 'p0-30')).toMatchObject({
      zone: 'field',
      faceDown: true,
      frame: null,
      defense: false,
      label: null,
      activatable: true,
    });
    expect(card(m, 'p0-30').detail?.name).toBe(byId.get('SMP-113')!.name.vi);
    const unlisted = modelOf(
      f.view,
      f.legalActions.filter(
        (a) => !(a.type === 'ActivateEffect' && a.payload.cardInstanceId === 'p0-30'),
      ),
    );
    expect(card(unlisted, 'p0-30').activatable).toBe(false);
  });

  it("the opponent's Set Field card is a nameless card back: nothing about it is in the model", () => {
    const m = fixtureModel('field-set');
    expect(card(m, 'p1-30')).toMatchObject({
      zone: 'field',
      faceDown: true,
      label: null,
      detail: null,
      activatable: false,
      active: false,
      fieldCard: false,
    });
    // Even if an activation named it (server bug), the opponent's card is never outlined.
    const f = loadFixture('field-set');
    const forged = modelOf(f.view, [
      ...f.legalActions,
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p1-30', effectId: 'activate' },
      },
    ]);
    expect(card(forged, 'p1-30').activatable).toBe(false);
  });

  it('defence in depth: a face-down opponent Field card sent "visible" by mistake is still drawn nameless', () => {
    const f = loadFixture('field-set');
    const leaked: CardView = {
      hidden: false,
      instanceId: 'p1-30',
      definitionId: 'SMP-113',
      ownerIndex: 1,
      position: 'DefenseDown',
    };
    const view: StateView = {
      ...f.view,
      players: [
        f.view.players[0],
        { ...f.view.players[1], board: { ...f.view.players[1].board, fieldZone: leaked } },
      ],
    };
    const c = card(modelOf(view, f.legalActions), 'p1-30');
    expect(c).toMatchObject({ faceDown: true, label: null, detail: null, fieldCard: false });
    expect(JSON.stringify(c)).not.toContain('SMP-113');
  });
});

describe('present — fieldCard (which hand cards go to the Field Zone)', () => {
  it('is true for a Field Spell the viewer knows, false for every other card', () => {
    const m = fixtureModel('field');
    expect(card(m, 'p0-1').fieldCard).toBe(true); // SMP-113 in my hand
    expect(card(m, 'p0-2').fieldCard).toBe(false); // SMP-114 Continuous Spell
    expect(card(m, 'p0-3').fieldCard).toBe(false); // a monster
    expect(m.cards.filter((c) => c.side === 'opp').every((c) => !c.fieldCard)).toBe(true);
  });
});

describe('present — the "in force" mark (active)', () => {
  const m = fixtureModel('field-active');

  it('marks face-up Field / Continuous Spell / Continuous Trap cards resting on the field, on both sides', () => {
    expect(m.cards.filter((c) => c.active).map((c) => c.id)).toEqual([
      'p0-31',
      'p0-32',
      'p0-30',
      'p1-30',
    ]);
  });

  it('never marks a face-down card, a hand card, a monster or a hidden card', () => {
    expect(card(m, 'p0-33').active).toBe(false); // Set SMP-208
    expect(card(m, 'p0-3').active).toBe(false);
    expect(card(m, 'p0-10').active).toBe(false);
    expect(card(m, 'p1-21').active).toBe(false);
    expect(card(fixtureModel('field-set'), 'p0-30').active).toBe(false);
  });

  it('does not mark an Equip Spell (its own link shows it) nor a one-shot Trap waiting on the chain', () => {
    expect(fixtureModel('equip').cards.some((c) => c.active)).toBe(false);
    expect(fixtureModel('chain-respond').cards.some((c) => c.active)).toBe(false);
  });

  it('a staying card is in force as soon as it is face-up, even while its activation link still waits (as the server effectiveStats)', () => {
    const f = loadFixture('field-active');
    const waiting: StateView = {
      ...f.view,
      chain: [
        {
          linkId: 'link-6-1',
          playerIndex: 0,
          card: {
            hidden: false,
            instanceId: 'p0-31',
            definitionId: 'SMP-114',
            ownerIndex: 0,
            position: null,
          },
          source: { zone: 'SpellTrapZone', zoneIndex: 0 },
          effectId: 'activate',
          spellSpeed: 1,
          targetInstanceIds: [],
        },
      ],
      chainWindow: { priorityPlayer: 1, passCount: 0 },
    };
    const w = modelOf(waiting, f.legalActions);
    expect(card(w, 'p0-31').active).toBe(true);
    expect(card(w, 'p0-32').active).toBe(true);
    expect(card(w, 'p0-30').active).toBe(true);
  });

  it('the detail panel of a card in force says so', () => {
    expect(card(m, 'p0-30').detail?.active).toBe(true);
    expect(card(m, 'p0-10').detail?.active).toBe(false);
  });
});

describe('present — effective ATK from a Field Spell (G16)', () => {
  const m = fixtureModel('field-active');

  it('shows the effective value the server sent next to the printed one, and nothing when they are equal', () => {
    expect(card(m, 'p0-10').label).toMatchObject({ atk: 1600, effAtk: 2500, effDef: null });
    expect(card(m, 'p0-11').label).toMatchObject({ atk: 1500, effAtk: null });
    expect(card(m, 'p1-12').label).toMatchObject({ atk: 1700, effAtk: 2000 });
    expect(card(m, 'p1-13').label).toMatchObject({ atk: 1700, effAtk: 1400 });
  });
});

describe('chain banner in a reaction window that already has links (task 4.3b, debt of 3.8)', () => {
  const f = loadFixture('chain-reaction');
  const link = {
    linkId: 'link-6-1',
    playerIndex: 0 as const,
    card: {
      hidden: false as const,
      instanceId: 'p0-30',
      definitionId: 'FIX-301',
      ownerIndex: 0 as const,
      position: null,
    },
    source: { zone: 'SpellTrapZone' as const, zoneIndex: 1 },
    effectId: 'destroy-one',
    spellSpeed: 2 as const,
    targetInstanceIds: [],
  };
  const name = byId.get('FIX-301')!.name.vi;

  it('an empty reaction window still says what it reacts to', () => {
    expect(modelOf(f.view, f.legalActions).chain).toEqual({
      text: t('chain.reactionAttack'),
      mine: true,
    });
  });

  it('once a link is on the chain it says "chain of N links" (and names the top card), not "the opponent attacks"', () => {
    const view: StateView = { ...f.view, chain: [link] };
    expect(modelOf(view, f.legalActions).chain).toEqual({
      text: t('chain.respond', { count: 1, name }),
      mine: true,
    });
    const two: StateView = { ...f.view, chain: [link, { ...link, linkId: 'link-6-2' }] };
    expect(modelOf(two, f.legalActions).chain?.text).toBe(t('chain.respond', { count: 2, name }));
  });

  it('a Summon reaction window with a link: the same', () => {
    const view: StateView = {
      ...f.view,
      chain: [link],
      chainWindow: { priorityPlayer: 0, passCount: 0, reactionTo: { kind: 'Summon' } },
    };
    expect(modelOf(view, f.legalActions).chain?.text).toBe(t('chain.respond', { count: 1, name }));
  });

  it('the opponent holding priority still reads "waiting"', () => {
    const view: StateView = {
      ...f.view,
      chain: [link],
      chainWindow: { ...f.view.chainWindow!, priorityPlayer: 1 },
    };
    expect(modelOf(view, f.legalActions).chain).toEqual({
      text: t('chain.waitOpponent'),
      mine: false,
    });
  });
});
