import { describe, expect, it } from 'vitest';
import { applyAction } from '../apply-action.js';
import type { Action, ActivateEffectAction } from '../actions/types.js';
import { fusionOptions, type FusionSummonOperation } from '../effects/operations/fusion-summon.js';
import type { GameEvent } from '../events/types.js';
import { getLegalActions } from '../legal-actions.js';
import type { GameState } from '../state/types.js';
import { deepFreeze } from '../testing/deep-freeze.js';
import { expectEngineError } from '../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, inst, type FixtureSetup } from '../testing/effect-fixtures.js';

/*
 * Task 4.5 — Fusion. A Normal Spell with `FusionSummon`: activatable only when a Fusion Monster in your Extra Deck has
 * all its named materials among your cards in the operation's `sources`; nothing is chosen at activation. When the link
 * RESOLVES the engine pauses the chain: prompt `SelectFusionMonster`, then `SelectFusionMaterials`; the materials go to
 * the graveyard and the monster is Special Summoned (OnSummon fires, no Normal Summon used, no Summon window).
 */

const activate = (cardInstanceId = 'h0', playerIndex: 0 | 1 = 0): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex, cardInstanceId, effectId: 'e1' },
});
const pass = (playerIndex: 0 | 1): Action => ({ type: 'PassPriority', payload: { playerIndex } });
const answer = (state: GameState, cardInstanceIds: string[], playerIndex: 0 | 1 = 0): Action => ({
  type: 'ResolvePendingPrompt',
  payload: { playerIndex, promptId: state.pendingPrompt!.promptId, cardInstanceIds },
});

const start = (setup: FixtureSetup): GameState => deepFreeze(fixtureState(setup));
const step = (state: GameState, action: Action) => {
  const out = applyAction(state, action, fixtureCtx);
  return { state: deepFreeze(out.state), events: out.events };
};
const types = (events: readonly GameEvent[]) => events.map((e) => e.type);
const ids = (cards: readonly ({ instanceId: string } | null)[]) =>
  cards.map((c) => c?.instanceId ?? null);

/** hand: FUS (h0), M1 (h1), M2 (h2); Extra Deck: FM_AB (x0). */
const BASIC: FixtureSetup = { hand: ['FUS', 'M1', 'M2'], myExtraDeck: ['FM_AB'] };

/** Activates h0, picks `fusion`, picks `materials`; returns the three steps. */
function fuse(setup: FixtureSetup, fusion: string, materials: string[]) {
  const activated = step(start(setup), activate());
  const picked = step(activated.state, answer(activated.state, [fusion]));
  const done = step(picked.state, answer(picked.state, materials));
  return { activated, picked, done };
}

