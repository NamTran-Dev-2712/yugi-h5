import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../legal-actions.js';
import {
  activate,
  answer,
  apply,
  attack,
  battle,
  endPhase,
  lp,
  main,
  sampleCtx,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-056 Forgewright Shade (Tier B, ATK 1500): OnDestroyed OPTIONAL, cost: pay 500 LP — its owner draws 1
 * card. Here it attacks BIG (ATK 2000) and is destroyed (500 battle damage).
 * The first design ("destroy 1 Spell/Trap the opponent controls") was dropped: see the last test.
 */

const doomed = (myLp?: number) =>
  battle({
    myMonsters: [[0, 'SMP-056']],
    oppMonsters: [[0, 'BIG']],
    ...(myLp === undefined ? {} : { myLp }),
  });

describe('SMP-056 Forgewright Shade', () => {
  it('destroyed by battle: asks its owner, from the graveyard (accept or decline, no target)', () => {
    const { state, events } = apply(doomed(), attack('m0-0', 'o0-0'));
    expect(types(events)).toEqual(['AttackDeclared', 'MonsterDestroyed', 'DamageDealt']);
    expect(lp(state)).toEqual([7500, 8000]);
    expect(state.pendingPrompt).toMatchObject({
      kind: 'TriggerActivation',
      playerIndex: 0,
      payload: { optional: true, candidateInstanceIds: [], count: 0 },
    });
    const legal = getLegalActions(state, 0, sampleCtx);
    expect(legal).toContainEqual(answer(state, []));
    expect(legal).toContainEqual(answer(state, [], true));
  });

  it('accept: 500 LP paid, 1 card drawn', () => {
    const asked = apply(doomed(), attack('m0-0', 'o0-0')).state;
    const { state, events } = apply(asked, answer(asked, []));
    expect(types(events)).toEqual([
      'EffectActivated',
      'LifePointsPaid',
      'ChainLinkAdded',
      'CardDrawn',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(lp(state)).toEqual([7000, 8000]);
    expect(state.players[0].hand).toHaveLength(asked.players[0].hand.length + 1);
    expect(events).toMatchSnapshot();
  });

  it('decline: no LP paid, nothing drawn', () => {
    const asked = apply(doomed(), attack('m0-0', 'o0-0')).state;
    const { state, events } = apply(asked, answer(asked, [], true));
    expect(events).toEqual([]);
    expect(lp(state)).toEqual([7500, 8000]);
    expect(state.players[0].hand).toHaveLength(asked.players[0].hand.length);
  });

  it('500 LP left after the battle damage: the cost cannot be paid, no prompt', () => {
    const { state } = apply(doomed(1000), attack('m0-0', 'o0-0'));
    expect(lp(state)).toEqual([500, 8000]);
    expect(state.pendingPrompt).toBeNull();
  });

  it('survives the battle: no trigger', () => {
    const before = battle({ myMonsters: [[0, 'SMP-056']], oppMonsters: [[0, 'M1']] });
    const { state, events } = apply(before, attack('m0-0', 'o0-0'));
    expect(types(events)).not.toContain('EffectActivated');
    expect(state.pendingPrompt).toBeNull();
  });

  it("destroyed while the opponent's Equip Spell SMP-122 is on it: the prompt can still be answered (no dead end)", () => {
    // The Equip follows the monster to the graveyard at the end of the same action. A trigger that TARGETED a Spell/Trap
    // would have listed that Equip as its only candidate and nobody could have answered (docs/ai/OPEN-ISSUES.md P7).
    const eq = apply(
      main({ hand: ['SMP-122'], myMonsters: [[0, 'BIG']], oppMonsters: [[0, 'SMP-056']] }),
      activate('h0', 'equip'),
    ).state;
    const { state } = apply(apply(eq, endPhase()).state, attack('m0-0', 'o0-0'));
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-122']);
    expect(state.pendingPrompt).toMatchObject({ kind: 'TriggerActivation', playerIndex: 1 });
    const legal = getLegalActions(state, 1, sampleCtx);
    expect(legal.filter((a) => a.type === 'ResolvePendingPrompt')).toHaveLength(2);
    const done = apply(state, answer(state, []));
    expect(types(done.events)).toContain('CardDrawn');
    expect(lp(done.state)).toEqual([8000, 6400]); // 1100 battle damage (1500 − 600 against 2000), then 500 paid
  });
});
