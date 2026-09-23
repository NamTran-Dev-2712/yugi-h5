import { describe, expect, it } from 'vitest';
import { applyAction } from '../../apply-action.js';
import type { GameState, Phase } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import type {
  Action,
  ActionContext,
  EndPhaseAction,
  ResolvePendingPromptAction,
} from '../types.js';

const ctx: ActionContext = { cardDefinitions: () => undefined };

/** Turn 2, player 1 to act, in `phase`, holding exactly `handSize` cards. */
function duel(handSize: number, phase: Phase = 'Main2', handLimit?: number): GameState {
  const started = applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed: 'seed-hand-limit',
      playerIds: ['alice', 'bob'],
      deckLists: [
        Array.from({ length: 40 }, (_, i) => `A-${i}`),
        Array.from({ length: 40 }, (_, i) => `B-${i}`),
      ],
      ...(handLimit === undefined ? {} : { ruleset: { handLimit } }),
    },
  }).state;
  const drawn = applyAction(started, {
    type: 'Draw',
    payload: { playerIndex: 1, count: handSize - started.players[1].hand.length },
  }).state;
  return { ...drawn, turnCount: 2, turnPlayerIndex: 1, phase };
}

const endPhase = (playerIndex: 0 | 1 = 1): EndPhaseAction => ({
  type: 'EndPhase',
  payload: { playerIndex },
});

const resolve = (
  cardInstanceIds: string[],
  overrides: Partial<ResolvePendingPromptAction['payload']> = {},
): ResolvePendingPromptAction => ({
  type: 'ResolvePendingPrompt',
  payload: { playerIndex: 1, promptId: 'discard-2', cardInstanceIds, ...overrides },
});

const handIds = (s: GameState) => s.players[1].hand.map((c) => c.instanceId);

/** Hand `handSize` → EndPhase on Main2 → prompt open (discard handSize - 6). */
function prompted(handSize = 7): GameState {
  return applyAction(duel(handSize), endPhase()).state;
}

describe('Hand limit / opening the prompt', () => {
  it('hand <= limit advances Main2 → End with no prompt', () => {
    for (const size of [5, 6]) {
      const { state, events } = applyAction(duel(size), endPhase());
      expect(state.phase).toBe('End');
      expect(state.pendingPrompt).toBeNull();
      expect(events.map((e) => e.type)).toEqual(['PhaseChanged']);
    }
  });

  it.each([
    [7, 1],
    [9, 3],
  ])('hand %i → prompt to discard %i, phase stays Main2', (size, count) => {
    const before = duel(size);
    const { state, events } = applyAction(before, endPhase());
    expect(state.phase).toBe('Main2');
    expect(state.pendingPrompt).toEqual({
      promptId: 'discard-2',
      playerIndex: 1,
      kind: 'DiscardToHandLimit',
      payload: { count },
    });
    expect(state.version).toBe(before.version + 1);
    expect(state.players[1].hand).toHaveLength(size);
    expect(events).toEqual([]);
  });

  it('reads ruleset.handLimit, not a hard-coded 6', () => {
    const { state } = applyAction(duel(6, 'Main2', 5), endPhase());
    expect(state.pendingPrompt).toMatchObject({ payload: { count: 1 } });
    const ok = applyAction(duel(7, 'Main2', 8), endPhase());
    expect(ok.state.phase).toBe('End');
  });

  it.each<Phase>(['Standby', 'Main1', 'Battle'])('is not checked when leaving %s', (phase) => {
    const { state } = applyAction(duel(8, phase), endPhase());
    expect(state.pendingPrompt).toBeNull();
  });

  it('is not checked when leaving End (turn passes)', () => {
    const { state } = applyAction(duel(8, 'End'), endPhase());
    expect(state.pendingPrompt).toBeNull();
    expect(state.turnCount).toBe(3);
  });
});