describe('Fusion — activation', () => {
  it('nothing is chosen at activation: the link resolves at once and the chain pauses on SelectFusionMonster', () => {
    const before = start(BASIC);
    const { state, events } = step(before, activate());
    expect(types(events)).toEqual(['EffectActivated', 'ChainLinkAdded']);
    expect(events[1]).toMatchObject({ targetInstanceIds: [], spellSpeed: 1 });
    expect(state.pendingPrompt).toMatchObject({
      playerIndex: 0,
      kind: 'SelectFusionMonster',
      payload: { candidateInstanceIds: ['x0'], count: 1, owedTriggers: [], linkCount: 1 },
    });
    // The fusion Spell is still on the chain (it is resolving), so the window invariant holds.
    expect(ids(state.chainStack.map((l) => l.card))).toEqual(['h0']);
    expect(state.chainWindow).toEqual({ priorityPlayer: 0, passCount: 0 });
    // Nothing moved yet.
    expect(ids(state.players[0].hand)).toEqual(['h1', 'h2']);
    expect(ids(state.players[0].extraDeck)).toEqual(['x0']);
    expect(state.players[0].graveyard).toEqual([]);
    expect(state.version).toBe(before.version + 1);
  });

  it.each<[string, FixtureSetup]>([
    ['no Extra Deck', { hand: ['FUS', 'M1', 'M2'] }],
    ['a material is missing', { hand: ['FUS', 'M1'], myExtraDeck: ['FM_AB'] }],
    [
      'the material is only in the graveyard',
      { hand: ['FUS', 'M1'], myGraveyard: ['M2'], myExtraDeck: ['FM_AB'] },
    ],
    [
      "the material is on the OPPONENT's field",
      { hand: ['FUS', 'M1'], oppMonsters: [[0, 'M2']], myExtraDeck: ['FM_AB'] },
    ],
    ['two copies are needed, one is there', { hand: ['FUS', 'M1', 'M2'], myExtraDeck: ['FM_AAB'] }],
    [
      "the Fusion Monster is in the OPPONENT's Extra Deck",
      { hand: ['FUS', 'M1', 'M2'], oppExtraDeck: ['FM_AB'] },
    ],
    ['the Extra Deck holds no Fusion Monster', { hand: ['FUS', 'M1', 'M2'], myExtraDeck: ['M1'] }],
  ])('%s → NOT_ACTIVATABLE', (_label, setup) => {
    expectEngineError(() => step(start(setup), activate()), 'NOT_ACTIVATABLE');
  });

  it('materials in the hand but five monsters on the field → NO_FREE_MONSTER_ZONE', () => {
    const setup: FixtureSetup = {
      ...BASIC,
      myMonsters: [
        [0, 'D'],
        [1, 'D'],
        [2, 'D'],
        [3, 'D'],
        [4, 'D'],
      ],
    };
    expectEngineError(() => step(start(setup), activate()), 'NO_FREE_MONSTER_ZONE');
  });

  it('a full field is fine when a material on the field frees a zone; the monster lands there', () => {
    const setup: FixtureSetup = {
      hand: ['FUS', 'M2'],
      myExtraDeck: ['FM_AB'],
      myMonsters: [
        [0, 'D'],
        [1, 'D'],
        [2, 'M1'],
        [3, 'D'],
        [4, 'D'],
      ],
    };
    const { picked, done } = fuse(setup, 'x0', ['h1', 'm0-2']);
    expect(picked.state.pendingPrompt?.payload).toMatchObject({
      candidateInstanceIds: ['h1', 'm0-2'],
    });
    expect(done.state.players[0].board.monsterZones[2]?.instanceId).toBe('x0');
  });

  it('a malformed Quick-Play Spell with FusionSummon is never activatable (Spell Speed 1 only)', () => {
    const setup: FixtureSetup = { hand: ['QP_FUS', 'M1', 'M2'], myExtraDeck: ['FM_AB'] };
    expectEngineError(() => step(start(setup), activate()), 'NOT_ACTIVATABLE');
  });

  it('getLegalActions lists the activation only when a Fusion Summon is possible', () => {
    const can = getLegalActions(start(BASIC), 0, fixtureCtx);
    expect(can).toContainEqual(activate());
    const cannot = getLegalActions(start({ hand: ['FUS', 'M1'] }), 0, fixtureCtx);
    expect(cannot).not.toContainEqual(activate());
  });
});

