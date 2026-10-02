import {
  DEFAULT_RULESET,
  type CardDefinition,
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
  /** Task 4.3b: the card in the Field Zone. */
  readonly field?: CardView | null;
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
      fieldZone: p.field ?? null,
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
    chain?: StateView['chain'];
    chainWindow?: StateView['chainWindow'];
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
    chain: parts.chain ?? [],
    chainWindow: parts.chainWindow ?? null,
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

// ---- Chain fixtures (task 3.7). The card pool the server knows has no Set card with an effect yet, so these use
// test-only cards (FIX-*) that live here, in the dev-only fixture module, and never in SAMPLE_CARDS. ----

/** Test-only cards of the chain fixtures. Valid `CardDefinition`s (a test parses them), placeholder names. */
export const FIXTURE_CARDS: readonly CardDefinition[] = [
  {
    id: 'FIX-301',
    kind: 'Trap',
    subType: 'Normal',
    name: { vi: 'Bẫy Phản Kích (thử)', en: 'Counterstrike Snare (test)' },
    effectText: {
      vi: 'Phá huỷ 1 quái vật của đối thủ.',
      en: "Destroy 1 of your opponent's monsters.",
    },
    effects: [
      {
        id: 'destroy-one',
        trigger: { kind: 'Quick' },
        target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  {
    id: 'FIX-302',
    kind: 'Spell',
    subType: 'QuickPlay',
    name: { vi: 'Bùa Hồi Sinh Lực (thử)', en: 'Vital Charm (test)' },
    effectText: { vi: 'Hồi 1000 LP.', en: 'Gain 1000 LP.' },
    effects: [
      {
        id: 'heal',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Heal', amount: 1000, target: 'self' }],
      },
    ],
  },
  {
    id: 'FIX-303',
    kind: 'Monster',
    category: 'Effect',
    attribute: 'FIRE',
    race: 'Warrior',
    level: 4,
    atk: 1400,
    def: 1000,
    name: { vi: 'Kỵ Sĩ Mồi Lửa (thử)', en: 'Kindling Knight (test)' },
    effectText: {
      vi: 'Khi được Triệu hồi thường: bạn có thể phá huỷ 1 quái vật của đối thủ.',
      en: "When Normal Summoned: you can destroy 1 of your opponent's monsters.",
    },
    effects: [
      {
        id: 'summon-strike',
        trigger: { kind: 'OnSummon' },
        target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  {
    id: 'FIX-304',
    kind: 'Monster',
    category: 'Effect',
    attribute: 'LIGHT',
    race: 'Spellcaster',
    level: 4,
    atk: 1300,
    def: 1200,
    name: { vi: 'Hiền Giả Cờ Hiệu (thử)', en: 'Banner Sage (test)' },
    effectText: {
      vi: 'Quái vật khác của bạn +300 ATK. Quái vật của đối thủ -200 DEF.',
      en: "Your other monsters gain 300 ATK. Your opponent's monsters lose 200 DEF.",
    },
    effects: [
      {
        id: 'banner',
        trigger: { kind: 'Continuous' },
        operations: [
          { kind: 'ModifyStat', stat: 'atk', amount: 300, side: 'self', excludeSource: true },
          { kind: 'ModifyStat', stat: 'def', amount: -200, side: 'opponent' },
        ],
      },
    ],
  },
  {
    id: 'FIX-305',
    kind: 'Spell',
    subType: 'Normal',
    name: { vi: 'Mưa Than Hồng (thử)', en: 'Ember Rain (test)' },
    effectText: {
      vi: 'Gây 800 sát thương cho đối thủ.',
      en: 'Inflict 800 damage to your opponent.',
    },
    effects: [
      {
        id: 'burn',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'Damage', amount: 800, target: 'opponent' }],
      },
    ],
  },
];

const withStats = (card: CardView, atk: number, def: number): CardView =>
  card.hidden ? card : { ...card, effectiveStats: { atk, def } };

const activate = (cardInstanceId: string, effectId: string): PlayerAction => ({
  type: 'ActivateEffect',
  payload: { playerIndex: 0, cardInstanceId, effectId },
});
const pass: PlayerAction = { type: 'PassPriority', payload: { playerIndex: 0 } };

/** The AI (seat 1) declared an attack; my Trap can answer it: reaction window, I hold priority. */
function chainReaction(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [up('p0-1', 'SMP-006', 0, null), up('p0-2', 'SMP-201', 0, null)],
    deckCount: 28,
    monsters: five<CardView>([[2, withStats(up('p0-10', 'SMP-001', 0, 'Attack'), 1200, 800)]]),
    spellTraps: five<CardView>([
      [1, up('p0-30', 'FIX-301', 0, 'DefenseDown')],
      // No effect: Set but not activatable, so it is not outlined.
      [3, up('p0-31', 'SMP-201', 0, 'DefenseDown')],
    ]),
  });
  const opp = player({
    playerId: 'fixture-ai',
    lifePoints: 8000,
    hand: [1, 2, 3, 4].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 28,
    monsters: five<CardView>([[2, withStats(up('p1-10', 'SMP-009', 1, 'Attack'), 1700, 1000)]]),
    spellTraps: five<CardView>([[0, hidden('p1-30', 1)]]),
  });
  return {
    view: view(
      {
        turnCount: 6,
        turnPlayerIndex: 1,
        phase: 'Battle',
        chainWindow: {
          priorityPlayer: 0,
          passCount: 0,
          reactionTo: {
            kind: 'Attack',
            playerIndex: 1,
            attackerInstanceId: 'p1-10',
            targetInstanceId: 'p0-10',
          },
        },
      },
      self,
      opp,
    ),
    legalActions: [activate('p0-30', 'destroy-one'), pass, surrender],
  };
}

/** The AI activated a Spell (chain link 1); two of my Set cards can respond. Continuous ATK/DEF changes on the board. */
function chainRespond(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 5200,
    hand: [up('p0-1', 'SMP-007', 0, null)],
    deckCount: 25,
    monsters: five<CardView>([
      [1, withStats(up('p0-10', 'FIX-304', 0, 'Attack'), 1300, 1200)],
      [3, withStats(up('p0-11', 'SMP-006', 0, 'Attack'), 1800, 1100)],
    ]),
    spellTraps: five<CardView>([
      [0, up('p0-30', 'FIX-302', 0, 'DefenseDown')],
      [2, up('p0-31', 'FIX-301', 0, 'DefenseDown')],
    ]),
  });
  const opp = player({
    playerId: 'fixture-ai',
    lifePoints: 7000,
    hand: [1, 2, 3].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 26,
    monsters: five<CardView>([
      [1, withStats(up('p1-10', 'SMP-008', 1, 'Attack'), 1600, 700)],
      [3, withStats(up('p1-11', 'SMP-010', 1, 'DefenseUp'), 1000, 1000)],
    ]),
  });
  return {
    view: view(
      {
        turnCount: 7,
        turnPlayerIndex: 1,
        phase: 'Main1',
        chain: [
          {
            linkId: 'link-7-40',
            playerIndex: 1,
            card: {
              hidden: false,
              instanceId: 'p1-40',
              definitionId: 'FIX-305',
              ownerIndex: 1,
              position: null,
            },
            source: { zone: 'Hand' },
            effectId: 'burn',
            spellSpeed: 1,
            targetInstanceIds: [],
          },
        ],
        chainWindow: { priorityPlayer: 0, passCount: 0 },
      },
      self,
      opp,
    ),
    legalActions: [activate('p0-30', 'heal'), activate('p0-31', 'destroy-one'), pass, surrender],
  };
}

/** I just Normal Summoned FIX-303: its optional trigger asks me (Activate on a target, or decline). */
function triggerOptional(): Fixture {
  const promptId = 'trigger-5-9';
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [up('p0-1', 'SMP-005', 0, null), up('p0-2', 'SMP-101', 0, null)],
    deckCount: 29,
    normalSummonUsed: true,
    monsters: five<CardView>([[2, withStats(up('p0-12', 'FIX-303', 0, 'Attack'), 1400, 1000)]]),
  });
  const opp = player({
    playerId: 'fixture-ai',
    lifePoints: 8000,
    hand: [1, 2, 3, 4, 5].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 29,
    monsters: five<CardView>([
      [1, withStats(up('p1-10', 'SMP-009', 1, 'Attack'), 1700, 1000)],
      [3, withStats(up('p1-12', 'SMP-010', 1, 'DefenseUp'), 1000, 1200)],
    ]),
  });
  const answer = (cardInstanceIds: string[], decline?: boolean): PlayerAction => ({
    type: 'ResolvePendingPrompt',
    payload: { playerIndex: 0, promptId, cardInstanceIds, ...(decline ? { decline } : {}) },
  });
  return {
    view: view(
      {
        turnCount: 5,
        turnPlayerIndex: 0,
        phase: 'Main1',
        pendingPrompt: {
          promptId,
          playerIndex: 0,
          kind: 'TriggerActivation',
          payload: {
            trigger: {
              playerIndex: 0,
              instanceId: 'p0-12',
              definitionId: 'FIX-303',
              effectId: 'summon-strike',
              source: { zone: 'MonsterZone', zoneIndex: 2 },
            },
            optional: true,
            candidateInstanceIds: ['p1-10', 'p1-12'],
            count: 1,
            remaining: [],
            afterward: null,
          },
        },
      },
      self,
      opp,
    ),
    legalActions: [answer(['p1-10']), answer(['p1-12']), answer([], true), surrender],
  };
}

