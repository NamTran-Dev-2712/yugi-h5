import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { activate, answer, apply, main, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.2d — SMP-111 (Tier B), Normal Spell with two effects (activate one): `call-from-hand` Special Summons 1 monster
 * from your hand, `call-from-grave` 1 monster from your graveyard. Lowest empty zone, Attack Position (G17). Does not use
 * the Normal Summon of the turn.
 */

describe('SMP-111', () => {
  it('from the hand: asks which monster (Spells in hand are not candidates), then Special Summons it', () => {
    const s = main({ hand: ['SMP-111', 'M1', 'BIG', 'SMP-103'] });
    const asked = apply(s, activate('h0', 'call-from-hand')).state;
    expect(asked.pendingPrompt).toMatchObject({
      kind: 'SelectEffectTarget',
      payload: { candidateInstanceIds: ['h1', 'h2'] },
    });
    const { state, events } = apply(asked, answer(asked, ['h2']));
    expect(types(events)).toContain('MonsterSpecialSummoned');
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'MonsterSpecialSummoned',
        instanceId: 'h2',
        from: 'Hand',
        zoneIndex: 0,
      }),
    );
    expect(state.players[0].board.monsterZones[0]).toMatchObject({
      instanceId: 'h2',
      position: 'Attack',
    });
    expect(state.players[0].hasNormalSummonedThisTurn).toBe(false);
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-111']);
  });

  it('from the graveyard: one monster = chosen at once', () => {
    const s = main({ hand: ['SMP-111'], myGraveyard: ['BIG'], myMonsters: [[0, 'M1']] });
    const { state, events } = apply(s, activate('h0', 'call-from-grave'));
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'MonsterSpecialSummoned',
        instanceId: 'g0',
        from: 'Graveyard',
        zoneIndex: 1,
      }),
    );
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-111']);
  });

  it('no monster where the effect looks: NO_VALID_TARGET', () => {
    const s = main({ hand: ['SMP-111', 'SMP-103'], myGraveyard: ['SMP-103'] });
    expectEngineError(() => apply(s, activate('h0', 'call-from-hand')), 'NO_VALID_TARGET');
    expectEngineError(() => apply(s, activate('h0', 'call-from-grave')), 'NO_VALID_TARGET');
  });

  it('no empty Monster Zone: NO_FREE_MONSTER_ZONE', () => {
    const s = main({
      hand: ['SMP-111'],
      myGraveyard: ['BIG'],
      myMonsters: [0, 1, 2, 3, 4].map((z) => [z, 'M1'] as [number, string]),
    });
    expectEngineError(() => apply(s, activate('h0', 'call-from-grave')), 'NO_FREE_MONSTER_ZONE');
  });
});
