import {
  applyAction,
  getLegalActions,
  type Action,
  type GameEvent,
  type GameState,
} from '@yugi/game-engine';
import { SAMPLE_CARDS, type CardDefinition } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { toEventView } from './event-view';
import { toStateView } from './state-view';
import { findLeaks } from './testing/leak-check';
import { hiddenIdsFor } from './visibility';
import { toPlayerActions } from './wire-actions';

/*
 * Task 4.5 (Fusion, engine-only) — containment on the api side. No duel made over HTTP has an Extra Deck yet
 * (`DuelManager.createDuel` passes no `extraDeckLists`, `scenarioToState` builds none), so this spec drives the engine
 * directly with the real cards (SMP-116 fuses SMP-045 from SMP-001 + SMP-007) and checks what the api's view layer
 * WOULD send at every step:
 *  - the opponent learns nothing about the Extra Deck but its size, and never which monster is being fused before it is
 *    on the field (leak oracle on the view, the events and the prompt);
 *  - the two Fusion events are dropped for both seats (wiring them is task 4.5b);
 *  - the open gap for 4.5b is pinned down: the OWNER's prompt points at their own Extra Deck, which the oracle (rightly,
 *    by today's rule "a Deck / Extra Deck card is never pointed at") still flags.
 */

const DEFS = new Map<string, CardDefinition>(SAMPLE_CARDS.map((c) => [c.id, c]));
const defs = (id: string) => DEFS.get(id);
const ctx = { cardDefinitions: defs };

const DECK = Array.from({ length: 40 }, (_, i) => ['SMP-116', 'SMP-001', 'SMP-007'][i % 3]!);
const EXTRA = ['SMP-045', 'SMP-046', 'SMP-045'];

/** A duel whose first player opens with the fusion Spell and both materials (first seed that deals them). */
function start(): GameState {
  for (let n = 0; n < 50; n++) {
    const { state } = applyAction(null, {
      type: 'StartDuel',
      payload: {
        matchId: 'fusion-containment',
        seed: `fc-${n}`,
        playerIds: ['p0', 'p1'],
        deckLists: [DECK, DECK],
        extraDeckLists: [EXTRA, EXTRA],
      },
    });
    const hand = state.players[0].hand.map((c) => c.definitionId);
    if (['SMP-116', 'SMP-001', 'SMP-007'].every((id) => hand.includes(id))) return state;
  }
  throw new Error('no seed deals the fusion hand');
}

