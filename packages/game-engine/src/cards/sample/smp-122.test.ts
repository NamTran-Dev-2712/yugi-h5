import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  answer,
  apply,
  attack,
  endPhase,
  lp,
  main,
  stats,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-122 (Tier B), Equip Spell aimed at the OTHER side: equip to 1 face-up monster your opponent controls;
 * it loses 600 ATK. The card sits in MY Spell/Trap Zone. `BIG` is 2000 ATK, SMP-006 1500 ATK, SMP-013 500 ATK.
 */

const cursed = (mine: [number, string][] = []) =>
  apply(
    main({ hand: ['SMP-122'], myMonsters: mine, oppMonsters: [[1, 'BIG']] }),
    activate('h0', 'equip'),
  );

describe('SMP-122', () => {
  it("equips to the opponent's face-up monster: −600 ATK, the card stays in MY Spell/Trap Zone", () => {
    const { state, events } = cursed();
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'CardEquipped',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'CardEquipped', playerIndex: 0, targetInstanceId: 'o0-1' }),
    );
    expect(state.players[0].board.spellTrapZones[0]).toMatchObject({
      instanceId: 'h0',
      position: 'Attack',
      equippedTo: 'o0-1',
    });
    expect(state.players[1].board.spellTrapZones.every((c) => c === null)).toBe(true);
    expect(stats(state, 1, 1)).toEqual({ atk: 1400, def: 500 });
    expect(events).toMatchSnapshot();
  });

  it('the penalty decides a battle: SMP-006 (1500) beats BIG (2000 − 600); the Equip then goes to MY graveyard', () => {
    const eq = cursed([[0, 'SMP-006']]).state;
    const { state } = apply(apply(eq, endPhase()).state, attack('m0-0', 'o0-1'));
    expect(state.players[1].board.monsterZones[1]).toBeNull();
    expect(lp(state)).toEqual([8000, 7900]);
    expect(state.players[0].board.spellTrapZones[0]).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SMP-122']);
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toEqual(['BIG']);
  });

  it('ATK never goes below 0 (SMP-013: 500 − 600)', () => {
    const { state } = apply(
      main({ hand: ['SMP-122'], oppMonsters: [[0, 'SMP-013']] }),
      activate('h0', 'equip'),
    );
    expect(stats(state, 1, 0).atk).toBe(0);
  });

  it('several opponent monsters: asks which one; my own monsters are never candidates', () => {
    const before = main({
      hand: ['SMP-122'],
      myMonsters: [[0, 'M1']],
      oppMonsters: [
        [0, 'M1'],
        [3, 'BIG'],
        [4, 'M1', 'DefenseDown'],
      ],
    });
    const asked = apply(before, activate('h0', 'equip')).state;
    expect(asked.pendingPrompt).toMatchObject({
      kind: 'SelectEffectTarget',
      payload: { candidateInstanceIds: ['o0-0', 'o0-3'], count: 1 },
    });
    const { state } = apply(asked, answer(asked, ['o0-3']));
    expect(stats(state, 1, 3).atk).toBe(1400);
    expect(stats(state, 1, 0).atk).toBe(1000);
  });

  it('no face-up monster on the other side: NO_VALID_TARGET', () => {
    const s = main({
      hand: ['SMP-122'],
      myMonsters: [[0, 'M1']],
      oppMonsters: [[0, 'M1', 'DefenseDown']],
    });
    expectEngineError(() => apply(s, activate('h0', 'equip')), 'NO_VALID_TARGET');
  });
});
