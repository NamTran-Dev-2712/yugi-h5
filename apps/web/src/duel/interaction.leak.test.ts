import { SAMPLE_CARDS } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { createDuelController } from './duel-controller';
import { loadFixture, type FixtureName } from './fixtures';
import { overlayFor } from './interaction';
import {
  cardRect,
  centre,
  dragEvents,
  feed,
  fixtureCtx,
  lookup,
  oppZone,
  selfZone,
  start,
  type Run,
} from './interaction.harness';

/**
 * Viewer 0 sees seat 1's hand and face-down monsters as hidden. Everything the interaction layer produces (render
 * model, overlay, requests, toasts, the fixture "sẽ gửi" log) must be free of any card identity the viewer was not
 * shown. The secret cards here are every sample card that appears NOWHERE in the view the viewer was given.
 */
function secretsOf(name: FixtureName): { ids: string[]; names: string[] } {
  const f = loadFixture(name);
  const shown = new Set(JSON.stringify(f.view).match(/SMP-\d+/g) ?? []);
  const secret = SAMPLE_CARDS.filter((c) => !shown.has(c.id));
  return { ids: secret.map((c) => c.id), names: secret.map((c) => c.name) };
}

const names: FixtureName[] = ['summon-choice', 'tribute', 'attack', 'attack-direct', 'midgame'];

describe('no hidden identity leaks through the interaction layer', () => {
  for (const name of names) {
    it(`${name}: model, overlay, effects contain no unseen card id or name`, () => {
      const ctx = fixtureCtx(name);
      const { ids, names: cardNames } = secretsOf(name);
      expect(ids.length).toBeGreaterThan(5); // the check is not vacuous

      const dumps: string[] = [JSON.stringify(ctx.model)];
      // Drag every own card onto every opposing/own zone and record everything that comes out.
      const froms = ctx.model.cards.filter((c) => c.side === 'self').map((c) => centre(c.rect));
      const tos = [
        ...[0, 1, 2, 3, 4].map((i) => centre(oppZone(i))),
        ...[0, 1, 2, 3, 4].map((i) => centre(selfZone(i))),
        centre(ctx.layout.opp.lp),
      ];
      for (const from of froms) {
        for (const to of tos) {
          let run: Run = start();
          for (const e of dragEvents(from, to)) {
            run = feed(run, e, ctx);
            dumps.push(JSON.stringify(overlayFor(run.state, ctx)), JSON.stringify(run.state));
          }
          dumps.push(JSON.stringify(run.effects));
        }
      }
      const all = dumps.join('\n');
      for (const id of ids) expect(all, id).not.toContain(id);
      for (const n of cardNames) expect(all, n).not.toContain(n);
    });
  }

  it('the fixture "sẽ gửi" log names only instance ids, never an unseen card', async () => {
    const f = loadFixture('attack');
    const c = createDuelController({ lookup });
    c.showFixture(f.view, f.legalActions);
    const attack = f.legalActions.find(
      (a) => a.type === 'DeclareAttack' && a.payload.targetInstanceId === 'p1-11',
    )!;
    await c.submit(attack);
    const { ids, names: cardNames } = secretsOf('attack');
    const log = c.getState().log.join('\n');
    expect(log).toContain('p1-11');
    for (const id of ids) expect(log).not.toContain(id);
    for (const n of cardNames) expect(log).not.toContain(n);
  });

  it('the face-down opponent monster has no label or detail in the model, so nothing can be shown for it', () => {
    const ctx = fixtureCtx('attack');
    const card = ctx.model.cards.find((c) => c.id === 'p1-11')!;
    expect(card.label).toBeNull();
    expect(card.detail).toBeNull();
    expect(cardRect(ctx, 'p1-11')).toEqual(oppZone(2));
  });
});