// ---- Task 4.2d: Flip Summon, Equip, Special Summon (real cards SMP-044 / SMP-111 / SMP-112) ----

const oppBasic = (extra: Partial<PlayerParts> = {}): PlayerView =>
  player({
    playerId: 'fixture-ai',
    lifePoints: 8000,
    hand: [1, 2, 3, 4].map((n) => hidden(`p1-h${n}`, 1)),
    deckCount: 30,
    ...extra,
  });

/** Main 1: my face-down SMP-044 (Set last turn) may be Flip Summoned; my face-up monster may change position. */
function flipFixture(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [up('p0-1', 'SMP-006', 0, null)],
    deckCount: 30,
    normalSummonUsed: true,
    monsters: five<CardView>([
      [0, withStats(up('p0-10', 'SMP-008', 0, 'Attack'), 1600, 900)],
      [1, up('p0-11', 'SMP-044', 0, 'DefenseDown')],
    ]),
  });
  const opp = oppBasic({
    monsters: five<CardView>([[2, withStats(up('p1-12', 'SMP-009', 1, 'Attack'), 1700, 1000)]]),
  });
  return {
    view: view({ turnCount: 5, turnPlayerIndex: 0, phase: 'Main1' }, self, opp),
    legalActions: [
      { type: 'FlipSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-11' } },
      toDefense('p0-10'),
      endPhase,
      surrender,
    ],
  };
}

