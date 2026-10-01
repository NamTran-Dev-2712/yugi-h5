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
 * Task 4.3 — SMP-113 (Tier B), Field Spell: all face-up WIND monsters on the field gain 300 ATK. Activated from the hand
 * or Set first; it stays face-up in the Field Zone. SMP-044 is a WIND monster (700 ATK); the filler `M1` is EARTH.
 */

const toBattle: Action = { type: 'EndPhase', payload: { playerIndex: 0 } };
const atk = (state: GameState, player: 0 | 1, zone: number) =>
  effectiveStats(state, state.players[player].board.monsterZones[zone]!, sampleCtx).atk;

const board = {
  myMonsters: [
    [0, 'SMP-044'],
    [1, 'M1'],
  ] as [number, string][],
  oppMonsters: [
    [0, 'SMP-044'],
    [1, 'M1'],
  ] as [number, string][],
};

describe('SMP-113', () => {
  it('activated from the hand: stays face-up in the Field Zone, WIND monsters of BOTH sides gain 300 ATK', () => {
    const { state, events } = apply(
      main({ hand: ['SMP-113'], ...board }),
      activate('h0', 'activate'),
    );
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(state.players[0].board.fieldZone).toMatchObject({
      instanceId: 'h0',
      position: 'Attack',
    });
    expect(state.players[0].graveyard).toEqual([]);
    expect([atk(state, 0, 0), atk(state, 1, 0)]).toEqual([1000, 1000]);
    expect([atk(state, 0, 1), atk(state, 1, 1)]).toEqual([1000, 1000]); // EARTH: printed 1000, untouched
  });

  it('Set first (no bonus while face-down), then activated from the Field Zone', () => {
    const set = apply(main({ hand: ['SMP-113'], ...board }), setSpellTrap('h0', 0)).state;
    expect(set.players[0].board.fieldZone).toMatchObject({ position: 'DefenseDown' });
    expect(atk(set, 0, 0)).toBe(700);
    const { state } = apply(set, activate('h0', 'activate'));
    expect(state.players[0].board.fieldZone).toMatchObject({ position: 'Attack' });
    expect(atk(state, 0, 0)).toBe(1000);
  });

  it('the bonus counts in battle: my WIND 700 + 300 ties an EARTH 1000', () => {
    const on = apply(
      main({ hand: ['SMP-113'], myMonsters: [[0, 'SMP-044']], oppMonsters: [[0, 'M1']] }),
      activate('h0', 'activate'),
    ).state;
    const { state } = apply(apply(on, toBattle).state, attack('m0-0', 'o0-0'));
    // 700 + 300 vs 1000: both destroyed, nobody loses LP (without the Field Spell I would lose 300).
    expect(state.players[0].board.monsterZones[0]).toBeNull();
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(lp(state)).toEqual([8000, 8000]);
  });

  it('its Continuous effect is never activated; face-up it cannot be activated again', () => {
    const start = main({ hand: ['SMP-113'] });
    expectEngineError(
      () => apply(start, activate('h0', 'gale-boost')),
      'CONTINUOUS_NOT_ACTIVATABLE',
    );
    const on = apply(start, activate('h0', 'activate')).state;
    expectEngineError(() => apply(on, activate('h0', 'activate')), 'NOT_ACTIVATABLE');
  });

  it('destroyed by SMP-105 ("destroy 1 Spell/Trap"): the bonus is gone', () => {
    const on = apply(
      main({ hand: ['SMP-113', 'SMP-105'], myMonsters: [[0, 'SMP-044']] }),
      activate('h0', 'activate'),
    ).state;
    // Move my face-up Field Spell to the opponent's Field Zone so my own SMP-105 can target it.
    const theirs: GameState = {
      ...on,
      players: [
        { ...on.players[0], board: { ...on.players[0].board, fieldZone: null } },
        {
          ...on.players[1],
          board: {
            ...on.players[1].board,
            fieldZone: { ...on.players[0].board.fieldZone!, ownerIndex: 1 },
          },
        },
      ],
    };
    expect(atk(theirs, 0, 0)).toBe(1000);
    const { state, events } = apply(theirs, activate('h1', 'gale-sweep'));
    expect(types(events)).toContain('FieldSpellDestroyed');
    expect(state.players[1].board.fieldZone).toBeNull();
    expect(atk(state, 0, 0)).toBe(700);
  });
});
