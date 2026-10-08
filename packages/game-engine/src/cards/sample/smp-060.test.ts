import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  answer,
  apply,
  main,
  stats,
  summon,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-060 (Fusion Monster, no effect of its own): SMP-057 Greymane Alpha + SMP-050 Packcaller, Fusion Summoned
 * by SMP-116 from the hand and / or the field. ATK 2400 / DEF 1800.
 */

const fuse = (setup: Parameters<typeof main>[0], materials: string[]) => {
  const activated = apply(main(setup), activate('h0', 'merging-crucible')).state;
  const picked = apply(activated, answer(activated, ['x0'])).state;
  return apply(picked, answer(picked, materials));
};

describe('SMP-060', () => {
  it('fused from one material in the hand and one on the field: both go to the graveyard, it arrives in Attack', () => {
    const { state, events } = fuse(
      { hand: ['SMP-116', 'SMP-057'], myMonsters: [[2, 'SMP-050']], myExtraDeck: ['SMP-060'] },
      ['h1', 'm0-2'],
    );
    expect(types(events).filter((t) => t === 'FusionMaterialSent')).toHaveLength(2);
    expect(types(events)).toContain('MonsterFusionSummoned');
    const zone = state.players[0].board.monsterZones.findIndex((c) => c?.instanceId === 'x0');
    expect(zone).toBe(0);
    expect(state.players[0].board.monsterZones[0]).toMatchObject({
      definitionId: 'SMP-060',
      position: 'Attack',
    });
    expect(stats(state, 0, 0)).toEqual({ atk: 2400, def: 1800 });
    expect(state.players[0].graveyard.map((c) => c.definitionId).sort()).toEqual([
      'SMP-050',
      'SMP-057',
      'SMP-116',
    ]);
    expect(state.players[0].extraDeck).toEqual([]);
    expect(events).toMatchSnapshot();
  });

  it('it is a Beast: a Greymane Alpha left on the field gives it +200 ATK', () => {
    const { state } = fuse(
      {
        hand: ['SMP-116', 'SMP-057', 'SMP-050'],
        myMonsters: [[4, 'SMP-057']],
        myExtraDeck: ['SMP-060'],
      },
      ['h1', 'h2'],
    );
    expect(state.players[0].board.monsterZones[0]?.definitionId).toBe('SMP-060');
    expect(stats(state, 0, 0).atk).toBe(2600);
  });

  it('a material is missing: the fusion Spell cannot be activated', () => {
    const s = main({ hand: ['SMP-116', 'SMP-057', 'SMP-005'], myExtraDeck: ['SMP-060'] });
    expectEngineError(() => apply(s, activate('h0', 'merging-crucible')), 'NOT_ACTIVATABLE');
  });

  it('never Normal Summoned, never brought back by SMP-111', () => {
    expectEngineError(
      () => apply(main({ hand: ['SMP-060'] }), summon('h0')),
      'FUSION_NOT_SUMMONABLE',
    );
    const s = main({ hand: ['SMP-111'], myGraveyard: ['SMP-060'] });
    expectEngineError(() => apply(s, activate('h0', 'call-from-grave')), 'NO_VALID_TARGET');
  });
});
