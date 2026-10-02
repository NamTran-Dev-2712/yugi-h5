import {
  applyAction,
  getLegalActions,
  type Action,
  type ActionContext,
  type CardInstance,
  type GameState,
} from '@yugi/game-engine';
import { SAMPLE_CARDS, type CardDefinition, type PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { toStateView } from '../state-view';
import { toPlayerActions } from '../wire-actions';
import { AI_DEFS, AI_SEAT, buildState, type Scenario } from './ai-test-kit';
import { createAiRng } from './ai-rng';
import { chooseAction } from './choose-action';

/**
 * Task 4.4b — the server AI is NOT taught to use Counter Traps / negations (that is P8). What it must do today, with the
 * real cards SMP-201 (negate an attack), SMP-209 (negate a Spell/Trap activation) and SMP-210 (negate a Summon) Set on
 * its side (e.g. by a Sandbox scenario): hold the window the engine opens for it and PASS, never get stuck, and never
 * Set / activate one on its own turn (ADR 048, 055).
 */

const REAL = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const defs = (id: string) => REAL.get(id) ?? AI_DEFS[id];
const ctx: ActionContext = { cardDefinitions: defs };

const setCard = (instanceId: string, definitionId: string): CardInstance => ({
  instanceId,
  definitionId,
  ownerIndex: AI_SEAT,
  position: 'DefenseDown',
});

/** The AI's Spell/Trap Zones hold the given cards Set (`s<i>`), Set on an earlier turn; `turn` picks who is on turn. */
function withSet(s: Scenario, traps: readonly string[], turn: 0 | 1 = AI_SEAT): GameState {
  const state = buildState(s);
  const ai = state.players[AI_SEAT];
  const zones = [null, null, null, null, null] as (CardInstance | null)[];
  traps.forEach((d, i) => (zones[i] = setCard(`s${i}`, d)));
  const players = [...state.players] as [GameState['players'][0], GameState['players'][1]];
  players[AI_SEAT] = {
    ...ai,
    board: { ...ai.board, spellTrapZones: zones as unknown as typeof ai.board.spellTrapZones },
  };
  return { ...state, players, turnPlayerIndex: turn };
}

/** The human (seat 0) plays the first legal action of `type` through the engine. */
function humanPlays(state: GameState, type: Action['type']): GameState {
  const action = getLegalActions(state, 0, ctx).find((a) => a.type === type);
  if (!action) throw new Error(`the human has no legal ${type}`);
  return applyAction(state, action, ctx).state;
}

function see(state: GameState) {
  return {
    view: toStateView(state, AI_SEAT, defs),
    legalActions: toPlayerActions(getLegalActions(state, AI_SEAT, ctx)),
  };
}
const decide = (sit: ReturnType<typeof see>, seed: string) =>
  chooseAction({
    view: sit.view,
    legalActions: sit.legalActions,
    cardDefinitions: defs,
    rng: createAiRng(seed),
  });
const SEEDS = ['a', 'b', 'c', 'd', 'e'];
const activates = (legal: readonly PlayerAction[], cardInstanceId: string): boolean =>
  legal.some((a) => a.type === 'ActivateEffect' && a.payload.cardInstanceId === cardInstanceId);

describe('chooseAction — Counter Trap / Negate cards Set on the AI side (task 4.4b)', () => {
  it('the human attacks: the AI holds the reaction window, SMP-201 is listed, it passes', () => {
    const base = withSet(
      { phase: 'Battle', mine: [{ def: 'A1000' }], theirs: [{ def: 'A1900' }] },
      ['SMP-201'],
      0,
    );
    const state = humanPlays(base, 'DeclareAttack');
    expect(state.chainWindow).toMatchObject({
      priorityPlayer: AI_SEAT,
      reactionTo: { kind: 'Attack' },
    });
    const sit = see(state);
    expect(activates(sit.legalActions, 's0')).toBe(true);
    for (const seed of SEEDS) expect(decide(sit, seed).type).toBe('PassPriority');
  });

  it('the human Normal Summons: the AI holds the Summon window, SMP-210 is listed, it passes', () => {
    const base = withSet({ theirHand: ['A1500'] }, ['SMP-210'], 0);
    const state = humanPlays(base, 'NormalSummon');
    expect(state.chainWindow).toMatchObject({
      priorityPlayer: AI_SEAT,
      reactionTo: { kind: 'Summon' },
    });
    const sit = see(state);
    expect(activates(sit.legalActions, 's0')).toBe(true);
    for (const seed of SEEDS) expect(decide(sit, seed).type).toBe('PassPriority');
  });

  it('the human activates a Spell: the AI holds priority on the chain, SMP-209 is listed, it passes', () => {
    const base = withSet({ theirHand: ['SPD'] }, ['SMP-209'], 0);
    const state = humanPlays(base, 'ActivateEffect');
    expect(state.chainStack).toHaveLength(1);
    expect(state.chainWindow).toMatchObject({ priorityPlayer: AI_SEAT });
    const sit = see(state);
    expect(activates(sit.legalActions, 's0')).toBe(true);
    for (const seed of SEEDS) expect(decide(sit, seed).type).toBe('PassPriority');
  });

  it('with all three Set and both kinds of window in a row, every answer is a pass and the turn goes on', () => {
    let state = withSet(
      { theirHand: ['A1500'], theirs: [{ def: 'A1900' }], mine: [{ def: 'A1000' }] },
      ['SMP-201', 'SMP-209', 'SMP-210'],
      0,
    );
    state = humanPlays(state, 'NormalSummon');
    for (let guard = 0; guard < 4 && state.chainWindow?.priorityPlayer === AI_SEAT; guard++) {
      const answer = decide(see(state), `row-${guard}`);
      expect(answer.type).toBe('PassPriority');
      state = applyAction(state, answer as unknown as Action, ctx).state;
    }
    // Not negated: the monster is still there, and the human is back in control of the turn.
    expect(state.chainWindow).toBeNull();
    expect(state.players[0].board.monsterZones.filter((c) => c !== null)).toHaveLength(2);
    expect(state.players[0].graveyard).toHaveLength(0);
  });

  it('on its own turn the Set Counter Traps are not listed at all; it does not Set the one in its hand; it ends the phase', () => {
    const sit = see(
      withSet({ hand: ['SMP-209'], normalSummoned: true }, ['SMP-201', 'SMP-209', 'SMP-210']),
    );
    expect(sit.legalActions.some((a) => a.type === 'ActivateEffect')).toBe(false);
    expect(sit.legalActions.some((a) => a.type === 'SetSpellTrap')).toBe(true);
    for (const seed of SEEDS) expect(decide(sit, seed).type).toBe('EndPhase');
  });

  it('with a monster to play it plays the monster, never the negating cards', () => {
    const sit = see(withSet({ hand: ['SMP-201', 'SMP-210', 'A1900'] }, ['SMP-209']));
    for (const seed of SEEDS) expect(decide(sit, seed).type).toBe('NormalSummon');
  });
});
