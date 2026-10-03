import { describe, expect, it } from 'vitest';
import type { Action } from '../actions/types.js';
import { effectiveStats } from '../effects/continuous.js';
import { getLegalActions } from '../legal-actions.js';
import type { GameState } from '../state/types.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureState } from '../testing/effect-fixtures.js';
import {
  activate,
  answer,
  apply,
  battle,
  main,
  pass,
  sampleCtx,
  setSpellTrap,
  types,
} from '../testing/sample-card-kit.js';

/*
 * Task 4.4c (ADR 067) [RULE]: a Set Equip Spell is activated like any other Set Spell Speed 1 card (task 4.3) — its
 * controller's turn, Main Phase, even on the turn it was Set — and needs a face-up monster to equip, as from the hand
 * (task 4.2c). It flips face-up in the zone it was Set in (it does not move), then equips when its link resolves.
 * Real cards: SMP-112 (Equip, your own monster, +500 ATK), SMP-209 (Counter Trap: negate a Spell/Trap activation).
 * Fixture cards: EQ_WEAK (equips to an opponent's monster), TRAP_KILL_MON, M1.
 */

const EQUIP = 'equip';
const equipInZone = (state: GameState, zone: number) => state.players[0].board.spellTrapZones[zone];

describe('a Set Equip Spell', () => {
  it('Set, then activated on the same turn: it flips face-up in ITS zone and equips (+500 ATK)', () => {
    const before = main({ hand: ['SMP-112'], myMonsters: [[1, 'M1']] });
    const set = apply(before, setSpellTrap('h0', 3)).state;
    expect(equipInZone(set, 3)).toMatchObject({ instanceId: 'h0', position: 'DefenseDown' });
    expect(getLegalActions(set, 0, sampleCtx)).toContainEqual(activate('h0', EQUIP));

    const { state, events } = apply(set, activate('h0', EQUIP));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'CardEquipped',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(equipInZone(state, 3)).toMatchObject({
      instanceId: 'h0',
      position: 'Attack',
      equippedTo: 'm0-1',
    });
    // It did not move to the lowest empty zone (that is only for an Equip activated from the hand).
    expect(state.players[0].board.spellTrapZones.filter((c) => c !== null)).toHaveLength(1);
    expect(state.players[0].graveyard).toEqual([]);
    const monster = state.players[0].board.monsterZones[1]!;
    expect(effectiveStats(state, monster, sampleCtx)).toMatchObject({ atk: 1500, def: 1000 });
    expect(state.version).toBe(set.version + 1);
  });

  it('Set on an earlier turn: activated in Main2 as well; several candidates ask for the target', () => {
    const before = main(
      {
        mySpellTraps: [[2, 'SMP-112', 1]],
        myMonsters: [
          [0, 'M1'],
          [4, 'BIG'],
        ],
      },
      'Main2',
    );
    const asked = apply(before, activate('ms-2', EQUIP)).state;
    expect(asked.pendingPrompt).toMatchObject({ playerIndex: 0, kind: 'SelectEffectTarget' });
    expect(asked.pendingPrompt?.payload).toMatchObject({ candidateInstanceIds: ['m0-0', 'm0-4'] });
    // Still face-down while the target is being chosen.
    expect(equipInZone(asked, 2)?.position).toBe('DefenseDown');

    const { state } = apply(asked, answer(asked, ['m0-4']));
    expect(equipInZone(state, 2)).toMatchObject({ position: 'Attack', equippedTo: 'm0-4' });
    expect(effectiveStats(state, state.players[0].board.monsterZones[4]!, sampleCtx).atk).toBe(
      2500,
    );
  });

  it('may equip to an opponent’s monster when the card says so (the card stays on its owner’s side)', () => {
    const before = main({ mySpellTraps: [[0, 'EQ_WEAK']], oppMonsters: [[2, 'M1']] });
    const { state } = apply(before, activate('ms-0', 'e1'));
    expect(equipInZone(state, 0)).toMatchObject({ position: 'Attack', equippedTo: 'o0-2' });
    expect(effectiveStats(state, state.players[1].board.monsterZones[2]!, sampleCtx).atk).toBe(500);
  });

  it('no face-up monster to equip: NO_VALID_TARGET, and it is not listed as legal', () => {
    const before = main({
      mySpellTraps: [[0, 'SMP-112']],
      myMonsters: [[0, 'M1', 'DefenseDown']],
      oppMonsters: [[0, 'M1']],
    });
    expectEngineError(() => apply(before, activate('ms-0', EQUIP)), 'NO_VALID_TARGET');
    expect(
      getLegalActions(before, 0, sampleCtx).filter((a) => a.type === 'ActivateEffect'),
    ).toEqual([]);
  });

  it('on the opponent’s turn: NOT_TURN_PLAYER — even while its controller holds priority in a window', () => {
    const theirs: GameState = {
      ...fixtureState({ mySpellTraps: [[0, 'SMP-112']], myMonsters: [[0, 'M1']] }),
      turnCount: 4,
      turnPlayerIndex: 1,
    };
    expectEngineError(() => apply(theirs, activate('ms-0', EQUIP)), 'NOT_TURN_PLAYER');
    const inWindow: GameState = {
      ...theirs,
      chainWindow: { priorityPlayer: 0, passCount: 0, reactionTo: { kind: 'Summon' } },
    };
    expectEngineError(() => apply(inWindow, activate('ms-0', EQUIP)), 'NOT_TURN_PLAYER');
  });

  it('outside a Main Phase: WRONG_PHASE', () => {
    const before = battle({ mySpellTraps: [[0, 'SMP-112']], myMonsters: [[0, 'M1']] });
    expectEngineError(() => apply(before, activate('ms-0', EQUIP)), 'WRONG_PHASE');
  });

  it('already face-up (equipped): it cannot be activated again', () => {
    const before = main({ mySpellTraps: [[0, 'SMP-112']], myMonsters: [[0, 'M1']] });
    const { state } = apply(before, activate('ms-0', EQUIP));
    expectEngineError(() => apply(state, activate('ms-0', EQUIP)), 'NOT_ACTIVATABLE');
  });

  it('negated by a Counter Trap: sent to the graveyard, no boost (G23)', () => {
    const before = main({
      mySpellTraps: [[1, 'SMP-112']],
      myMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'SMP-209']],
    });
    const link = apply(before, activate('ms-1', EQUIP)).state;
    expect(link.chainWindow?.priorityPlayer).toBe(1);
    expect(equipInZone(link, 1)?.position).toBe('Attack');

    const { state, events } = apply(link, activate('os-0', 'sealing-rune', 1));
    expect(types(events)).toContain('ChainLinkNegated');
    expect(types(events)).not.toContain('CardEquipped');
    expect(equipInZone(state, 1)).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['ms-1']);
    expect(effectiveStats(state, state.players[0].board.monsterZones[0]!, sampleCtx).atk).toBe(
      1000,
    );
  });

  it('its target is gone when it resolves: the link fizzles and the card goes to the graveyard', () => {
    const before = main({
      mySpellTraps: [[4, 'SMP-112']],
      myMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'TRAP_KILL_MON']],
    });
    const link = apply(before, activate('ms-4', EQUIP)).state;
    const { state, events } = apply(link, {
      type: 'ActivateEffect',
      payload: { playerIndex: 1, cardInstanceId: 'os-0', effectId: 'e1' },
    } as Action);
    expect(types(events)).toContain('ChainLinkFizzled');
    expect(equipInZone(state, 4)).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId).sort()).toEqual(['m0-0', 'ms-4']);
  });

  it('the opponent just passes: it equips', () => {
    const before = main({
      mySpellTraps: [[1, 'SMP-112']],
      myMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'SMP-209']],
    });
    const link = apply(before, activate('ms-1', EQUIP)).state;
    const { state } = apply(link, pass(1));
    expect(equipInZone(state, 1)).toMatchObject({ position: 'Attack', equippedTo: 'm0-0' });
  });
});
