import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import type { Action, ActivateEffectAction } from '../../actions/types.js';
import type { GameState } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../../testing/effect-fixtures.js';
import { effectiveStats } from '../continuous.js';

/*
 * Task 4.4 — operation `NegateActivation` (ADR 065). It negates the activation of the chain link DIRECTLY BELOW its own
 * (the one it answered): that link's operations never run, and its Spell/Trap card goes to its owner's graveyard at
 * once — also a Continuous / Field / Equip card that was placed face-up when it was activated (its Continuous effect is
 * gone with the next read). [ASSUMED] G23: costs already paid are not refunded; the negated card is "sent", not
 * "destroyed" (no OnDestroyed); a negated monster trigger leaves the monster where it is.
 * Activation needs something to negate: an opponent's link on top of the chain whose card kind matches `cardKinds`
 * (`NOTHING_TO_NEGATE` otherwise).
 */

const act = (cardInstanceId: string, playerIndex: 0 | 1 = 0): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId: 'e1' },
});
const pass = (playerIndex: 0 | 1): Action => ({ type: 'PassPriority', payload: { playerIndex } });
const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const types = (events: readonly { type: string }[]) => events.map((e) => e.type);
const lp = (state: GameState) => state.players.map((p) => p.lifePoints);
const graveIds = (state: GameState, player: 0 | 1 = 0) =>
  state.players[player].graveyard.map((c) => c.instanceId);
const backrow = (state: GameState, player: 0 | 1 = 0) => state.players[player].board.spellTrapZones;
const atk = (state: GameState, player: 0 | 1, zone = 0) =>
  effectiveStats(state, state.players[player].board.monsterZones[zone]!, fixtureCtx).atk;
/** Player 0 activates `h0` (or `first`), player 1 answers with its Set card `os-0`. */
const negated = (setup: FixtureSetup, first = act('h0')) => {
  const before = fixtureState({ oppSpellTraps: [[0, 'NEG_ACT']], ...setup });
  const waiting = apply(before, first).state;
  return { before, waiting, ...apply(waiting, act('os-0', 1)) };
};