/** A face-up SMP-112 in a Spell/Trap Zone, equipped to `to` (task 4.2d wire field). */
const equipCard = (instanceId: string, ownerIndex: PlayerIndex, to: string): CardView => ({
  hidden: false,
  instanceId,
  definitionId: 'SMP-112',
  ownerIndex,
  position: 'Attack',
  equippedTo: to,
});

/** SMP-112 equipped to my monster (+500 ATK) and another copy equipped to the opponent's monster. */
function equipFixture(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [up('p0-1', 'SMP-006', 0, null)],
    deckCount: 30,
    monsters: five<CardView>([[0, withStats(up('p0-10', 'SMP-001', 0, 'Attack'), 1700, 800)]]),
    spellTraps: five<CardView>([[2, equipCard('p0-20', 0, 'p0-10')]]),
  });
  const opp = oppBasic({
    monsters: five<CardView>([[3, withStats(up('p1-13', 'SMP-008', 1, 'Attack'), 2100, 900)]]),
    spellTraps: five<CardView>([
      [1, equipCard('p1-21', 1, 'p1-13')],
      [4, hidden('p1-24', 1)],
    ]),
  });
  return {
    view: view({ turnCount: 5, turnPlayerIndex: 0, phase: 'Main1' }, self, opp),
    legalActions: [endPhase, surrender],
  };
}

