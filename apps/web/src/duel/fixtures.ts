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
  readonly spellTraps?: Five<CardView | null>;
  readonly normalSummonUsed?: boolean;
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
      spellTrapZones: p.spellTraps ?? emptyFive,
      fieldZone: null,
    },
    hasNormalSummonedThisTurn: p.normalSummonUsed ?? false,
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

// ---- Interaction fixtures (task 2.8). `legalActions` is written by hand the way the server lists it. ----

type Payload<T extends PlayerAction['type']> = Extract<PlayerAction, { type: T }>['payload'];
const summonsFor = (
  cardInstanceId: string,
  options: readonly { zoneIndex: number; tributes?: readonly string[] }[],
): PlayerAction[] =>
  options.flatMap(({ zoneIndex, tributes }): PlayerAction[] => {
    const payload: Payload<'NormalSummon'> = {
      playerIndex: 0,
      cardInstanceId,
      zoneIndex,
      ...(tributes ? { tributeInstanceIds: [...tributes] } : {}),
    };
    return [
      { type: 'NormalSummon', payload },
      { type: 'SetMonster', payload: { ...payload } },
    ];
  });
const attackFrom = (
  attackerInstanceId: string,
  targets: readonly (string | null)[],
): PlayerAction[] =>
  targets.map((t): PlayerAction => ({
    type: 'DeclareAttack',
    payload: {
      playerIndex: 0,
      attackerInstanceId,
      ...(t === null ? {} : { targetInstanceId: t }),
    },
  }));
const toDefense = (cardInstanceId: string): PlayerAction => ({
  type: 'ChangePosition',
  payload: { playerIndex: 0, cardInstanceId, toPosition: 'DefenseUp' },
});

function summonChoice(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [
      up('p0-1', 'SMP-006', 0, null),
      up('p0-2', 'SMP-101', 0, null),
      up('p0-3', 'SMP-007', 0, null),
    ],
    deckCount: 30,
    monsters: five<CardView>([[2, up('p0-10', 'SMP-001', 0, 'Attack')]]),
  });
  const opp = player({
    playerId: 'fixture-ai',
    lifePoints: 8000,
    hand: [1, 2, 3, 4, 5].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 30,
    monsters: five<CardView>([[1, hidden('p1-11', 1)]]),
  });
  const free = [0, 1, 3, 4].map((zoneIndex) => ({ zoneIndex }));
  return {
    view: view({ turnCount: 3, turnPlayerIndex: 0, phase: 'Main1' }, self, opp),
    legalActions: [
      ...summonsFor('p0-1', free),
      ...summonsFor('p0-3', free),
      toDefense('p0-10'),
      endPhase,
      surrender,
    ],
  };
}

function tribute(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [up('p0-1', 'SMP-002', 0, null), up('p0-2', 'SMP-101', 0, null)],
    deckCount: 30,
    monsters: five<CardView>([
      [1, up('p0-10', 'SMP-001', 0, 'Attack')],
      [3, up('p0-11', 'SMP-005', 0, 'Attack')],
    ]),
  });
  const opp = player({
    playerId: 'fixture-ai',
    lifePoints: 8000,
    hand: [1, 2, 3, 4, 5].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 30,
  });
  // Level 6 needs 1 tribute. Empty zones take either tribute; a tribute's own zone is free again once it is gone.
  const options = [
    ...[0, 2, 4].flatMap((zoneIndex) =>
      ['p0-10', 'p0-11'].map((t) => ({ zoneIndex, tributes: [t] })),
    ),
    { zoneIndex: 1, tributes: ['p0-10'] },
    { zoneIndex: 3, tributes: ['p0-11'] },
  ];
  return {
    view: view({ turnCount: 5, turnPlayerIndex: 0, phase: 'Main1' }, self, opp),
    legalActions: [
      ...summonsFor('p0-1', options),
      toDefense('p0-10'),
      toDefense('p0-11'),
      endPhase,
      surrender,
    ],
  };
}

/**
 * Main1 with Spell/Trap: SMP-101 (Normal Spell, Draw 1: may be activated or Set) and SMP-201 (Trap: Set only) in hand,
 * one own Set Trap in zone 0, one opponent Set card (hidden) in zone 1.
 */
function spellFixture(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [
      up('p0-1', 'SMP-006', 0, null),
      up('p0-2', 'SMP-101', 0, null),
      up('p0-4', 'SMP-201', 0, null),
    ],
    deckCount: 30,
    spellTraps: five<CardView>([[0, up('p0-20', 'SMP-201', 0, 'DefenseDown')]]),
  });
  const opp = player({
    playerId: 'fixture-ai',
    lifePoints: 8000,
    hand: [1, 2, 3, 4].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 30,
    monsters: five<CardView>([[2, up('p1-11', 'SMP-004', 1, 'Attack')]]),
    spellTraps: five<CardView>([[1, hidden('p1-21', 1)]]),
  });
  const freeSpellZones = [1, 2, 3, 4];
  const setSpell = (cardInstanceId: string): PlayerAction[] =>
    freeSpellZones.map((zoneIndex) => ({
      type: 'SetSpellTrap',
      payload: { playerIndex: 0, cardInstanceId, zoneIndex },
    }));
  return {
    view: view({ turnCount: 3, turnPlayerIndex: 0, phase: 'Main1' }, self, opp),
    legalActions: [
      ...summonsFor(
        'p0-1',
        [0, 1, 2, 3, 4].map((zoneIndex) => ({ zoneIndex })),
      ),
      ...setSpell('p0-2'),
      ...setSpell('p0-4'),
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-2', effectId: 'draw-one' },
      },
      endPhase,
      surrender,
    ],
  };
}

