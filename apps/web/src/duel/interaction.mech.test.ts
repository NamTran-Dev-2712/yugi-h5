import type { PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { canConfirm, overlayFor, type InteractionState } from './interaction';
import { optionRects, pointInRect } from './layout';
import {
  cardRect,
  centre,
  click,
  drag,
  feed,
  fixtureCtx,
  layout,
  sends,
  start,
  type Run,
} from './interaction.harness';
import { strings } from './strings';
import { t } from '../i18n/i18n';

/**
 * Task 4.2d — Flip Summon from the monster menu, a graveyard picker for effect targets that are not on the board, and
 * one menu entry per effect when a hand Spell has several. Everything sent is an element of `legalActions`.
 */

const kindOf = (r: Run): InteractionState['kind'] => r.state.kind;
const menuLabels = (r: Run): readonly string[] =>
  r.state.kind === 'choosing-option' ? r.state.options.map((o) => o.label) : [];
/** Clicks entry `i` of the open option menu. */
const pickOption = (r: Run, i: number, ctx: ReturnType<typeof fixtureCtx>): Run => {
  if (r.state.kind !== 'choosing-option') throw new Error('no menu open');
  const rect = optionRects(r.state.anchor, r.state.options.length)[i]!;
  return click(r, centre(rect), ctx);
};

describe('Flip Summon (task 4.2d)', () => {
  const ctx = fixtureCtx('flip');
  const flip: PlayerAction = {
    type: 'FlipSummon',
    payload: { playerIndex: 0, cardInstanceId: 'p0-11' },
  };

  it('tapping my face-down monster opens a menu with "Lật ngửa"', () => {
    const r = click(start(), centre(cardRect(ctx, 'p0-11')), ctx);
    expect(kindOf(r)).toBe('choosing-option');
    expect(menuLabels(r)).toEqual([strings.flipSummonOption]);
    expect(sends(r)).toEqual([]);
  });

  it('choosing it sends the listed FlipSummon', () => {
    const opened = click(start(), centre(cardRect(ctx, 'p0-11')), ctx);
    const r = pickOption(opened, 0, ctx);
    expect(sends(r)).toEqual([flip]);
    expect(kindOf(r)).toBe('pending-server');
  });

  it('the face-up monster next to it keeps its position menu only', () => {
    const r = click(start(), centre(cardRect(ctx, 'p0-10')), ctx);
    expect(menuLabels(r)).toEqual([strings.toDefenseOption]);
  });

  it('nothing while busy, and no Flip entry when the server does not list it', () => {
    expect(kindOf(click(start(), centre(cardRect(ctx, 'p0-11')), fixtureCtx('flip', true)))).toBe(
      'idle',
    );
    const noFlip = {
      ...ctx,
      legalActions: ctx.legalActions.filter((a) => a.type !== 'FlipSummon'),
    };
    expect(kindOf(click(start(), centre(cardRect(ctx, 'p0-11')), noFlip))).toBe('idle');
  });
});

describe('graveyard picker for effect targets (task 4.2d)', () => {
  const ctx = fixtureCtx('gy-target');
  const settled = () => feed(start(), { type: 'viewChanged' }, ctx);

  it('the prompt opens a target selection whose graveyard candidates get picker slots', () => {
    const r = settled();
    expect(r.state).toMatchObject({ kind: 'selecting-tribute', purpose: 'target' });
    const overlay = overlayFor(r.state, ctx);
    expect(overlay.picker.map((p) => p.id)).toEqual(['p0-40', 'p0-42']);
    for (const p of overlay.picker) {
      expect(p.rect.w).toBeGreaterThan(0);
      expect(pointInRect(layout.overlay.confirm, centre(p.rect))).toBe(false);
    }
  });

  it('clicking a picker slot selects it; confirm sends the listed answer', () => {
    const r0 = settled();
    const slot = overlayFor(r0.state, ctx).picker.find((p) => p.id === 'p0-42')!;
    const r1 = click(r0, centre(slot.rect), ctx);
    expect(r1.state).toMatchObject({ selected: ['p0-42'] });
    expect(canConfirm(r1.state)).toBe(true);
    const r2 = click(r1, centre(layout.overlay.confirm), ctx);
    expect(sends(r2)).toEqual([
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'effect-5-7', cardInstanceIds: ['p0-42'] },
      },
    ]);
  });

  it('candidates already on the board get no picker slot (they are clicked where they are)', () => {
    const r = feed(start(), { type: 'viewChanged' }, fixtureCtx('effect-target'));
    expect(overlayFor(r.state, fixtureCtx('effect-target')).picker).toEqual([]);
  });

  it('no picker outside a selection', () => {
    expect(overlayFor(start().state, ctx).picker).toEqual([]);
  });
});

describe('a hand Spell with two effects (task 4.2d)', () => {
  const ctx = fixtureCtx('special-summon');
  const spell = centre(cardRect(ctx, 'p0-1'));
  const stZone = centre(layout.self.spellTrapZones[2]!);

  it('dropping it on my Spell/Trap Zone offers one entry per effect, then Set', () => {
    const r = drag(start(), spell, stZone, ctx);
    expect(menuLabels(r)).toEqual([
      t('duel.activateEffectN', { n: 1 }),
      t('duel.activateEffectN', { n: 2 }),
      strings.setSpellOption,
    ]);
  });

  it('each entry sends its own effect', () => {
    const opened = drag(start(), spell, stZone, ctx);
    expect(sends(pickOption(opened, 1, ctx))).toEqual([
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-1', effectId: 'call-from-grave' },
      },
    ]);
  });
});