describe('NegateActivation — the answered link', () => {
  it('a Normal Spell from the hand: no effect, the card goes from the link to the graveyard once', () => {
    const { before, state, events } = negated({ hand: ['HEAL'] });
    expect(types(events)).toEqual([
      'EffectActivated',
      'LifePointsPaid',
      'ChainLinkAdded',
      'ChainLinkNegated',
      'CardSentToGraveyard',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events.filter((e) => e.type === 'CardSentToGraveyard')).toEqual([
      {
        type: 'CardSentToGraveyard',
        ownerIndex: 0,
        instanceId: 'h0',
        definitionId: 'HEAL',
        from: 'Hand',
      },
      {
        type: 'CardSentToGraveyard',
        ownerIndex: 1,
        instanceId: 'os-0',
        definitionId: 'NEG_ACT',
        from: 'SpellTrapZone',
      },
    ]);
    expect(events.filter((e) => e.type === 'EffectResolved').map((e) => e.instanceId)).toEqual([
      'os-0',
    ]);
    expect(lp(state)).toEqual([before.players[0].lifePoints, before.players[1].lifePoints - 1000]);
    expect(graveIds(state, 0)).toEqual(['h0']);
    expect(state.players[0].graveyard[0]).toEqual({
      instanceId: 'h0',
      definitionId: 'HEAL',
      ownerIndex: 0,
      position: null,
    });
    expect(state.chainStack).toEqual([]);
    expect(state.chainWindow).toBeNull();
  });

  it('the cost the negated activation paid is NOT refunded [ASSUMED]', () => {
    const { before, state, events } = negated({ hand: ['PAY_BURN'] });
    expect(types(events)).not.toContain('DamageDealt');
    expect(types(events)).not.toContain('LifePointsRecovered');
    // PAY_BURN paid 500 and dealt nothing; the Counter Trap paid 1000.
    expect(lp(state)).toEqual([before.players[0].lifePoints - 500, 8000 - 1000]);
  });

  it('a discarded cost card stays in the graveyard', () => {
    const before = fixtureState({
      hand: ['DISCARD_DRAW', 'M1'],
      oppSpellTraps: [[0, 'NEG_ACT']],
    });
    const waiting = apply(before, {
      type: 'ActivateEffect',
      payload: { playerIndex: 0, cardInstanceId: 'h0', effectId: 'e1', costInstanceIds: ['h1'] },
    }).state;
    const { state, events } = apply(waiting, act('os-0', 1));
    expect(types(events)).not.toContain('CardDrawn');
    expect(state.players[0].hand).toEqual([]);
    expect(graveIds(state, 0).sort()).toEqual(['h0', 'h1']);
  });

  it('a Set Trap that was activated: it leaves its zone for the graveyard without resolving', () => {
    const before = fixtureState({
      hand: ['HEAL'],
      mySpellTraps: [[2, 'NEG_ANY']],
      oppSpellTraps: [[3, 'TRAP_BURN']],
    });
    const link2 = apply(apply(before, act('h0')).state, act('os-3', 1)).state;
    const { state, events } = apply(link2, act('ms-2'));
    expect(types(events)).not.toContain('DamageDealt');
    expect(backrow(state, 1)[3]).toBeNull();
    expect(graveIds(state, 1)).toEqual(['os-3']);
    expect(lp(state)).toEqual([8700, 8000]);
  });
});

describe('NegateActivation — cards that would have stayed on the field', () => {
  it('a Continuous Spell from the hand: sent to the graveyard, its bonus is gone', () => {
    const { waiting, state, events } = negated({ hand: ['CS_BUFF'], myMonsters: [[0, 'M1']] });
    // While its link waits the card is face-up and its Continuous effect already holds (ADR 064).
    expect(backrow(waiting)[0]).toMatchObject({ instanceId: 'h0', position: 'Attack' });
    expect(atk(waiting, 0)).toBe(1300);

    expect(events).toContainEqual({
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'h0',
      definitionId: 'CS_BUFF',
      from: 'SpellTrapZone',
    });
    expect(events.filter((e) => e.type === 'EffectResolved').map((e) => e.instanceId)).toEqual([
      'os-0',
    ]);
    expect(backrow(state).every((c) => c === null)).toBe(true);
    expect(graveIds(state)).toEqual(['h0']);
    expect(atk(state, 0)).toBe(1000);
  });

  it('a Set Continuous Spell activated in place: same', () => {
    const { state } = negated(
      { mySpellTraps: [[4, 'CS_BUFF']], myMonsters: [[0, 'M1']] },
      act('ms-4'),
    );
    expect(backrow(state)[4]).toBeNull();
    expect(graveIds(state)).toEqual(['ms-4']);
    expect(atk(state, 0)).toBe(1000);
  });

  it('what a Continuous Spell does when it resolves does not happen either', () => {
    const { before, state, events } = negated({ hand: ['CS_HEAL_BUFF'] });
    expect(types(events)).not.toContain('LifePointsRecovered');
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints);
  });

  it('a Continuous Trap chained by the opponent: negated by my Counter Trap, no penalty remains', () => {
    const before = fixtureState({
      hand: ['HEAL'],
      myMonsters: [[0, 'M1']],
      mySpellTraps: [[0, 'NEG_ACT']],
      oppSpellTraps: [[1, 'CT_BURN_WEAK']],
    });
    const link2 = apply(apply(before, act('h0')).state, act('os-1', 1)).state;
    expect(atk(link2, 0)).toBe(700);
    const { state, events } = apply(link2, act('ms-0'));
    expect(types(events)).not.toContain('DamageDealt');
    expect(backrow(state, 1)[1]).toBeNull();
    expect(graveIds(state, 1)).toEqual(['os-1']);
    expect(atk(state, 0)).toBe(1000);
    expect(lp(state)).toEqual([8000 - 1000 + 700, 8000]);
  });

  it('a Field Spell from the hand: the new one goes to the graveyard; the one it replaced does not come back', () => {
    const { state, events } = negated({
      hand: ['FLD_WARRIOR'],
      myField: ['FLD_WEAK', 'Attack'],
      myMonsters: [[0, 'M1']],
      oppMonsters: [[0, 'M1']],
    });
    expect(events.filter((e) => e.type === 'CardSentToGraveyard' && e.instanceId === 'h0')).toEqual(
      [
        {
          type: 'CardSentToGraveyard',
          ownerIndex: 0,
          instanceId: 'h0',
          definitionId: 'FLD_WARRIOR',
          from: 'FieldZone',
        },
      ],
    );
    expect(state.players[0].board.fieldZone).toBeNull();
    expect(graveIds(state)).toEqual(['mf', 'h0']);
    expect([atk(state, 0), atk(state, 1)]).toEqual([1000, 1000]);
  });

  it('a Set Field Spell activated in its zone: sent to the graveyard', () => {
    const { state } = negated({ myField: ['FLD_WEAK'], oppMonsters: [[0, 'M1']] }, act('mf'));
    expect(state.players[0].board.fieldZone).toBeNull();
    expect(graveIds(state)).toEqual(['mf']);
    expect(atk(state, 1)).toBe(1000);
  });

  it('an Equip Spell: never equipped, sent to the graveyard', () => {
    const { state, events } = negated({ hand: ['EQ_POWER'], myMonsters: [[0, 'M1']] });
    expect(types(events)).not.toContain('CardEquipped');
    expect(types(events)).not.toContain('ChainLinkFizzled');
    expect(backrow(state).every((c) => c === null)).toBe(true);
    expect(graveIds(state)).toEqual(['h0']);
    expect(atk(state, 0)).toBe(1000);
  });
});