/** SMP-111 "call-from-grave" asks which of my graveyard monsters to Special Summon (the Spell is not a candidate). */
function gyTarget(): Fixture {
  const promptId = 'effect-5-7';
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [up('p0-1', 'SMP-111', 0, null), up('p0-2', 'SMP-044', 0, null)],
    deckCount: 30,
    graveyard: [
      up('p0-40', 'SMP-003', 0, null),
      up('p0-41', 'SMP-103', 0, null),
      up('p0-42', 'SMP-001', 0, null),
    ],
  });
  const opp = oppBasic({
    monsters: five<CardView>([[2, withStats(up('p1-12', 'SMP-009', 1, 'Attack'), 1700, 1000)]]),
  });
  const pick = (id: string): PlayerAction => ({
    type: 'ResolvePendingPrompt',
    payload: { playerIndex: 0, promptId, cardInstanceIds: [id] },
  });
  return {
    view: view(
      {
        turnCount: 5,
        turnPlayerIndex: 0,
        phase: 'Main1',
        pendingPrompt: {
          promptId,
          playerIndex: 0,
          kind: 'SelectEffectTarget',
          payload: {
            cardInstanceId: 'p0-1',
            effectId: 'call-from-grave',
            costInstanceIds: [],
            candidateInstanceIds: ['p0-40', 'p0-42'],
            count: 1,
          },
        },
      },
      self,
      opp,
    ),
    legalActions: [pick('p0-40'), pick('p0-42'), surrender],
  };
}

/** SMP-111 in hand has two effects (hand / graveyard) and may also be Set: dropping it offers one entry per effect. */
function specialSummonFixture(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [up('p0-1', 'SMP-111', 0, null), up('p0-2', 'SMP-044', 0, null)],
    deckCount: 30,
    graveyard: [up('p0-40', 'SMP-003', 0, null)],
  });
  return {
    view: view({ turnCount: 5, turnPlayerIndex: 0, phase: 'Main1' }, self, oppBasic()),
    legalActions: [
      activate('p0-1', 'call-from-hand'),
      activate('p0-1', 'call-from-grave'),
      ...[0, 1, 2, 3, 4].map((zoneIndex): PlayerAction => ({
        type: 'SetSpellTrap',
        payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex },
      })),
      endPhase,
      surrender,
    ],
  };
}

// ---- Task 4.3b: Field Zone + cards that stay on the field (real cards SMP-113 / SMP-114 / SMP-115 / SMP-208) ----

const setSpellAt = (cardInstanceId: string, zones: readonly number[]): PlayerAction[] =>
  zones.map((zoneIndex) => ({
    type: 'SetSpellTrap',
    payload: { playerIndex: 0, cardInstanceId, zoneIndex },
  }));

/**
 * Main 1, my Field Zone is empty: SMP-113 (Field Spell) in hand lists ONE Set (`zoneIndex` 0 = the Field Zone) and its
 * activation; SMP-114 (Continuous Spell) lists a Set per Spell/Trap Zone and its activation.
 */
function fieldFixture(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [
      up('p0-1', 'SMP-113', 0, null),
      up('p0-2', 'SMP-114', 0, null),
      up('p0-3', 'SMP-006', 0, null),
    ],
    deckCount: 30,
    normalSummonUsed: true,
    monsters: five<CardView>([[1, withStats(up('p0-10', 'SMP-008', 0, 'Attack'), 1600, 900)]]),
  });
  const opp = oppBasic({
    monsters: five<CardView>([[2, withStats(up('p1-12', 'SMP-030', 1, 'Attack'), 1700, 1000)]]),
  });
  return {
    view: view({ turnCount: 5, turnPlayerIndex: 0, phase: 'Main1' }, self, opp),
    legalActions: [
      ...setSpellAt('p0-1', [0]),
      activate('p0-1', 'activate'),
      ...setSpellAt('p0-2', [0, 1, 2, 3, 4]),
      activate('p0-2', 'activate'),
      endPhase,
      surrender,
    ],
  };
}