describe('Fusion — resolution', () => {
  it('SelectFusionMonster → SelectFusionMaterials (no event, version +1)', () => {
    const { activated, picked } = fuse(BASIC, 'x0', ['h1', 'h2']);
    expect(picked.events).toEqual([]);
    expect(picked.state.version).toBe(activated.state.version + 1);
    expect(picked.state.pendingPrompt).toMatchObject({
      playerIndex: 0,
      kind: 'SelectFusionMaterials',
      payload: {
        fusionInstanceId: 'x0',
        candidateInstanceIds: ['h1', 'h2'],
        count: 2,
        owedTriggers: [],
        linkCount: 1,
      },
    });
    expect(picked.state.pendingPrompt?.promptId).not.toBe(activated.state.pendingPrompt?.promptId);
    expect(ids(picked.state.chainStack.map((l) => l.card))).toEqual(['h0']);
  });

  it('materials go to the graveyard, the Fusion Monster to the lowest empty zone in Attack Position', () => {
    const { picked, done } = fuse(BASIC, 'x0', ['h1', 'h2']);
    const { state, events } = done;
    expect(types(events)).toEqual([
      'FusionMaterialSent',
      'FusionMaterialSent',
      'MonsterFusionSummoned',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(events[0]).toEqual({
      type: 'FusionMaterialSent',
      ownerIndex: 0,
      instanceId: 'h1',
      definitionId: 'M1',
      from: 'Hand',
    });
    expect(events[2]).toEqual({
      type: 'MonsterFusionSummoned',
      playerIndex: 0,
      instanceId: 'x0',
      definitionId: 'FM_AB',
      zoneIndex: 0,
      position: 'Attack',
      materialInstanceIds: ['h1', 'h2'],
    });
    expect(events[5]).toEqual({ type: 'ChainResolved', linkCount: 1 });
    const me = state.players[0];
    expect(me.board.monsterZones[0]).toEqual({
      instanceId: 'x0',
      definitionId: 'FM_AB',
      ownerIndex: 0,
      position: 'Attack',
      summonedTurn: state.turnCount,
    });
    expect(me.hand).toEqual([]);
    expect(me.extraDeck).toEqual([]);
    expect(me.graveyard).toEqual([inst('h1', 'M1'), inst('h2', 'M2'), inst('h0', 'FUS')]);
    expect(me.hasNormalSummonedThisTurn).toBe(false);
    expect(state.chainStack).toEqual([]);
    expect(state.chainWindow).toBeNull();
    expect(state.pendingPrompt).toBeNull();
    expect(state.version).toBe(picked.state.version + 1);
  });

  it('a material on the field leaves its zone (face-up or face-down) and says where it came from', () => {
    const setup: FixtureSetup = {
      hand: ['FUS'],
      myExtraDeck: ['FM_AB'],
      myMonsters: [
        [1, 'M1', 'DefenseDown'],
        [3, 'M2'],
      ],
    };
    const { done } = fuse(setup, 'x0', ['m0-1', 'm0-3']);
    expect(done.events[0]).toEqual({
      type: 'FusionMaterialSent',
      ownerIndex: 0,
      instanceId: 'm0-1',
      definitionId: 'M1',
      from: 'MonsterZone',
      zoneIndex: 1,
    });
    expect(ids(done.state.players[0].board.monsterZones)).toEqual(['x0', null, null, null, null]);
    expect(done.state.players[0].graveyard.map((c) => [c.instanceId, c.position])).toEqual([
      ['m0-1', null],
      ['m0-3', null],
      ['h0', null],
    ]);
  });

  it('the operation decides the position (DefenseUp) and the sources (hand only: a field copy is no candidate)', () => {
    const setup: FixtureSetup = {
      hand: ['FUS_HAND_DEF', 'M1', 'M2'],
      myExtraDeck: ['FM_AB'],
      myMonsters: [[0, 'M1']],
    };
    const { picked, done } = fuse(setup, 'x0', ['h1', 'h2']);
    expect(picked.state.pendingPrompt?.payload).toMatchObject({
      candidateInstanceIds: ['h1', 'h2'],
    });
    expect(done.state.players[0].board.monsterZones[1]).toMatchObject({
      instanceId: 'x0',
      position: 'DefenseUp',
    });
  });

  it('with several copies the player chooses which one is used', () => {
    const setup: FixtureSetup = { ...BASIC, myMonsters: [[0, 'M1']] };
    const { picked, done } = fuse(setup, 'x0', ['m0-0', 'h2']);
    expect(picked.state.pendingPrompt?.payload).toMatchObject({
      candidateInstanceIds: ['h1', 'h2', 'm0-0'],
      count: 2,
    });
    expect(ids(done.state.players[0].hand)).toEqual(['h1']);
    expect(ids(done.state.players[0].board.monsterZones)).toEqual(['x0', null, null, null, null]);
  });

  it('a Fusion Monster that names a material twice needs two different copies', () => {
    const setup: FixtureSetup = { hand: ['FUS', 'M1', 'M1', 'M2'], myExtraDeck: ['FM_AAB'] };
    const { picked, done } = fuse(setup, 'x0', ['h1', 'h2', 'h3']);
    expect(picked.state.pendingPrompt?.payload).toMatchObject({ count: 3 });
    expect(done.events.at(3)).toMatchObject({ materialInstanceIds: ['h1', 'h2', 'h3'] });
  });

  it('several Fusion Monsters: only the ones whose materials are there are candidates', () => {
    const setup: FixtureSetup = {
      hand: ['FUS', 'M1', 'M2'],
      myExtraDeck: ['FM_BIG', 'FM_AB', 'FM_AAB', 'FM_SUM'],
    };
    const activated = step(start(setup), activate());
    expect(activated.state.pendingPrompt?.payload).toMatchObject({
      candidateInstanceIds: ['x1', 'x3'],
    });
    const done = step(activated.state, answer(activated.state, ['x1']));
    expect(done.state.pendingPrompt?.payload).toMatchObject({ fusionInstanceId: 'x1' });
  });

  it.each<[string, string[]]>([
    ['nothing', []],
    ['two monsters', ['x0', 'x1']],
    ['a Fusion Monster without its materials', ['x1']],
    ['a card that is not in the Extra Deck', ['h1']],
  ])('SelectFusionMonster answered with %s → INVALID_EFFECT_TARGET', (_label, chosen) => {
    const setup: FixtureSetup = { ...BASIC, myExtraDeck: ['FM_AB', 'FM_BIG'] };
    const activated = step(start(setup), activate());
    expectEngineError(
      () => step(activated.state, answer(activated.state, chosen)),
      'INVALID_EFFECT_TARGET',
    );
  });

  it.each<[string, string[]]>([
    ['too few', ['h1']],
    ['too many', ['h1', 'h2', 'm0-0']],
    ['the same card twice', ['h1', 'h1']],
    ['two copies of one material', ['h1', 'm0-0']],
    ['a card that is no candidate', ['h1', 'x0']],
  ])('SelectFusionMaterials answered with %s → INVALID_EFFECT_TARGET', (_label, chosen) => {
    const setup: FixtureSetup = { ...BASIC, myMonsters: [[0, 'M1']] };
    const activated = step(start(setup), activate());
    const picked = step(activated.state, answer(activated.state, ['x0']));
    expectEngineError(
      () => step(picked.state, answer(picked.state, chosen)),
      'INVALID_EFFECT_TARGET',
    );
  });

  it('on a full field the chosen materials must free a zone', () => {
    const setup: FixtureSetup = {
      ...BASIC,
      myMonsters: [
        [0, 'M1'],
        [1, 'D'],
        [2, 'D'],
        [3, 'D'],
        [4, 'D'],
      ],
    };
    const activated = step(start(setup), activate());
    const picked = step(activated.state, answer(activated.state, ['x0']));
    expectEngineError(
      () => step(picked.state, answer(picked.state, ['h1', 'h2'])),
      'INVALID_EFFECT_TARGET',
    );
    const done = step(picked.state, answer(picked.state, ['m0-0', 'h2']));
    expect(done.state.players[0].board.monsterZones[0]?.instanceId).toBe('x0');
  });

  it('while the prompt is open nothing else is accepted', () => {
    const { state } = step(start(BASIC), activate());
    expectEngineError(
      () => step(state, { type: 'EndPhase', payload: { playerIndex: 0 } }),
      'CHAIN_WINDOW_OPEN',
    );
    expectEngineError(() => step(state, pass(0)), 'PENDING_PROMPT');
    expectEngineError(() => step(state, activate('h1')), 'PENDING_PROMPT');
    expectEngineError(() => step(state, answer(state, ['x0'], 1)), 'PROMPT_MISMATCH');
    expectEngineError(
      () =>
        step(state, {
          type: 'ResolvePendingPrompt',
          payload: {
            playerIndex: 0,
            promptId: state.pendingPrompt!.promptId,
            cardInstanceIds: [],
            decline: true,
          },
        }),
      'INVALID_TRIGGER_ANSWER',
    );
  });

  it('getLegalActions offers exactly the valid answers of both prompts', () => {
    const setup: FixtureSetup = { ...BASIC, myMonsters: [[0, 'M1']] };
    const activated = step(start(setup), activate());
    const answersOf = (state: GameState) =>
      getLegalActions(state, 0, fixtureCtx).flatMap((a) =>
        a.type === 'ResolvePendingPrompt' ? [a.payload.cardInstanceIds] : [],
      );
    expect(answersOf(activated.state)).toEqual([['x0']]);
    expect(getLegalActions(activated.state, 1, fixtureCtx).map((a) => a.type)).toEqual([
      'Surrender',
    ]);
    const picked = step(activated.state, answer(activated.state, ['x0']));
    expect(answersOf(picked.state)).toEqual([
      ['h1', 'h2'],
      ['h2', 'm0-0'],
    ]);
  });

  it('the state stays plain JSON through both prompts', () => {
    const roundTrip = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState;
    const direct = fuse(BASIC, 'x0', ['h1', 'h2']).done;
    const activated = step(start(BASIC), activate());
    expect(roundTrip(activated.state)).toEqual(activated.state);
    const picked = step(roundTrip(activated.state), answer(activated.state, ['x0']));
    expect(roundTrip(picked.state)).toEqual(picked.state);
    const done = step(roundTrip(picked.state), answer(picked.state, ['h1', 'h2']));
    expect(done).toEqual(direct);
  });

  it('a Set fusion Spell works the same: it stays face-up in its zone until its link is done', () => {
    const setup: FixtureSetup = {
      hand: ['M1', 'M2'],
      mySpellTraps: [[2, 'FUS']],
      myExtraDeck: ['FM_AB'],
    };
    const activated = step(start(setup), activate('ms-2'));
    expect(activated.state.players[0].board.spellTrapZones[2]).toMatchObject({
      instanceId: 'ms-2',
      position: 'Attack',
    });
    const picked = step(activated.state, answer(activated.state, ['x0']));
    const done = step(picked.state, answer(picked.state, ['h0', 'h1']));
    expect(done.state.players[0].board.spellTrapZones[2]).toBeNull();
    expect(ids(done.state.players[0].graveyard)).toEqual(['h0', 'h1', 'ms-2']);
    expect(done.events.at(-2)).toMatchObject({
      type: 'CardSentToGraveyard',
      from: 'SpellTrapZone',
    });
  });
});

describe('Fusion — materials from the Deck', () => {
  const withDeck = (): GameState => {
    const base = fixtureState({ hand: ['FUS_DECK', 'M1'], myExtraDeck: ['FM_AB'] });
    const deck = ['D', 'M1', 'D', 'M2', 'D', 'D'].map((d, i) => inst(`d${i}`, d));
    return deepFreeze({ ...base, players: [{ ...base.players[0], deck }, base.players[1]] });
  };

  it('only Deck cards are candidates; they go to the graveyard and the Deck is shuffled with the state rng', () => {
    const before = withDeck();
    const activated = step(before, activate());
    const picked = step(activated.state, answer(activated.state, ['x0']));
    expect(picked.state.pendingPrompt?.payload).toMatchObject({
      candidateInstanceIds: ['d1', 'd3'],
    });
    expect(picked.state.rng).toEqual(before.rng);
    const done = step(picked.state, answer(picked.state, ['d1', 'd3']));
    expect(done.events[0]).toEqual({
      type: 'FusionMaterialSent',
      ownerIndex: 0,
      instanceId: 'd1',
      definitionId: 'M1',
      from: 'Deck',
    });
    const me = done.state.players[0];
    expect(ids(me.deck).sort()).toEqual(['d0', 'd2', 'd4', 'd5']);
    expect(ids(me.hand)).toEqual(['h1']);
    expect(ids(me.graveyard)).toEqual(['d1', 'd3', 'h0']);
    expect(done.state.rng).not.toEqual(before.rng);
  });

  it('materials from the hand or the field do NOT touch the rng', () => {
    const before = start(BASIC);
    const { done } = fuse(BASIC, 'x0', ['h1', 'h2']);
    expect(done.state.rng).toEqual(before.rng);
    expect(done.state.players[0].deck).toEqual(before.players[0].deck);
  });

  it('a card in the hand does not count for a Deck-only fusion', () => {
    const base = fixtureState({ hand: ['FUS_DECK', 'M1', 'M2'], myExtraDeck: ['FM_AB'] });
    expectEngineError(() => step(deepFreeze(base), activate()), 'NOT_ACTIVATABLE');
  });
});

describe('Fusion — it is a Special Summon', () => {
  it('fires the OnSummon trigger of the Fusion Monster as a new chain after the fusion chain', () => {
    const { done } = fuse({ ...BASIC, myExtraDeck: ['FM_SUM'] }, 'x0', ['h1', 'h2']);
    expect(types(done.events)).toEqual([
      'FusionMaterialSent',
      'FusionMaterialSent',
      'MonsterFusionSummoned',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(done.events[6]).toMatchObject({ instanceId: 'x0', definitionId: 'FM_SUM' });
    expect(done.state.players[1].lifePoints).toBe(8000 - 300);
  });

  it('opens NO Summon reaction window: a Set NegateSummon is never offered', () => {
    const setup: FixtureSetup = { ...BASIC, oppSpellTraps: [[0, 'NEG_SUM']] };
    const { done } = fuse(setup, 'x0', ['h1', 'h2']);
    expect(done.state.chainWindow).toBeNull();
    expect(done.state.players[0].board.monsterZones[0]?.instanceId).toBe('x0');
    expect(done.state.players[1].board.spellTrapZones[0]?.position).toBe('DefenseDown');
  });

  it('does not use the Normal Summon of the turn', () => {
    const { done } = fuse({ ...BASIC, hand: ['FUS', 'M1', 'M2', 'D'] }, 'x0', ['h1', 'h2']);
    const summoned = step(done.state, {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'h3', zoneIndex: 1 },
    });
    expect(ids(summoned.state.players[0].board.monsterZones)).toEqual([
      'x0',
      'h3',
      null,
      null,
      null,
    ]);
  });

  it('cannot attack or change position on the turn it was Fusion Summoned (G22)', () => {
    const base = fixtureState(BASIC);
    const turn3 = deepFreeze({ ...base, turnCount: 3 });
    const activated = step(turn3, activate());
    const picked = step(activated.state, answer(activated.state, ['x0']));
    const done = step(picked.state, answer(picked.state, ['h1', 'h2']));
    expect(done.state.players[0].board.monsterZones[0]?.summonedTurn).toBe(3);
    expectEngineError(
      () =>
        step(done.state, {
          type: 'ChangePosition',
          payload: { playerIndex: 0, cardInstanceId: 'x0', toPosition: 'DefenseUp' },
        }),
      'SUMMONED_THIS_TURN',
    );
    const battle = deepFreeze({ ...done.state, phase: 'Battle' as const });
    expectEngineError(
      () =>
        step(battle, {
          type: 'DeclareAttack',
          payload: { playerIndex: 0, attackerInstanceId: 'x0' },
        }),
      'JUST_SUMMONED_CANNOT_ATTACK',
    );
  });
});

describe('Fusion — on a chain', () => {
  it('a negated activation uses no material: everything stays where it was, the Spell goes to the graveyard', () => {
    const setup: FixtureSetup = { ...BASIC, oppSpellTraps: [[0, 'NEG_ANY']] };
    const activated = step(start(setup), activate());
    // The opponent can respond: no prompt yet, they hold priority.
    expect(activated.state.pendingPrompt).toBeNull();
    expect(activated.state.chainWindow).toEqual({ priorityPlayer: 1, passCount: 0 });
    const negated = step(activated.state, activate('os-0', 1));
    expect(types(negated.events)).toContain('ChainLinkNegated');
    expect(types(negated.events)).not.toContain('FusionMaterialSent');
    expect(types(negated.events)).not.toContain('MonsterFusionSummoned');
    const me = negated.state.players[0];
    expect(ids(me.hand)).toEqual(['h1', 'h2']);
    expect(ids(me.extraDeck)).toEqual(['x0']);
    expect(ids(me.graveyard)).toEqual(['h0']);
    expect(ids(me.board.monsterZones)).toEqual([null, null, null, null, null]);
    expect(negated.state.pendingPrompt).toBeNull();
    expect(negated.state.chainWindow).toBeNull();
  });

  it('the opponent passes instead: the prompt comes only then', () => {
    const setup: FixtureSetup = { ...BASIC, oppSpellTraps: [[0, 'NEG_ANY']] };
    const activated = step(start(setup), activate());
    const passed = step(activated.state, pass(1));
    expect(passed.events).toEqual([]);
    expect(passed.state.pendingPrompt?.kind).toBe('SelectFusionMonster');
  });

  it('a material destroyed in response: the link resolves without effect (no prompt, nothing else is used)', () => {
    const setup: FixtureSetup = {
      hand: ['FUS', 'M2'],
      myExtraDeck: ['FM_AB'],
      myMonsters: [[0, 'M1']],
      oppSpellTraps: [[0, 'TRAP_KILL_MON']],
    };
    const activated = step(start(setup), activate());
    const answered = step(activated.state, activate('os-0', 1));
    expect(types(answered.events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(answered.events[5]).toMatchObject({ instanceId: 'h0' });
    expect(answered.events[7]).toEqual({ type: 'ChainResolved', linkCount: 2 });
    const me = answered.state.players[0];
    expect(ids(me.hand)).toEqual(['h1']);
    expect(ids(me.extraDeck)).toEqual(['x0']);
    expect(ids(me.graveyard)).toEqual(['m0-0', 'h0']);
    expect(answered.state.pendingPrompt).toBeNull();
    expect(answered.state.chainWindow).toBeNull();
  });

  it('triggers fired higher on the chain wait for the fusion: they are owed in the prompt and run after it', () => {
    const setup: FixtureSetup = {
      ...BASIC,
      myMonsters: [[0, 'DES_BURN']],
      oppSpellTraps: [[0, 'TRAP_KILL_MON']],
    };
    const activated = step(start(setup), activate());
    const answered = step(activated.state, activate('os-0', 1));
    expect(types(answered.events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'MonsterDestroyed',
      'EffectResolved',
      'CardSentToGraveyard',
    ]);
    expect(answered.state.pendingPrompt).toMatchObject({
      kind: 'SelectFusionMonster',
      payload: {
        linkCount: 2,
        owedTriggers: [
          {
            playerIndex: 0,
            instanceId: 'm0-0',
            definitionId: 'DES_BURN',
            effectId: 'e1',
            source: { zone: 'Graveyard' },
          },
        ],
      },
    });
    expect(answered.state.players[1].lifePoints).toBe(8000);
    const picked = step(answered.state, answer(answered.state, ['x0']));
    expect(picked.state.pendingPrompt?.payload).toMatchObject({
      linkCount: 2,
      owedTriggers: [{ instanceId: 'm0-0' }],
    });
    const done = step(picked.state, answer(picked.state, ['h1', 'h2']));
    expect(types(done.events)).toEqual([
      'FusionMaterialSent',
      'FusionMaterialSent',
      'MonsterFusionSummoned',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
      'EffectActivated',
      'ChainLinkAdded',
      'DamageDealt',
      'EffectResolved',
      'ChainResolved',
    ]);
    expect(done.events[5]).toEqual({ type: 'ChainResolved', linkCount: 2 });
    expect(done.events[6]).toMatchObject({ instanceId: 'm0-0', definitionId: 'DES_BURN' });
    expect(done.state.players[1].lifePoints).toBe(8000 - 400);
  });

  it('owed triggers and the OnSummon of the Fusion Monster go on ONE chain, older events first', () => {
    const setup: FixtureSetup = {
      ...BASIC,
      myExtraDeck: ['FM_SUM'],
      myMonsters: [[0, 'DES_BURN']],
      oppSpellTraps: [[0, 'TRAP_KILL_MON']],
    };
    const activated = step(start(setup), activate());
    const answered = step(activated.state, activate('os-0', 1));
    const picked = step(answered.state, answer(answered.state, ['x0']));
    const done = step(picked.state, answer(picked.state, ['h1', 'h2']));
    const links = done.events.flatMap((e) =>
      e.type === 'ChainLinkAdded' ? [[e.chainIndex, e.instanceId]] : [],
    );
    expect(links).toEqual([
      [1, 'm0-0'],
      [2, 'x0'],
    ]);
    expect(done.events.at(-1)).toEqual({ type: 'ChainResolved', linkCount: 2 });
    expect(done.state.players[1].lifePoints).toBe(8000 - 400 - 300);
  });
});

describe('Fusion Monsters — no other way onto the field', () => {
  const inHand = (definitionId: string): GameState => {
    const base = fixtureState({ hand: [definitionId] });
    return deepFreeze(base);
  };

  it.each(['NormalSummon', 'SetMonster'] as const)(
    '%s of a Fusion Monster → FUSION_NOT_SUMMONABLE',
    (type) => {
      expectEngineError(
        () =>
          step(inHand('FM_AB'), {
            type,
            payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 0, tributeInstanceIds: [] },
          }),
        'FUSION_NOT_SUMMONABLE',
      );
    },
  );

  it('the SpecialSummon operation never takes a Fusion Monster from the hand or the graveyard', () => {
    expectEngineError(
      () => step(start({ hand: ['SS_HAND', 'FM_AB'] }), activate()),
      'NO_VALID_TARGET',
    );
    expectEngineError(
      () => step(start({ hand: ['SS_GY_DEF'], myGraveyard: ['FM_AB'] }), activate()),
      'NO_VALID_TARGET',
    );
    // With an ordinary monster next to it, that one is the only candidate (picked without a prompt).
    const mixed = step(start({ hand: ['SS_GY_DEF'], myGraveyard: ['FM_AB', 'M1'] }), activate());
    expect(mixed.state.pendingPrompt).toBeNull();
    expect(mixed.state.players[0].board.monsterZones[0]?.instanceId).toBe('g1');
    expect(ids(mixed.state.players[0].graveyard)).toEqual(['g0', 'h0']);
  });

  it('a destroyed Fusion Monster goes to its owner’s graveyard, not back to the Extra Deck', () => {
    const { state, events } = step(
      start({ hand: ['KILL'], oppMonsters: [[0, 'FM_AB']] }),
      activate(),
    );
    expect(types(events)).toContain('MonsterDestroyed');
    expect(ids(state.players[1].graveyard)).toEqual(['o0-0']);
    expect(state.players[1].extraDeck).toEqual([]);
  });
});

describe('fusionOptions (pure)', () => {
  const op: FusionSummonOperation = { kind: 'FusionSummon', sources: ['Hand', 'Field'] };

  it('lists each Fusion Monster that can be made, with the cards that may serve as its materials', () => {
    const state = start({
      hand: ['M1', 'D', 'M2'],
      myMonsters: [[3, 'M1', 'DefenseDown']],
      myExtraDeck: ['FM_AB', 'FM_BIG', 'FM_AAB'],
    });
    const options = fusionOptions(state, 0, op, fixtureCtx);
    expect(options.map((o) => o.fusion.instanceId)).toEqual(['x0', 'x2']);
    expect(options[0]?.candidates.map((c) => [c.card.instanceId, c.from])).toEqual([
      ['h0', 'Hand'],
      ['h2', 'Hand'],
      ['m0-3', 'MonsterZone'],
    ]);
    expect(options[0]?.materials).toEqual(['M1', 'M2']);
    expect(options[1]?.materials).toEqual(['M1', 'M1', 'M2']);
  });

  it('nothing for the other player, and nothing from sources the operation does not name', () => {
    const state = start({ hand: ['M1', 'M2'], myExtraDeck: ['FM_AB'] });
    expect(fusionOptions(state, 1, op, fixtureCtx)).toEqual([]);
    const fieldOnly: FusionSummonOperation = { kind: 'FusionSummon', sources: ['Field'] };
    expect(fusionOptions(state, 0, fieldOnly, fixtureCtx)).toEqual([]);
  });
});
