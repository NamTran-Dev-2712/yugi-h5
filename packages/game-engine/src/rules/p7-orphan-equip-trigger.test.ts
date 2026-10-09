import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../legal-actions.js';
import type { TriggerActivationPayload } from '../effects/triggers.js';
import type { GameState } from '../state/types.js';
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
} from '../testing/sample-card-kit.js';
import { inst } from '../testing/effect-fixtures.js';

/*
 * Task 4.8 — the engine issue found by task 4.7 (docs/ai/decisions 071, formerly OPEN-ISSUES P7). A monster carrying an
 * Equip Spell is destroyed; its "when destroyed" trigger targets a Spell/Trap. The Equip leaves the field at the END of
 * the same action (`detachOrphanEquips`), so it must never be a target candidate: listed as the only one, it made a
 * prompt nobody could answer (every answer `INVALID_TRIGGER_ANSWER`, `Surrender` the only legal action left).
 *
 * The 3 actions of the report: player 0 equips the real SMP-122 (−600 ATK, equips to an OPPONENT's monster) to the
 * opponent's monster, ends Main 1, and destroys that monster in battle (BIG 2000 against 1500 − 600).
 */

/** After the Equip + the phase change: Battle Phase, SMP-122 (instance `h0`) face-up in player 0's Spell/Trap Zone 0. */
const equipped = (monster: string, mySpellTraps: [number, string][] = []): GameState => {
  const eq = apply(
    main({
      hand: ['SMP-122'],
      myMonsters: [[0, 'BIG']],
      oppMonsters: [[0, monster]],
      mySpellTraps,
    }),
    activate('h0', 'equip'),
  ).state;
  expect(eq.players[0].board.spellTrapZones[0]).toMatchObject({
    instanceId: 'h0',
    equippedTo: 'o0-0',
  });
  return apply(eq, endPhase()).state;
};

describe('a destroyed monster whose trigger targets a Spell/Trap, while an Equip Spell is on it (task 4.8)', () => {
  it('the Equip is the only Spell/Trap: no prompt, the trigger does not activate, the duel goes on', () => {
    const { state, events } = apply(equipped('P7_DES_KILL_ST'), attack('m0-0', 'o0-0'));
    expect(types(events)).toEqual([
      'AttackDeclared',
      'MonsterDestroyed',
      'DamageDealt',
      'CardSentToGraveyard',
    ]);
    expect(lp(state)).toEqual([8000, 6900]);
    expect(state.pendingPrompt).toBeNull();
    expect(state.chainWindow).toBeNull();
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h0']);
    // The turn player simply goes on.
    expect(getLegalActions(state, 0, sampleCtx)).toContainEqual(endPhase());
    expect(() => apply(state, endPhase())).not.toThrow();
  });

  it('the same with a MANDATORY trigger: nothing goes on the chain, no prompt', () => {
    const { state, events } = apply(equipped('P7_DES_KILL_ST_M'), attack('m0-0', 'o0-0'));
    expect(types(events)).not.toContain('EffectActivated');
    expect(state.pendingPrompt).toBeNull();
    expect(state.chainStack).toEqual([]);
  });

  it('another Spell/Trap is there: the prompt lists it and NOT the Equip; choosing it destroys it', () => {
    const before = equipped('P7_DES_KILL_ST', [[1, 'TRAP_PLAIN']]);
    const { state } = apply(before, attack('m0-0', 'o0-0'));
    expect(state.pendingPrompt).toMatchObject({
      kind: 'TriggerActivation',
      playerIndex: 1,
      payload: { optional: true, candidateInstanceIds: ['ms-1'], count: 1 },
    });
    // The Equip already left the field in that same action.
    expect(state.players[0].graveyard.map((c) => c.instanceId)).toEqual(['h0']);

    const legal = getLegalActions(state, 1, sampleCtx);
    expect(legal.filter((a) => a.type === 'ResolvePendingPrompt')).toEqual([
      answer(state, [], true),
      answer(state, ['ms-1']),
    ]);

    const done = apply(state, answer(state, ['ms-1']));
    expect(types(done.events)).toContain('SpellTrapDestroyed');
    expect(done.state.players[0].board.spellTrapZones[1]).toBeNull();
    expect(done.state.pendingPrompt).toBeNull();
  });

  it('another Spell/Trap is there: declining works too', () => {
    const { state } = apply(
      equipped('P7_DES_KILL_ST', [[1, 'TRAP_PLAIN']]),
      attack('m0-0', 'o0-0'),
    );
    const done = apply(state, answer(state, [], true));
    expect(done.events).toEqual([]);
    expect(done.state.pendingPrompt).toBeNull();
    expect(done.state.players[0].board.spellTrapZones[1]).not.toBeNull();
  });

  it('MANDATORY trigger with one other Spell/Trap: it is the only candidate, so the link goes on the chain by itself', () => {
    const { state, events } = apply(
      equipped('P7_DES_KILL_ST_M', [[1, 'TRAP_PLAIN']]),
      attack('m0-0', 'o0-0'),
    );
    expect(state.pendingPrompt).toBeNull();
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'ChainLinkAdded', targetInstanceIds: ['ms-1'] }),
    );
    expect(types(events)).toContain('SpellTrapDestroyed');
    expect(state.players[0].board.spellTrapZones[1]).toBeNull();
    // The Equip was "sent to the graveyard" with its monster, never "destroyed" by the trigger.
    expect(events.filter((e) => e.type === 'SpellTrapDestroyed').map((e) => e.instanceId)).toEqual([
      'ms-1',
    ]);
  });

  it('every prompt this situation opens has an answer the engine accepts (never only Surrender)', () => {
    for (const monster of ['P7_DES_KILL_ST', 'P7_DES_KILL_ST_M']) {
      for (const backrow of [
        [],
        [[1, 'TRAP_PLAIN']],
        [
          [1, 'TRAP_PLAIN'],
          [2, 'TRAP_PLAIN'],
        ],
      ] as [number, string][][]) {
        const { state } = apply(equipped(monster, backrow), attack('m0-0', 'o0-0'));
        const asked = state.pendingPrompt;
        if (asked === null) continue;
        const answers = getLegalActions(state, asked.playerIndex, sampleCtx).filter(
          (a) => a.type === 'ResolvePendingPrompt',
        );
        expect(answers.length, `${monster} with ${backrow.length} Set card(s)`).toBeGreaterThan(0);
        expect(
          (asked.payload as TriggerActivationPayload).candidateInstanceIds,
          'the Equip is never a candidate',
        ).not.toContain('h0');
      }
    }
  });
});

