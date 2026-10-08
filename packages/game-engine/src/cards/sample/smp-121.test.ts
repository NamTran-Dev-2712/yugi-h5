import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  attack,
  endPhase,
  lp,
  main,
  stats,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-121 (Tier B), Equip Spell: equip to 1 face-up monster you control; it gains 300 ATK and 700 DEF. `M1`
 * is 1000 / 1000, `BIG` 2000 ATK.
 */

const equipped = (opp: [number, string][] = []) =>
  apply(
    main({ hand: ['SMP-121'], myMonsters: [[0, 'M1']], oppMonsters: opp }),
    activate('h0', 'equip'),
  );

describe('SMP-121', () => {
  it('equips to my face-up monster: +300 ATK and +700 DEF, the card stays on the field', () => {
    const { state, events } = equipped();
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'CardEquipped',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[0].board.spellTrapZones[0]).toMatchObject({
      instanceId: 'h0',
      position: 'Attack',
      equippedTo: 'm0-0',
    });
    expect(stats(state, 0, 0)).toEqual({ atk: 1300, def: 1700 });
    expect(events).toMatchSnapshot();
  });

  it('the ATK boost counts in battle: 1300 beats 1000', () => {
    const eq = equipped([[0, 'M1']]).state;
    const { state } = apply(apply(eq, endPhase()).state, attack('m0-0', 'o0-0'));
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(state.players[0].board.monsterZones[0]).not.toBeNull();
    expect(lp(state)).toEqual([8000, 7700]);
  });

  it('the monster is destroyed: the Equip goes to the graveyard with it', () => {
    const eq = equipped([[0, 'BIG']]).state;
    const { state } = apply(apply(eq, endPhase()).state, attack('m0-0', 'o0-0'));
    expect(state.players[0].board.spellTrapZones[0]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.definitionId).sort()).toEqual(['M1', 'SMP-121']);
    expect(lp(state)).toEqual([7300, 8000]);
  });

  it('only my own face-up monsters: an opponent monster or my face-down one is no target', () => {
    const s = main({
      hand: ['SMP-121'],
      myMonsters: [[0, 'M1', 'DefenseDown']],
      oppMonsters: [[0, 'M1']],
    });
    expectEngineError(() => apply(s, activate('h0', 'equip')), 'NO_VALID_TARGET');
  });

  it('its Continuous effect is never activated', () => {
    const s = main({ hand: ['SMP-121'], myMonsters: [[0, 'M1']] });
    expectEngineError(() => apply(s, activate('h0', 'equip-boost')), 'CONTINUOUS_NOT_ACTIVATABLE');
  });
});
