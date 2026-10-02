import type { PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { t } from '../i18n/i18n';
import { messageFor } from './error-messages';
import { loadFixture } from './fixtures';
import { overlayFor, type InteractionState } from './interaction';
import {
  cardRect,
  centre,
  click,
  drag,
  fixtureCtx,
  layout,
  lookup,
  sends,
  start,
  toasts,
  type Run,
} from './interaction.harness';
import { present } from './presenter';
import { strings } from './strings';

/**
 * Task 4.4b — Counter Traps in the UI, with the real cards SMP-209 / SMP-210 (Counter) and SMP-201 (Normal Trap that
 * negates an attack). The client knows no rule about them: a Set card is outlined and tappable only when the server
 * lists an `ActivateEffect` for it. On my own Main Phase the server lists none (`NOTHING_TO_RESPOND_TO` on its side),
 * so nothing may say "Kích hoạt"; in a reaction window only the card the server lists answers.
 */

const kindOf = (r: Run): InteractionState['kind'] => r.state.kind;
const SET_TRAPS = ['p0-30', 'p0-31', 'p0-32'];

describe('Set Counter Traps on my own Main Phase (fixture counter-main)', () => {
  const ctx = fixtureCtx('counter-main');
  const f = loadFixture('counter-main');

  it('the fixture is the situation: three Set Traps of mine, my turn, no window, no ActivateEffect listed', () => {
    expect(f.view.turnPlayerIndex).toBe(0);
    expect(f.view.phase).toBe('Main1');
    expect(f.view.chainWindow).toBeNull();
    expect(f.legalActions.some((a) => a.type === 'ActivateEffect')).toBe(false);
    const traps = f.view.players[0].board.spellTrapZones.flatMap((c) =>
      c && !c.hidden ? [c.definitionId] : [],
    );
    expect(traps).toEqual(['SMP-209', 'SMP-210', 'SMP-201']);
    expect(lookup('SMP-209')).toMatchObject({ kind: 'Trap', subType: 'Counter' });
    expect(lookup('SMP-210')).toMatchObject({ kind: 'Trap', subType: 'Counter' });
  });

  it('none of them is outlined as activatable, and there is no "Bỏ qua" button', () => {
    const m = present(f.view, f.legalActions, { lookup, layout });
    for (const id of SET_TRAPS) {
      expect(m.cards.find((c) => c.id === id)?.activatable, id).toBe(false);
    }
    expect(m.cards.some((c) => c.activatable)).toBe(false);
    expect(m.buttons.map((b) => b.id)).not.toContain('pass');
    expect(m.chain).toBeNull();
  });

  it.each(SET_TRAPS)('tapping Set Trap %s sends nothing and opens no menu', (id) => {
    const r = click(start(), centre(cardRect(ctx, id)), ctx);
    expect(sends(r)).toEqual([]);
    expect(kindOf(r)).toBe('idle');
    expect(overlayFor(r.state, ctx).menu).toBeNull();
  });

  it('a Counter Trap dragged from the hand to a free Spell/Trap Zone is Set at once: no "Kích hoạt" entry', () => {
    const hand = centre(cardRect(ctx, 'p0-2'));
    const r = drag(start(), hand, centre(layout.self.spellTrapZones[1]!), ctx);
    const set: PlayerAction = {
      type: 'SetSpellTrap',
      payload: { playerIndex: 0, cardInstanceId: 'p0-2', zoneIndex: 1 },
    };
    expect(sends(r)).toEqual([set]);
    expect(toasts(r)).toEqual([]);
    expect(overlayFor(r.state, ctx).menu?.labels ?? []).not.toContain(strings.activateOption);
  });

  it('every action the UI can send from this board is one the server listed (never an ActivateEffect)', () => {
    const points = [
      ...SET_TRAPS.map((id) => centre(cardRect(ctx, id))),
      ...layout.self.spellTrapZones.map(centre),
    ];
    const sent: PlayerAction[] = [];
    for (const p of points) sent.push(...sends(click(start(), p, ctx)));
    const hand = centre(cardRect(ctx, 'p0-2'));
    for (const z of layout.self.spellTrapZones)
      sent.push(...sends(drag(start(), hand, centre(z), ctx)));
    expect(sent.some((a) => a.type === 'ActivateEffect')).toBe(false);
    const listed = new Set(f.legalActions.map((a) => JSON.stringify(a)));
    for (const a of sent) expect(listed.has(JSON.stringify(a)), JSON.stringify(a)).toBe(true);
  });
});

describe('a Summon reaction window with Set Counter Traps (fixture counter-window)', () => {
  const ctx = fixtureCtx('counter-window');
  const f = loadFixture('counter-window');
  const answer: PlayerAction = {
    type: 'ActivateEffect',
    payload: { playerIndex: 0, cardInstanceId: 'p0-30', effectId: 'gate-of-refusal' },
  };

  it('only the card the server lists (SMP-210) is outlined; the banner says the opponent Summoned', () => {
    const m = present(f.view, f.legalActions, { lookup, layout });
    expect(m.cards.filter((c) => c.activatable).map((c) => c.id)).toEqual(['p0-30']);
    expect(m.chain).toEqual({ text: t('chain.reactionSummon'), mine: true });
    expect(m.buttons.map((b) => b.id)).toContain('pass');
  });

  it('tapping it sends exactly the listed ActivateEffect, no dialog (C13)', () => {
    const r = click(start(), centre(cardRect(ctx, 'p0-30')), ctx);
    expect(sends(r)).toEqual([answer]);
    expect(kindOf(r)).toBe('pending-server');
  });

  it.each(['p0-31', 'p0-32'])('tapping the unlisted Set Trap %s sends nothing', (id) => {
    const r = click(start(), centre(cardRect(ctx, id)), ctx);
    expect(sends(r)).toEqual([]);
    expect(kindOf(r)).toBe('idle');
  });
});

describe('the two engine refusals of task 4.4 have their own sentence (vi / en keys exist)', () => {
  it('NOTHING_TO_RESPOND_TO and NOTHING_TO_NEGATE are worded, not shown as raw codes', () => {
    const respond = messageFor({ status: 409, engineCode: 'NOTHING_TO_RESPOND_TO' });
    const negate = messageFor({ status: 409, engineCode: 'NOTHING_TO_NEGATE' });
    expect(respond).toBe(t('error.engine.NOTHING_TO_RESPOND_TO'));
    expect(negate).toBe(t('error.engine.NOTHING_TO_NEGATE'));
    expect(respond).toContain('Phản công');
    expect(respond).not.toContain('NOTHING_TO_RESPOND_TO');
    expect(negate).not.toBe(respond);
  });
});