describe('answering a TriggerActivation prompt whose trigger can no longer activate (task 4.8, defence in depth)', () => {
  /**
   * A hand-made prompt (the engine no longer opens one like it): the asked trigger's card is nowhere, and one more
   * trigger waits behind it — DES_BURN (OnDestroyed mandatory: 400 damage to the opponent) in player 1's graveyard.
   */
  const deadPrompt = (): GameState => {
    const base = battle({ myMonsters: [[0, 'BIG']] });
    const payload: TriggerActivationPayload = {
      trigger: {
        playerIndex: 1,
        instanceId: 'gone',
        definitionId: 'P7_DES_KILL_ST',
        effectId: 'e1',
        source: { zone: 'Graveyard' },
      },
      optional: true,
      candidateInstanceIds: ['nowhere'],
      count: 1,
      remaining: [
        {
          playerIndex: 1,
          instanceId: 'og0',
          definitionId: 'DES_BURN',
          effectId: 'e1',
          source: { zone: 'Graveyard' },
        },
      ],
      afterward: null,
    };
    return {
      ...base,
      players: [base.players[0], { ...base.players[1], graveyard: [inst('og0', 'DES_BURN', 1)] }],
      pendingPrompt: {
        promptId: 'trigger-3-0',
        playerIndex: 1,
        kind: 'TriggerActivation',
        payload,
      },
    };
  };

  it.each([
    ['decline', [] as string[], true],
    ['the listed candidate', ['nowhere'], undefined],
    ['no ids', [] as string[], undefined],
  ])(
    '%s: taken as "does not activate"; the prompt closes and the remaining trigger runs',
    (_l, ids, decline) => {
      const asked = deadPrompt();
      const { state, events } = apply(asked, answer(asked, ids, decline));
      expect(state.pendingPrompt).toBeNull();
      expect(state.version).toBe(asked.version + 1);
      // Nothing of the dead trigger; the one behind it activated and resolved.
      expect(events.filter((e) => e.type === 'EffectActivated')).toEqual([
        expect.objectContaining({ instanceId: 'og0', definitionId: 'DES_BURN' }),
      ]);
      expect(lp(state)).toEqual([7600, 8000]);
    },
  );

  it('such a prompt always has a legal answer', () => {
    const asked = deadPrompt();
    const answers = getLegalActions(asked, 1, sampleCtx).filter(
      (a) => a.type === 'ResolvePendingPrompt',
    );
    expect(answers.length).toBeGreaterThan(0);
  });
});
