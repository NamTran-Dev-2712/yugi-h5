import { describe, expect, it } from 'vitest';
import { answer, apply, attack, battle, lp, types } from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-056 Forgewright Shade (Tier B, ATK 1500): OnDestroyed OPTIONAL, cost: pay 500 LP — target 1 Spell/Trap
 * the opponent controls; destroy it. Here it attacks BIG (ATK 2000) and is destroyed (500 battle damage).
 */

const doomed = (extra: { myLp?: number; backrow?: boolean } = {}) =>
  battle({
    myMonsters: [[0, 'SMP-056']],
    oppMonsters: [[0, 'BIG']],
    ...(extra.backrow === false ? {} : { oppSpellTraps: [[2, 'TRAP_PLAIN']] }),
    ...(extra.myLp === undefined ? {} : { myLp: extra.myLp }),
  });

describe('SMP-056 Forgewright Shade', () => {
  it('destroyed by battle: asks its owner, from the graveyard', () => {
    const { state, events } = apply(doomed(), attack('m0-0', 'o0-0'));
    expect(types(events)).toEqual(['AttackDeclared', 'MonsterDestroyed', 'DamageDealt']);
    expect(lp(state)).toEqual([7500, 8000]);
    expect(state.pendingPrompt).toMatchObject({
      kind: 'TriggerActivation',
      playerIndex: 0,
      payload: { optional: true, candidateInstanceIds: ['os-2'], count: 1 },
    });
  });

  it('accept: 500 LP paid, the Spell/Trap is destroyed', () => {
    const asked = apply(doomed(), attack('m0-0', 'o0-0')).state;
    const { state, events } = apply(asked, answer(asked, ['os-2']));
    expect(types(events)).toEqual([
      'EffectActivated',
      'LifePointsPaid',
      'ChainLinkAdded',
      'SpellTrapDestroyed',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([7000, 8000]);
    expect(state.players[1].board.spellTrapZones[2]).toBeNull();
    expect(events).toMatchSnapshot();
  });

  it('decline: no LP paid, the card stays', () => {
    const asked = apply(doomed(), attack('m0-0', 'o0-0')).state;
    const { state } = apply(asked, answer(asked, [], true));
    expect(lp(state)).toEqual([7500, 8000]);
    expect(state.players[1].board.spellTrapZones[2]).not.toBeNull();
  });

  it('500 LP left after the battle damage: the cost cannot be paid, no prompt', () => {
    const { state } = apply(doomed({ myLp: 1000 }), attack('m0-0', 'o0-0'));
    expect(lp(state)).toEqual([500, 8000]);
    expect(state.pendingPrompt).toBeNull();
  });

  it('no Spell/Trap on the other side: no prompt', () => {
    const { state } = apply(doomed({ backrow: false }), attack('m0-0', 'o0-0'));
    expect(state.pendingPrompt).toBeNull();
    expect(lp(state)).toEqual([7500, 8000]);
  });
});