interface Step {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/** Everything seat `viewer` would receive for this step: its view, its events, and (own seat only) its legal actions. */
function payloadFor(step: Step, viewer: 0 | 1): unknown {
  const hidden = hiddenIdsFor(step.state, viewer);
  return {
    view: toStateView(step.state, viewer, defs),
    events: step.events.flatMap((e) => {
      const view = toEventView(e, viewer, hidden);
      return view === null ? [] : [view];
    }),
    legalActions: toPlayerActions(getLegalActions(step.state, viewer, ctx)),
  };
}

/** Plays the whole Fusion Summon of seat 0 and returns every step (the start included). */
function fuse(): Step[] {
  let state = start();
  const steps: Step[] = [{ state, events: [] }];
  const apply = (action: Action): void => {
    const out = applyAction(state, action, ctx);
    state = out.state;
    steps.push(out);
  };
  const inHand = (definitionId: string): string =>
    state.players[0].hand.find((c) => c.definitionId === definitionId)!.instanceId;
  const answer = (cardInstanceIds: string[]): Action => ({
    type: 'ResolvePendingPrompt',
    payload: { playerIndex: 0, promptId: state.pendingPrompt!.promptId, cardInstanceIds },
  });

  apply({ type: 'EndPhase', payload: { playerIndex: 0 } });
  apply({ type: 'EndPhase', payload: { playerIndex: 0 } });
  apply({
    type: 'ActivateEffect',
    payload: { playerIndex: 0, cardInstanceId: inHand('SMP-116'), effectId: 'merging-crucible' },
  });
  expect(state.pendingPrompt?.kind).toBe('SelectFusionMonster');
  apply(answer(['p0-x0']));
  expect(state.pendingPrompt?.kind).toBe('SelectFusionMaterials');
  apply(answer([inHand('SMP-001'), inHand('SMP-007')]));
  expect(state.players[0].board.monsterZones[0]?.definitionId).toBe('SMP-045');
  return steps;
}

describe('Fusion on the api side (task 4.5): engine-only, nothing leaks to the opponent', () => {
  it('the real cards fuse: SMP-116 Fusion Summons SMP-045 from SMP-001 + SMP-007', () => {
    const steps = fuse();
    const last = steps.at(-1)!;
    expect(last.events.map((e) => e.type)).toEqual([
      'FusionMaterialSent',
      'FusionMaterialSent',
      'MonsterFusionSummoned',
      'EffectResolved',
      'CardSentToGraveyard',
      'ChainResolved',
    ]);
    expect(last.state.players[0].extraDeck.map((c) => c.instanceId)).toEqual(['p0-x1', 'p0-x2']);
    expect(last.state.players[0].graveyard.map((c) => c.definitionId)).toEqual([
      'SMP-001',
      'SMP-007',
      'SMP-116',
    ]);
  });

  it('the opponent passes the leak oracle at every step and only ever sees the size of the Extra Deck', () => {
    for (const [i, step] of fuse().entries()) {
      const payload = payloadFor(step, 1);
      expect(findLeaks(step.state, 1, payload), `step ${i}`).toEqual([]);
      const json = JSON.stringify(payload);
      // No Extra Deck card is named or pointed at while it is still in the Extra Deck.
      for (const c of step.state.players[0].extraDeck) {
        expect(json.includes(`"${c.instanceId}"`), `step ${i}: ${c.instanceId}`).toBe(false);
      }
      const view = toStateView(step.state, 1, defs);
      expect(view.players[0].extraDeckCount).toBe(step.state.players[0].extraDeck.length);
      expect(JSON.stringify(view).includes('"extraDeck"')).toBe(false);
    }
  });

  it('the opponent gets the Fusion prompts without their payload (which monster / materials are being chosen)', () => {
    const prompts = fuse()
      .map((s) => toStateView(s.state, 1, defs).pendingPrompt)
      .filter((p) => p !== null);
    expect(prompts.map((p) => p.kind)).toEqual(['SelectFusionMonster', 'SelectFusionMaterials']);
    for (const p of prompts) expect(p.payload).toBeNull();
  });

  it('the two Fusion events are dropped for both seats (wired in task 4.5b)', () => {
    const last = fuse().at(-1)!;
    for (const viewer of [0, 1] as const) {
      const hidden = hiddenIdsFor(last.state, viewer);
      const seen = last.events.flatMap((e) => {
        const view = toEventView(e, viewer, hidden);
        return view === null ? [] : [view.type];
      });
      expect(seen).toEqual(['EffectResolved', 'CardSentToGraveyard', 'ChainResolved']);
    }
  });

  it('open for task 4.5b: the OWNER is pointed at their own Extra Deck (prompt + legalActions), which the oracle flags', () => {
    const steps = fuse();
    const asked = steps.find((s) => s.state.pendingPrompt?.kind === 'SelectFusionMonster')!;
    const leaks = findLeaks(asked.state, 0, payloadFor(asked, 0));
    expect(leaks.length).toBeGreaterThan(0);
    // Only pointers at the owner's own Extra Deck — no card identity, nothing about the opponent.
    for (const leak of leaks) {
      expect(leak.reason).toBe('an id list points at a card hidden from the viewer');
      expect(leak.instanceId).toMatch(/^p0-x\d+$/);
    }
    // Before and after the prompts the owner's payload is clean.
    expect(findLeaks(steps[0]!.state, 0, payloadFor(steps[0]!, 0))).toEqual([]);
    const last = steps.at(-1)!;
    expect(findLeaks(last.state, 0, payloadFor(last, 0))).toEqual([]);
  });
});
