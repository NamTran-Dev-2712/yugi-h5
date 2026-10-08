import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import {
  answer,
  apply,
  attack,
  battle,
  flipSummon,
  main,
  sampleCtx,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-052 Tunnel Mole (Tier B): OnFlip OPTIONAL — target 1 Spell/Trap the opponent controls; destroy it.
 * `TRAP_PLAIN` has no effect, so nothing can respond.
 */

const setUp = () =>
  main({
    myMonsters: [[0, 'SMP-052', 'DefenseDown']],
    oppSpellTraps: [
      [1, 'TRAP_PLAIN'],
      [3, 'TRAP_PLAIN'],
    ],
  });

describe('SMP-052 Tunnel Mole', () => {
  it('Flip Summon asks its owner: one answer per opponent Spell/Trap + decline', () => {
    const { state, events } = apply(setUp(), flipSummon('m0-0'));
    expect(types(events)).toEqual(['FlipSummoned']);
    expect(state.pendingPrompt).toMatchObject({
      kind: 'TriggerActivation',
      playerIndex: 0,
      payload: { optional: true, candidateInstanceIds: ['os-1', 'os-3'] },
    });
    const legal = getLegalActions(state, 0, sampleCtx);
    expect(legal).toContainEqual(answer(state, ['os-1']));
    expect(legal).toContainEqual(answer(state, [], true));
  });

  it('accept + target: the chosen face-down Spell/Trap is destroyed', () => {
    const asked = apply(setUp(), flipSummon('m0-0')).state;
    const { state, events } = apply(asked, answer(asked, ['os-3']));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'SpellTrapDestroyed',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[1].board.spellTrapZones[3]).toBeNull();
    expect(state.players[1].board.spellTrapZones[1]).not.toBeNull();
    expect(events).toMatchSnapshot();
  });

  it('decline: nothing is destroyed', () => {
    const asked = apply(setUp(), flipSummon('m0-0')).state;
    const { state, events } = apply(asked, answer(asked, [], true));
    expect(events).toEqual([]);
    expect(state.players[1].board.spellTrapZones.filter((c) => c !== null)).toHaveLength(2);
  });

  it('a face-up Field Spell is a Spell/Trap on the field: it can be destroyed too', () => {
    const before = main({
      myMonsters: [[0, 'SMP-052', 'DefenseDown']],
      oppField: ['SMP-113', 'Attack'],
    });
    const asked = apply(before, flipSummon('m0-0')).state;
    const { state, events } = apply(asked, answer(asked, ['of']));
    expect(types(events)).toContain('FieldSpellDestroyed');
    expect(state.players[1].board.fieldZone).toBeNull();
  });

  it("flipped by an attack: the prompt goes to the Mole's controller (the opponent here)", () => {
    const before = battle({
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[0, 'SMP-052', 'DefenseDown']],
      mySpellTraps: [[2, 'TRAP_PLAIN']],
    });
    const { state } = apply(before, attack('m0-0', 'o0-0'));
    expect(state.pendingPrompt).toMatchObject({
      kind: 'TriggerActivation',
      playerIndex: 1,
      payload: { candidateInstanceIds: ['ms-2'] },
    });
    const done = apply(state, answer(state, ['ms-2'])).state;
    expect(done.players[0].board.spellTrapZones[2]).toBeNull();
  });

  it('no Spell/Trap on the other side: the flip asks nothing', () => {
    const before = main({ myMonsters: [[0, 'SMP-052', 'DefenseDown']] });
    expect(apply(before, flipSummon('m0-0')).state.pendingPrompt).toBeNull();
  });
});
