import { describe, expect, it } from 'vitest';
import type { Action } from '../../actions/types.js';
import { effectiveStats } from '../../effects/continuous.js';
import type { GameState } from '../../state/types.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  attack,
  lp,
  main,
  sampleCtx,
  setSpellTrap,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.3 — SMP-208 (Tier B), Continuous Trap: all face-up monsters your opponent controls lose 300 ATK. Set it, activate
 * it from a later turn (any phase); it stays face-up in its Spell/Trap Zone.
 */

const toBattle: Action = { type: 'EndPhase', payload: { playerIndex: 0 } };
const atk = (state: GameState, player: 0 | 1, zone = 0) =>
  effectiveStats(state, state.players[player].board.monsterZones[zone]!, sampleCtx).atk;

describe('SMP-208', () => {
  it('a Trap: not from the hand, not on the turn it was Set', () => {
    const start = main({ hand: ['SMP-208'] });
    expectEngineError(() => apply(start, activate('h0', 'activate')), 'TRAP_NOT_SET');
    const set = apply(start, setSpellTrap('h0', 0)).state;
    expectEngineError(() => apply(set, activate('h0', 'activate')), 'TRAP_SET_THIS_TURN');
  });

  it("Set on an earlier turn: flips, stays face-up, the opponent's monsters lose 300 ATK (mine do not)", () => {
    const before = main({
      mySpellTraps: [[1, 'SMP-208', 1]],
      myMonsters: [[0, 'M1']],
      oppMonsters: [[0, 'M1']],
    });
    const { state, events } = apply(before, activate('ms-1', 'activate'));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[0].board.spellTrapZones[1]).toMatchObject({
      instanceId: 'ms-1',
      position: 'Attack',
    });
    expect(state.players[0].graveyard).toEqual([]);
    expect([atk(state, 0), atk(state, 1)]).toEqual([1000, 700]);
  });

  it('the penalty counts in battle', () => {
    const on = apply(
      main({
        mySpellTraps: [[0, 'SMP-208', 1]],
        myMonsters: [[0, 'M1']],
        oppMonsters: [[0, 'M1']],
      }),
      activate('ms-0', 'activate'),
    ).state;
    const { state } = apply(apply(on, toBattle).state, attack('m0-0', 'o0-0'));
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(state.players[0].board.monsterZones[0]).not.toBeNull();
    expect(lp(state)).toEqual([8000, 7700]);
  });

  it('face-up it cannot be activated again; its Continuous effect is never activated', () => {
    const before = main({ mySpellTraps: [[0, 'SMP-208', 1]] });
    expectEngineError(
      () => apply(before, activate('ms-0', 'mist-drain')),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
    const on = apply(before, activate('ms-0', 'activate')).state;
    expectEngineError(() => apply(on, activate('ms-0', 'activate')), 'NOT_ACTIVATABLE');
  });
});