/**
 * My Field Spell is Set (face-down) in my Field Zone and may be activated (a tap, C13); my Set SMP-115 too (a Normal
 * Spell Set this very turn). A second SMP-113 in hand would replace the first. The opponent has a face-down Field card.
 */
function fieldSetFixture(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [up('p0-1', 'SMP-113', 0, null), up('p0-3', 'SMP-006', 0, null)],
    deckCount: 30,
    normalSummonUsed: true,
    monsters: five<CardView>([[1, withStats(up('p0-10', 'SMP-008', 0, 'Attack'), 1600, 900)]]),
    spellTraps: five<CardView>([[1, up('p0-31', 'SMP-115', 0, 'DefenseDown')]]),
    field: up('p0-30', 'SMP-113', 0, 'DefenseDown'),
  });
  const opp = oppBasic({
    monsters: five<CardView>([[2, withStats(up('p1-12', 'SMP-030', 1, 'Attack'), 1700, 1000)]]),
    field: hidden('p1-30', 1),
  });
  return {
    view: view({ turnCount: 5, turnPlayerIndex: 0, phase: 'Main1' }, self, opp),
    legalActions: [
      activate('p0-30', 'activate'),
      activate('p0-31', 'ember-burn'),
      ...setSpellAt('p0-1', [0]),
      activate('p0-1', 'activate'),
      endPhase,
      surrender,
    ],
  };
}

/**
 * Everything face-up and in force: my SMP-113 in the Field Zone (WIND +300, both sides), my SMP-114 (my Warriors +300)
 * and my SMP-208 (opponent −300) resting in Spell/Trap Zones; the opponent has its own face-up Field Spell. Nothing can
 * be activated again.
 */
function fieldActiveFixture(): Fixture {
  const self = player({
    playerId: 'fixture-you',
    lifePoints: 8000,
    hand: [up('p0-3', 'SMP-006', 0, null)],
    deckCount: 30,
    normalSummonUsed: true,
    monsters: five<CardView>([
      // SMP-008: WIND Warrior 1600 → +300 (mine) +300 (theirs) +300 (SMP-114) = 2500.
      [1, withStats(up('p0-10', 'SMP-008', 0, 'Attack'), 2500, 900)],
      // SMP-006: WATER Spellcaster 1500, untouched.
      [2, withStats(up('p0-11', 'SMP-006', 0, 'Attack'), 1500, 1100)],
    ]),
    spellTraps: five<CardView>([
      [0, up('p0-31', 'SMP-114', 0, 'Attack')],
      [2, up('p0-32', 'SMP-208', 0, 'Attack')],
      [4, up('p0-33', 'SMP-208', 0, 'DefenseDown')],
    ]),
    field: up('p0-30', 'SMP-113', 0, 'Attack'),
  });
  const opp = oppBasic({
    monsters: five<CardView>([
      // SMP-030: WIND 1700 +300 +300 −300 = 2000; SMP-009: DARK 1700 −300 = 1400.
      [2, withStats(up('p1-12', 'SMP-030', 1, 'Attack'), 2000, 1000)],
      [3, withStats(up('p1-13', 'SMP-009', 1, 'Attack'), 1400, 1000)],
    ]),
    spellTraps: five<CardView>([[1, hidden('p1-21', 1)]]),
    field: up('p1-30', 'SMP-113', 1, 'Attack'),
  });
  return {
    view: view({ turnCount: 6, turnPlayerIndex: 0, phase: 'Main1' }, self, opp),
    legalActions: [endPhase, surrender],
  };
}

export function loadFixture(name: FixtureName): Fixture {
  switch (name) {
    case 'field':
      return fieldFixture();
    case 'field-set':
      return fieldSetFixture();
    case 'field-active':
      return fieldActiveFixture();
    case 'flip':
      return flipFixture();
    case 'equip':
      return equipFixture();
    case 'gy-target':
      return gyTarget();
    case 'special-summon':
      return specialSummonFixture();
    case 'chain-reaction':
      return chainReaction();
    case 'chain-respond':
      return chainRespond();
    case 'trigger-optional':
      return triggerOptional();
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