/**
 * A `SelectEffectTarget` prompt for viewer 0 (no real sample card opens one yet: this is what a "destroy 1 monster"
 * Spell would look like): two opposing monsters are candidates, one of them face-down.
 */
function effectTarget(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [up('p0-1', 'SMP-006', 0, null), up('p0-2', 'SMP-101', 0, null)],
    deckCount: 30,
  });
  const opp = player({
    playerId: 'fixture-ai',
    lifePoints: 8000,
    hand: [1, 2, 3].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 30,
    monsters: five<CardView>([
      [1, up('p1-11', 'SMP-004', 1, 'Attack')],
      [3, hidden('p1-12', 1)],
    ]),
  });
  const promptId = 'effect-3-7';
  return {
    view: view(
      {
        turnCount: 3,
        turnPlayerIndex: 0,
        phase: 'Main1',
        pendingPrompt: {
          promptId,
          playerIndex: 0,
          kind: 'SelectEffectTarget',
          payload: {
            cardInstanceId: 'p0-2',
            effectId: 'e1',
            costInstanceIds: [],
            candidateInstanceIds: ['p1-11', 'p1-12'],
            count: 1,
          },
        },
      },
      self,
      opp,
    ),
    legalActions: [
      ...['p1-11', 'p1-12'].map((id): PlayerAction => ({
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId, cardInstanceIds: [id] },
      })),
      surrender,
    ],
  };
}

function attackFixture(direct: boolean): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [up('p0-1', 'SMP-006', 0, null)],
    deckCount: 30,
    normalSummonUsed: true,
    monsters: five<CardView>([
      [1, up('p0-10', 'SMP-003', 0, 'Attack')],
      [3, up('p0-11', 'SMP-001', 0, 'Attack')],
    ]),
  });
  const opp = player({
    playerId: 'fixture-ai',
    lifePoints: 8000,
    hand: [1, 2, 3, 4].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 30,
    ...(direct
      ? {}
      : {
          monsters: five<CardView>([
            [0, up('p1-10', 'SMP-009', 1, 'Attack')],
            [2, hidden('p1-11', 1)],
            [4, up('p1-12', 'SMP-010', 1, 'DefenseUp')],
          ]),
        }),
  });
  const targets = direct ? [null] : ['p1-10', 'p1-11', 'p1-12'];
  return {
    view: view({ turnCount: 4, turnPlayerIndex: 0, phase: 'Battle' }, self, opp),
    legalActions: [
      ...attackFrom('p0-10', targets),
      ...attackFrom('p0-11', targets),
      endPhase,
      surrender,
    ],
  };
}

/** Normal Summon already used and every zone taken: no hand card can go anywhere; only a position change is legal. */
function dragIllegal(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [up('p0-1', 'SMP-006', 0, null), up('p0-2', 'SMP-101', 0, null)],
    deckCount: 30,
    normalSummonUsed: true,
    monsters: five<CardView>([
      [0, up('p0-10', 'SMP-001', 0, 'Attack')],
      [1, up('p0-11', 'SMP-005', 0, 'Attack')],
      [2, up('p0-12', 'SMP-007', 0, 'Attack')],
      [3, up('p0-13', 'SMP-004', 0, 'DefenseUp')],
      // SMP-011..013 are reserved as "secret" cards by the leak tests: no fixture may show them.
      [4, up('p0-14', 'SMP-014', 0, 'Attack')],
    ]),
  });
  const opp = player({
    playerId: 'fixture-ai',
    lifePoints: 8000,
    hand: [1, 2, 3, 4, 5].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 30,
  });
  return {
    view: view({ turnCount: 6, turnPlayerIndex: 0, phase: 'Main1' }, self, opp),
    legalActions: [toDefense('p0-10'), endPhase, surrender],
  };
}

export function loadFixture(name: FixtureName): Fixture {
  switch (name) {
    case 'summon-choice':
      return summonChoice();
    case 'tribute':
      return tribute();
    case 'attack':
      return attackFixture(false);
    case 'attack-direct':
      return attackFixture(true);
    case 'drag-illegal':
      return dragIllegal();
    case 'midgame':
      return midgame();
    case 'handfull':
      return handfull();
    case 'gameover':
      return gameover();
    case 'spell':
      return spellFixture();
    case 'effect-target':
      return effectTarget();
  }
}