describe('NegateActivation — what may be negated', () => {
  it('NOTHING_TO_NEGATE: my own link is on top (the opponent passed)', () => {
    const before = fixtureState({
      hand: ['HEAL'],
      // TRAP (Speed 2) keeps the window open for me once the opponent passed.
      mySpellTraps: [
        [0, 'NEG_ACT'],
        [1, 'TRAP'],
      ],
      oppSpellTraps: [[0, 'TRAP']],
    });
    const mine = apply(apply(before, act('h0')).state, pass(1)).state;
    expect(mine.chainWindow).toEqual({ priorityPlayer: 0, passCount: 1 });
    expectEngineError(() => apply(mine, act('ms-0')), 'NOTHING_TO_NEGATE');
  });

  it('NOTHING_TO_NEGATE: nothing on the chain (an attack reaction window)', () => {
    const before: GameState = {
      ...fixtureState({
        phase: 'Battle',
        myMonsters: [[0, 'BIG']],
        oppSpellTraps: [
          [0, 'NEG_ACT'],
          [1, 'TRAP_BURN'],
        ],
      }),
      turnCount: 3,
    };
    const opened = apply(before, {
      type: 'DeclareAttack',
      payload: { playerIndex: 0, attackerInstanceId: 'm0-0' },
    }).state;
    expect(opened.chainWindow?.priorityPlayer).toBe(1);
    expectEngineError(() => apply(opened, act('os-0', 1)), 'NOTHING_TO_NEGATE');
  });

  it('cardKinds Spell/Trap does not answer a monster trigger: the window does not even stay open', () => {
    const before = fixtureState({
      hand: ['KILL'],
      mySpellTraps: [[0, 'NEG_ACT']],
      oppMonsters: [[0, 'DES_BURN']],
    });
    const { state, events } = apply(before, act('h0'));
    // KILL destroys DES_BURN; its mandatory OnDestroyed trigger (400 to player 0) resolves unanswered.
    expect(state.chainWindow).toBeNull();
    expect(events.filter((e) => e.type === 'DamageDealt')).toEqual([
      { type: 'DamageDealt', playerIndex: 0, amount: 400 },
    ]);
    expect(backrow(state)[0]?.position).toBe('DefenseDown');
  });

  it('without cardKinds it negates a monster trigger too; the monster stays where it is', () => {
    const before = fixtureState({
      hand: ['KILL'],
      mySpellTraps: [[0, 'NEG_ANY']],
      oppMonsters: [[0, 'DES_BURN']],
    });
    const waiting = apply(before, act('h0')).state;
    expect(waiting.chainStack.map((l) => l.source.zone)).toEqual(['Graveyard']);
    expect(waiting.chainWindow).toEqual({ priorityPlayer: 0, passCount: 0 });

    const { state, events } = apply(waiting, act('ms-0'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'ChainLinkNegated',
      'EffectResolved',
      'CardSentToGraveyard', // only the Counter Trap: the monster never moved
      'ChainResolved',
    ]);
    expect(types(events)).not.toContain('DamageDealt');
    expect(graveIds(state, 1)).toEqual(['o0-0']);
    expect(state.players[0].lifePoints).toBe(before.players[0].lifePoints);
  });

  it('an effect Special Summon is stopped by negating its Spell: the monster stays in the hand', () => {
    const { state, events } = negated({ hand: ['SS_HAND', 'M1'] });
    expect(types(events)).not.toContain('MonsterSpecialSummoned');
    expect(state.players[0].hand.map((c) => c.instanceId)).toEqual(['h1']);
    expect(state.players[0].board.monsterZones.every((c) => c === null)).toBe(true);
  });

  it('too few LP for the cost: the Counter Trap is no response, the Spell resolves', () => {
    const before = fixtureState({ hand: ['HEAL'], oppSpellTraps: [[0, 'NEG_ACT']], oppLp: 1000 });
    const { state, events } = apply(before, act('h0'));
    expect(types(events)).toContain('LifePointsRecovered');
    expect(state.chainWindow).toBeNull();
  });
});
