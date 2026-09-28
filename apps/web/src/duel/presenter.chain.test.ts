import {
  CardDefinitionSchema,
  PlayerActionSchema,
  SAMPLE_CARDS,
  type StateView,
} from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { t } from '../i18n/i18n';
import { formatDetail } from './detail-text';
import { FIXTURE_CARDS, FIXTURE_NAMES, loadFixture, type FixtureName } from './fixtures';
import { lookup } from './interaction.harness';
import { computeLayout } from './layout';
import { present, type RenderModel } from './presenter';
import { strings } from './strings';

/** Task 3.7: what the scene draws for a chain — activatable Set cards, "Bỏ qua", the chain banner, triggers, stats. */

const layout = computeLayout();
const model = (name: FixtureName): RenderModel => {
  const f = loadFixture(name);
  return present(f.view, f.legalActions, { lookup, layout });
};
const card = (m: RenderModel, id: string) => {
  const c = m.cards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};
const nameOf = (id: string): string => lookup(id)!.name.vi;

describe('test-only fixture cards', () => {
  it('are valid card definitions and are not in the real pool', () => {
    for (const c of FIXTURE_CARDS) {
      expect(CardDefinitionSchema.safeParse(c).success, c.id).toBe(true);
      expect(SAMPLE_CARDS.some((s) => s.id === c.id)).toBe(false);
    }
  });

  it.each(FIXTURE_NAMES)('%s lists only well-formed player actions', (name) => {
    for (const a of loadFixture(name).legalActions) {
      expect(PlayerActionSchema.safeParse(a).success, JSON.stringify(a)).toBe(true);
    }
  });
});

describe('activatable Set cards', () => {
  it('outlines my Set cards with a listed activation, and only those', () => {
    const m = model('chain-reaction');
    expect(card(m, 'p0-30').activatable).toBe(true);
    expect(card(m, 'p0-31').activatable).toBe(false);
    expect(card(m, 'p1-30').activatable).toBe(false);
    expect(m.cards.filter((c) => c.activatable).map((c) => c.id)).toEqual(['p0-30']);
  });

  it("never outlines an opponent's Set card, even if an activation names it (defence in depth)", () => {
    const f = loadFixture('chain-reaction');
    const odd = {
      type: 'ActivateEffect' as const,
      payload: { playerIndex: 0 as const, cardInstanceId: 'p1-30', effectId: 'x' },
    };
    const m = present(f.view, [odd, ...f.legalActions], { lookup, layout });
    expect(card(m, 'p1-30').activatable).toBe(false);
  });

  it('never outlines anything outside a listed activation (midgame)', () => {
    expect(model('midgame').cards.some((c) => c.activatable)).toBe(false);
  });
});

describe('"Bỏ qua" button', () => {
  it('takes the "Phase tiếp theo" spot when PassPriority is listed', () => {
    const m = model('chain-reaction');
    expect(m.buttons.map((b) => b.id)).toEqual(['pass', 'endTurn', 'surrender']);
    const pass = m.buttons[0]!;
    expect(pass.label).toBe(strings.pass);
    expect(pass.rect).toEqual(layout.buttons.nextPhase);
    expect(pass.enabled).toBe(true);
    expect(pass.action).toEqual({ type: 'PassPriority', payload: { playerIndex: 0 } });
  });

  it('is absent when PassPriority is not listed', () => {
    const ids = model('midgame').buttons.map((b) => b.id);
    expect(ids).toEqual(['nextPhase', 'endTurn', 'surrender']);
  });
});

describe('chain banner', () => {
  const withWindow = (window: StateView['chainWindow'], name: FixtureName = 'chain-reaction') => {
    const f = loadFixture(name);
    return present({ ...f.view, chainWindow: window }, f.legalActions, { lookup, layout });
  };

  it('reaction to an attack: says so, addressed to me', () => {
    expect(model('chain-reaction').chain).toEqual({ text: t('chain.reactionAttack'), mine: true });
  });

  it('reaction to a summon: a different sentence', () => {
    const m = withWindow({ priorityPlayer: 0, passCount: 0, reactionTo: { kind: 'Summon' } });
    expect(m.chain).toEqual({ text: t('chain.reactionSummon'), mine: true });
    expect(t('chain.reactionSummon')).not.toBe(t('chain.reactionAttack'));
  });

  it('an ordinary chain: link count and the top card name (the chain is public)', () => {
    expect(model('chain-respond').chain).toEqual({
      text: t('chain.respond', { count: 1, name: nameOf('FIX-305') }),
      mine: true,
    });
  });

  it('a chain of several links names the TOP link (the last one)', () => {
    const f = loadFixture('chain-respond');
    const bottom = f.view.chain[0]!;
    const top = {
      ...bottom,
      linkId: 'link-7-41',
      playerIndex: 0 as const,
      card: {
        ...bottom.card,
        instanceId: 'p0-32',
        definitionId: 'FIX-302',
        ownerIndex: 0 as const,
      },
      effectId: 'heal',
      spellSpeed: 2 as const,
    };
    const v: StateView = { ...f.view, chain: [bottom, top] };
    expect(present(v, f.legalActions, { lookup, layout }).chain?.text).toBe(
      t('chain.respond', { count: 2, name: nameOf('FIX-302') }),
    );
  });

  it('the opponent holds priority: waiting, not mine', () => {
    const m = withWindow({ priorityPlayer: 1, passCount: 0 }, 'chain-respond');
    expect(m.chain).toEqual({ text: t('chain.waitOpponent'), mine: false });
  });

  it('no window: no banner', () => {
    expect(model('midgame').chain).toBeNull();
  });
});

describe('TriggerActivation prompt', () => {
  it('names the card whose trigger asks', () => {
    expect(model('trigger-optional').prompt).toEqual({
      text: t('duel.triggerPrompt', { name: nameOf('FIX-303') }),
    });
  });

  it('a malformed payload falls back to the generic prompt text', () => {
    const f = loadFixture('trigger-optional');
    const v: StateView = { ...f.view, pendingPrompt: { ...f.view.pendingPrompt!, payload: null } };
    expect(present(v, f.legalActions, { lookup, layout }).prompt).toEqual({
      text: strings.promptOther,
    });
  });
});

describe('effective ATK/DEF', () => {
  const m = model('chain-respond');

  it('keeps the printed stats and adds only the changed effective ones', () => {
    expect(card(m, 'p0-11').label).toMatchObject({
      atk: 1500,
      def: 1100,
      effAtk: 1800,
      effDef: null,
    });
    expect(card(m, 'p1-10').label).toMatchObject({
      atk: 1600,
      def: 900,
      effAtk: null,
      effDef: 700,
    });
    expect(card(m, 'p0-10').label).toMatchObject({
      atk: 1300,
      def: 1200,
      effAtk: null,
      effDef: null,
    });
  });

  it('non-monsters and face-down cards carry no effective stats', () => {
    expect(card(m, 'p0-30').label).toBeNull();
    expect(card(m, 'p0-1').label).toMatchObject({ effAtk: null, effDef: null });
  });

  it('the detail panel shows the effective values and the printed ones', () => {
    const text = formatDetail(card(m, 'p0-11').detail);
    expect(text).toContain(t('detail.atkDef', { atk: 1800, def: 1100 }));
    expect(text).toContain(t('detail.printedStats', { atk: 1500, def: 1100 }));
    expect(formatDetail(card(m, 'p0-10').detail)).not.toContain(
      t('detail.printedStats', { atk: 1300, def: 1200 }),
    );
  });
});
