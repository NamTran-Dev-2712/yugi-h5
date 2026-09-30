import { describe, expect, it } from 'vitest';
import type { Action } from '../../actions/types.js';
import { effectiveStats } from '../../effects/continuous.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  apply,
  attack,
  lp,
  main,
  sampleCtx,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.2d — SMP-112 (Tier B), Equip Spell: equip to 1 face-up monster you control; it gains 500 ATK. The card stays
 * face-up in the lowest empty Spell/Trap Zone (G18) and is sent to the graveyard when the monster leaves the field.
 */

const toBattle: Action = { type: 'EndPhase', payload: { playerIndex: 0 } };

const equipped = (opp: [number, string][] = []) =>
  apply(
    main({ hand: ['SMP-112'], myMonsters: [[0, 'M1']], oppMonsters: opp }),
    activate('h0', 'equip'),
  );

describe('SMP-112', () => {
  it('equips to my face-up monster: +500 ATK, the card stays on the field', () => {
    const { state, events } = equipped();
    expect(types(events)).toContain('CardEquipped');
    expect(state.players[0].board.spellTrapZones[0]).toMatchObject({
      instanceId: 'h0',
      position: 'Attack',
      equippedTo: 'm0-0',
    });
    const monster = state.players[0].board.monsterZones[0]!;
    expect(effectiveStats(state, monster, sampleCtx)).toMatchObject({ atk: 1500, def: 1000 });
  });

  it('the boost counts in battle', () => {
    const eq = equipped([[0, 'M1']]).state;
    const battle = apply(eq, toBattle).state;
    const { state } = apply(battle, attack('m0-0', 'o0-0'));
    expect(state.players[1].board.monsterZones[0]).toBeNull();
    expect(lp(state)).toEqual([8000, 7500]);
  });

  it('the monster is destroyed: the Equip goes to the graveyard with it', () => {
    const eq = equipped([[0, 'BIG']]).state;
    const battle = apply(eq, toBattle).state;
    const { state, events } = apply(battle, attack('m0-0', 'o0-0'));
    expect(types(events)).toContain('CardSentToGraveyard');
    expect(state.players[0].board.spellTrapZones[0]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.definitionId).sort()).toEqual(['M1', 'SMP-112']);
  });

  it('no face-up monster of mine: NO_VALID_TARGET', () => {
    const s = main({
      hand: ['SMP-112'],
      myMonsters: [[0, 'M1', 'DefenseDown']],
      oppMonsters: [[0, 'M1']],
    });
    expectEngineError(() => apply(s, activate('h0', 'equip')), 'NO_VALID_TARGET');
  });
});