describe('Hand limit / resolving the prompt', () => {
  it('discards the chosen card to the graveyard and moves on to End', () => {
    const open = prompted();
    const ids = handIds(open);
    const chosen = ids[3] as string;
    const gy = open.players[1].graveyard.length;

    const { state, events } = applyAction(open, resolve([chosen]));

    expect(state.players[1].hand).toHaveLength(6);
    expect(handIds(state)).toEqual(ids.filter((id) => id !== chosen));
    expect(state.players[1].graveyard).toHaveLength(gy + 1);
    expect(state.players[1].graveyard.at(-1)).toMatchObject({
      instanceId: chosen,
      position: null,
      ownerIndex: 1,
    });
    expect(state.pendingPrompt).toBeNull();
    expect(state.phase).toBe('End');
    expect(state.version).toBe(open.version + 1);
    expect(events).toEqual([
      {
        type: 'CardDiscarded',
        playerIndex: 1,
        instanceId: chosen,
        definitionId: open.players[1].hand[3]?.definitionId,
      },
      { type: 'PhaseChanged', from: 'Main2', to: 'End', turnPlayerIndex: 1 },
    ]);
  });

  it('discards several cards in the chosen order', () => {
    const open = prompted(9);
    const ids = handIds(open);
    const chosen = [ids[6], ids[0], ids[2]] as string[];
    const { state, events } = applyAction(open, resolve(chosen));
    expect(state.players[1].hand).toHaveLength(6);
    const discarded = events.flatMap((e) => (e.type === 'CardDiscarded' ? [e.instanceId] : []));
    expect(discarded).toEqual(chosen);
  });

  it('does not touch the opponent, the board or the deck', () => {
    const open = prompted();
    const { state } = applyAction(open, resolve([handIds(open)[0] as string]));
    expect(state.players[0]).toEqual(open.players[0]);
    expect(state.players[1].board).toEqual(open.players[1].board);
    expect(state.players[1].deck).toEqual(open.players[1].deck);
  });

  it('the turn then ends normally', () => {
    const open = prompted();
    const { state: atEnd } = applyAction(open, resolve([handIds(open)[0] as string]));
    const { state } = applyAction(atEnd, endPhase());
    expect(state.turnCount).toBe(3);
    expect(state.turnPlayerIndex).toBe(0);
  });

  describe('rejections (state untouched)', () => {
    const open = () => deepFreeze(prompted(8)); // must discard 2

    it('NO_PENDING_PROMPT when nothing is pending', () => {
      expectEngineError(() => applyAction(duel(7), resolve(['x'])), 'NO_PENDING_PROMPT');
    });

    it('PROMPT_MISMATCH for a wrong promptId', () => {
      const s = open();
      expectEngineError(
        () => applyAction(s, resolve(handIds(s).slice(0, 2), { promptId: 'nope' })),
        'PROMPT_MISMATCH',
      );
    });

    it('PROMPT_MISMATCH for the wrong player', () => {
      const s = open();
      expectEngineError(
        () => applyAction(s, resolve(handIds(s).slice(0, 2), { playerIndex: 0 })),
        'PROMPT_MISMATCH',
      );
    });

    it.each([0, 1, 3])('INVALID_DISCARD for %i cards when 2 are required', (n) => {
      const s = open();
      expectEngineError(() => applyAction(s, resolve(handIds(s).slice(0, n))), 'INVALID_DISCARD');
    });

    it('INVALID_DISCARD for duplicate ids', () => {
      const s = open();
      const id = handIds(s)[0] as string;
      expectEngineError(() => applyAction(s, resolve([id, id])), 'INVALID_DISCARD');
    });

    it('INVALID_DISCARD for a card not in hand / an opponent card', () => {
      const s = open();
      const a = handIds(s)[0] as string;
      expectEngineError(() => applyAction(s, resolve([a, 'ghost'])), 'INVALID_DISCARD');
      const theirs = s.players[0].hand[0]?.instanceId as string;
      expectEngineError(() => applyAction(s, resolve([a, theirs])), 'INVALID_DISCARD');
    });

    it('DUEL_ENDED once the duel is over', () => {
      const s = { ...prompted(), winnerIndex: 0 as const };
      expectEngineError(() => applyAction(s, resolve([handIds(s)[0] as string])), 'DUEL_ENDED');
    });
  });
});

describe('Hand limit / PENDING_PROMPT guard while waiting', () => {
  const actions: [string, Action][] = [
    ['EndPhase', endPhase()],
    ['Draw', { type: 'Draw', payload: { playerIndex: 1, count: 1 } }],
    [
      'NormalSummon',
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'x', zoneIndex: 0 } },
    ],
    [
      'SetMonster',
      { type: 'SetMonster', payload: { playerIndex: 1, cardInstanceId: 'x', zoneIndex: 0 } },
    ],
    [
      'ChangePosition',
      {
        type: 'ChangePosition',
        payload: { playerIndex: 1, cardInstanceId: 'x', toPosition: 'Attack' },
      },
    ],
    [
      'DeclareAttack',
      { type: 'DeclareAttack', payload: { playerIndex: 1, attackerInstanceId: 'x' } },
    ],
  ];

  it.each(actions)('%s is rejected with PENDING_PROMPT', (_name, action) => {
    expectEngineError(() => applyAction(prompted(), action, ctx), 'PENDING_PROMPT');
  });

  it('Surrender is still allowed', () => {
    const { state } = applyAction(prompted(), { type: 'Surrender', payload: { playerIndex: 1 } });
    expect(state.winnerIndex).toBe(0);
  });
});

describe('Hand limit / purity', () => {
  it('does not mutate inputs and is deterministic', () => {
    const s = deepFreeze(duel(8));
    const a = applyAction(s, endPhase());
    const b = applyAction(s, endPhase());
    expect(a).toEqual(b);
    const open = deepFreeze(a.state);
    const r = applyAction(open, resolve(handIds(open).slice(0, 2)));
    expect(JSON.parse(JSON.stringify(r.state))).toEqual(r.state);
  });
});
