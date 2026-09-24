import {
  DEFAULT_RULESET,
  type CardView,
  type PlayerAction,
  type PlayerIndex,
  type PlayerView,
  type StateView,
  type ViewCardPosition,
  type ViewPhase,
} from '@yugi/shared';

/**
 * Fixed StateViews for looking at the duel screen without a server (`?fixture=<name>`, dev only). They are what the
 * server would send viewer 0: seat 1's hand and face-down cards are `hidden` (no definitionId anywhere).
 */

export interface Fixture {
  readonly view: StateView;
  readonly legalActions: readonly PlayerAction[];
}

import type { FixtureName } from './fixture-names';
export { FIXTURE_NAMES, isFixtureName, type FixtureName } from './fixture-names';

const up = (
  instanceId: string,
  definitionId: string,
  ownerIndex: PlayerIndex,
  position: ViewCardPosition | null,
): CardView => ({ hidden: false, instanceId, definitionId, ownerIndex, position });

const hidden = (instanceId: string, ownerIndex: PlayerIndex): CardView => ({
  hidden: true,
  instanceId,
  ownerIndex,
});

type Five<T> = readonly [T, T, T, T, T];
const five = <T>(cells: readonly (readonly [number, T])[]): Five<T | null> => {
  const out: (T | null)[] = [null, null, null, null, null];
  for (const [i, v] of cells) out[i] = v;
  return out as unknown as Five<T | null>;
};
const emptyFive = five<CardView>([]);

interface PlayerParts {
  readonly playerId: string;
  readonly lifePoints: number;
  readonly hand: readonly CardView[];
  readonly deckCount: number;
  readonly graveyard?: readonly CardView[];
  readonly monsters?: Five<CardView | null>;
}

function player(p: PlayerParts): PlayerView {
  const graveyard = (p.graveyard ?? []).filter(
    (c): c is Extract<CardView, { hidden: false }> => !c.hidden,
  );
  return {
    playerId: p.playerId,
    lifePoints: p.lifePoints,
    hand: p.hand,
    handCount: p.hand.length,
    deckCount: p.deckCount,
    extraDeckCount: 0,
    graveyard,
    banished: [],
    board: {
      monsterZones: p.monsters ?? emptyFive,
      spellTrapZones: emptyFive,
      fieldZone: null,
    },
    hasNormalSummonedThisTurn: false,
  };
}

function view(
  parts: {
    turnCount: number;
    turnPlayerIndex: PlayerIndex;
    phase: ViewPhase;
    winnerIndex?: StateView['winnerIndex'];
    pendingPrompt?: StateView['pendingPrompt'];
  },
  self: PlayerView,
  opp: PlayerView,
): StateView {
  return {
    matchId: 'fixture',
    version: 1,
    viewerIndex: 0,
    ruleset: DEFAULT_RULESET,
    turnCount: parts.turnCount,
    turnPlayerIndex: parts.turnPlayerIndex,
    phase: parts.phase,
    winnerIndex: parts.winnerIndex ?? null,
    pendingPrompt: parts.pendingPrompt ?? null,
    players: [self, opp],
  };
}

const endPhase: PlayerAction = { type: 'EndPhase', payload: { playerIndex: 0 } };
const surrender: PlayerAction = { type: 'Surrender', payload: { playerIndex: 0 } };

function midgame(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 6400,
    hand: [
      up('p0-1', 'SMP-004', 0, null),
      up('p0-2', 'SMP-101', 0, null),
      up('p0-3', 'SMP-006', 0, null),
      up('p0-4', 'SMP-201', 0, null),
    ],
    deckCount: 27,
    graveyard: [up('p0-20', 'SMP-005', 0, null), up('p0-21', 'SMP-007', 0, null)],
    monsters: five<CardView>([
      [1, up('p0-10', 'SMP-001', 0, 'Attack')],
      [2, up('p0-11', 'SMP-003', 0, 'DefenseDown')],
      [3, up('p0-12', 'SMP-002', 0, 'DefenseUp')],
    ]),
  });
  const opp = player({
    playerId: 'fixture-ai',
    lifePoints: 5200,
    hand: [1, 2, 3, 4, 5].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 24,
    graveyard: [up('p1-20', 'SMP-008', 1, null)],
    monsters: five<CardView>([
      [1, up('p1-10', 'SMP-009', 1, 'Attack')],
      [2, hidden('p1-11', 1)],
      [4, up('p1-12', 'SMP-010', 1, 'DefenseUp')],
    ]),
  });
  return {
    view: view({ turnCount: 4, turnPlayerIndex: 0, phase: 'Main1' }, self, opp),
    legalActions: [endPhase, surrender],
  };
}

function handfull(): Fixture {
  const ids = ['SMP-001', 'SMP-002', 'SMP-004', 'SMP-005', 'SMP-006', 'SMP-101', 'SMP-201'];
  const hand = ids.map((d, i) => up(`p0-${i + 1}`, d, 0, null));
  const self = player({ playerId: 'fixture-you', lifePoints: 8000, hand, deckCount: 30 });
  const opp = player({
    playerId: 'fixture-ai',
    lifePoints: 8000,
    hand: [1, 2, 3, 4, 5, 6].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 29,
  });
  const promptId = 'discard-5';
  return {
    view: view(
      {
        turnCount: 5,
        turnPlayerIndex: 0,
        phase: 'Main2',
        pendingPrompt: {
          promptId,
          playerIndex: 0,
          kind: 'DiscardToHandLimit',
          payload: { count: 1 },
        },
      },
      self,
      opp,
    ),
    legalActions: [
      ...hand.map((c): PlayerAction => ({
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId, cardInstanceIds: [c.instanceId] },
      })),
      surrender,
    ],
  };
}

function gameover(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 1300,
    hand: [up('p0-1', 'SMP-004', 0, null), up('p0-2', 'SMP-006', 0, null)],
    deckCount: 20,
    graveyard: [up('p0-20', 'SMP-005', 0, null)],
    monsters: five<CardView>([[2, up('p0-10', 'SMP-003', 0, 'Attack')]]),
  });
  const opp = player({
    playerId: 'fixture-ai',
    lifePoints: 0,
    hand: [1, 2, 3].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 18,
    graveyard: [up('p1-20', 'SMP-008', 1, null), up('p1-21', 'SMP-009', 1, null)],
  });
  return {
    view: view({ turnCount: 9, turnPlayerIndex: 0, phase: 'Battle', winnerIndex: 0 }, self, opp),
    legalActions: [],
  };
}

export function loadFixture(name: FixtureName): Fixture {
  switch (name) {
    case 'midgame':
      return midgame();
    case 'handfull':
      return handfull();
    case 'gameover':
      return gameover();
  }
}
