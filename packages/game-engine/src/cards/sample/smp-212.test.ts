import { describe, expect, it } from 'vitest';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import {
  activate,
  answer,
  apply,
  lp,
  main,
  pass,
  summon,
  types,
} from '../../testing/sample-card-kit.js';

/*
 * Task 4.7 — SMP-212 (Tier B), Normal Trap (Spell Speed 2, not a Counter Trap): when your opponent activates a MONSTER
 * effect, negate that activation. Player 0 Summons a monster with a "when Summoned" effect; player 1 holds `os-0`.
 * SMP-019 burns 300 when Summoned (mandatory); SMP-049 pays 800 LP to destroy a monster (optional).
 */

const NEGATE = 'hush';

describe('SMP-212', () => {
  it('answers a monster`s trigger effect: the burn of SMP-019 never happens', () => {
    const before = main({ hand: ['SMP-019'], oppSpellTraps: [[0, 'SMP-212']] });
    const waiting = apply(before, summon('h0'));
    expect(types(waiting.events)).toEqual(['NormalSummoned', 'EffectActivated', 'ChainLinkAdded']);
    expect(waiting.state.chainWindow).toMatchObject({ priorityPlayer: 1 });

    const { state, events } = apply(waiting.state, activate('os-0', NEGATE, 1));
    expect(types(events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'ChainLinkNegated',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events.find((e) => e.type === 'ChainLinkAdded')).toMatchObject({ spellSpeed: 2 });
    expect(lp(state)).toEqual([8000, 8000]);
    // Only the ACTIVATION is negated: the monster itself stays on the field.
    expect(state.players[0].board.monsterZones[0]?.definitionId).toBe('SMP-019');
    expect(state.players[1].graveyard.map((c) => c.definitionId)).toEqual(['SMP-212']);
    expect(events).toMatchSnapshot();
  });

  it('the opponent may let it through: passing resolves the burn, the Trap stays Set', () => {
    const waiting = apply(
      main({ hand: ['SMP-019'], oppSpellTraps: [[0, 'SMP-212']] }),
      summon('h0'),
    ).state;
    const { state } = apply(waiting, pass(1));
    expect(lp(state)).toEqual([8000, 7700]);
    expect(state.players[1].board.spellTrapZones[0]?.position).toBe('DefenseDown');
  });

  it('a negated effect keeps its cost paid (G23): SMP-049 loses 800 LP, the target survives', () => {
    const before = main({
      hand: ['SMP-049'],
      oppMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'SMP-212']],
    });
    const asked = apply(before, summon('h0')).state;
    const waiting = apply(asked, answer(asked, ['o0-0'])).state;
    expect(waiting.chainWindow).toMatchObject({ priorityPlayer: 1 });
    const { state, events } = apply(waiting, activate('os-0', NEGATE, 1));
    expect(types(events)).not.toContain('MonsterDestroyed');
    expect(state.players[1].board.monsterZones[0]).not.toBeNull();
    expect(lp(state)).toEqual([7200, 8000]);
  });

  it('does not answer a Spell: SMP-101 resolves at once, no window opens for it', () => {
    const before = main({ hand: ['SMP-101'], oppSpellTraps: [[0, 'SMP-212']] });
    const { state, events } = apply(before, activate('h0', 'draw-one'));
    expect(state.chainWindow).toBeNull();
    expect(types(events)).toContain('CardDrawn');
    expect(state.players[1].board.spellTrapZones[0]?.position).toBe('DefenseDown');
  });

  it('nothing to negate: it cannot be activated on its own', () => {
    const s = main({ mySpellTraps: [[0, 'SMP-212', 1]] });
    expectEngineError(() => apply(s, activate('ms-0', NEGATE)), 'NOTHING_TO_NEGATE');
  });
});
