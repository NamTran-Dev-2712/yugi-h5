import type { CardDrawnEvent, GameEvent } from '@yugi/game-engine';
import type { EventView } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { toEventView, toEventViews } from './event-view';

const SECRET = 'SECRET-CARD';

/** Task 3.2 events: classified but NOT forwarded yet (shared `EventView` + web support arrive in task 3.2b). */
const NOT_FORWARDED_TYPES = [
  'SpellTrapSet',
  'EffectActivated',
  'EffectResolved',
  'CardSentToGraveyard',
  'LifePointsRecovered',
  'LifePointsPaid',
  'SpellTrapDestroyed',
] as const satisfies readonly GameEvent['type'][];
type NotForwarded = Extract<GameEvent, { type: (typeof NOT_FORWARDED_TYPES)[number] }>;

type PublicEvent = Exclude<GameEvent, CardDrawnEvent | NotForwarded>;

/** One fixture per GameEvent type: adding a type to the engine makes this Record fail to typecheck. */
const FIXTURES: { [T in GameEvent['type']]: Extract<GameEvent, { type: T }> } = {
  DuelStarted: { type: 'DuelStarted', matchId: 'm', turnPlayerIndex: 0 },
  CardDrawn: { type: 'CardDrawn', playerIndex: 0, instanceId: 'p0-1', definitionId: SECRET },
  DeckOut: { type: 'DeckOut', playerIndex: 1 },
  CardDiscarded: {
    type: 'CardDiscarded',
    playerIndex: 0,
    instanceId: 'p0-2',
    definitionId: SECRET,
  },
  PhaseChanged: { type: 'PhaseChanged', from: 'Main1', to: 'Battle', turnPlayerIndex: 0 },
  TurnChanged: { type: 'TurnChanged', turnCount: 2, turnPlayerIndex: 1 },
  NormalSummoned: {
    type: 'NormalSummoned',
    playerIndex: 0,
    instanceId: 'p0-3',
    definitionId: SECRET,
    zoneIndex: 1,
  },
  MonsterSet: { type: 'MonsterSet', playerIndex: 0, instanceId: 'p0-4', zoneIndex: 2 },
  MonsterTributed: {
    type: 'MonsterTributed',
    ownerIndex: 0,
    instanceId: 'p0-5',
    definitionId: SECRET,
    zoneIndex: 0,
  },
  PositionChanged: {
    type: 'PositionChanged',
    playerIndex: 0,
    instanceId: 'p0-6',
    definitionId: SECRET,
    zoneIndex: 0,
    from: 'Attack',
    to: 'DefenseUp',
  },
  AttackDeclared: {
    type: 'AttackDeclared',
    playerIndex: 0,
    attackerInstanceId: 'p0-7',
    targetInstanceId: 'p1-1',
  },
  MonsterFlipped: {
    type: 'MonsterFlipped',
    ownerIndex: 1,
    instanceId: 'p1-2',
    definitionId: SECRET,
    zoneIndex: 3,
  },
  MonsterDestroyed: {
    type: 'MonsterDestroyed',
    ownerIndex: 1,
    instanceId: 'p1-3',
    definitionId: SECRET,
    zoneIndex: 3,
  },
  DamageDealt: { type: 'DamageDealt', playerIndex: 1, amount: 500 },
  SpellTrapSet: { type: 'SpellTrapSet', playerIndex: 0, instanceId: 'p0-8', zoneIndex: 1 },
  EffectActivated: {
    type: 'EffectActivated',
    playerIndex: 0,
    instanceId: 'p0-9',
    definitionId: SECRET,
    effectId: 'e1',
  },
  EffectResolved: {
    type: 'EffectResolved',
    playerIndex: 0,
    instanceId: 'p0-9',
    definitionId: SECRET,
    effectId: 'e1',
  },
  CardSentToGraveyard: {
    type: 'CardSentToGraveyard',
    ownerIndex: 0,
    instanceId: 'p0-9',
    definitionId: SECRET,
    from: 'Hand',
  },
  LifePointsRecovered: { type: 'LifePointsRecovered', playerIndex: 0, amount: 300 },
  LifePointsPaid: { type: 'LifePointsPaid', playerIndex: 0, amount: 500 },
  SpellTrapDestroyed: {
    type: 'SpellTrapDestroyed',
    ownerIndex: 1,
    instanceId: 'p1-4',
    definitionId: SECRET,
    zoneIndex: 2,
  },
  DuelEnded: { type: 'DuelEnded', winnerIndex: 0, reason: 'LP_ZERO' },
};

/** Compile-time check: every non-CardDrawn engine event is assignable to the EventView union unchanged. */
const asView = (e: PublicEvent): EventView => e;

const PUBLIC_TYPES = (Object.keys(FIXTURES) as GameEvent['type'][]).filter(
  (t) => t !== 'CardDrawn' && !(NOT_FORWARDED_TYPES as readonly string[]).includes(t),
);

describe('toEventView', () => {
  it('covers every engine event type', () => {
    expect(Object.keys(FIXTURES)).toHaveLength(22);
  });

  it.each(PUBLIC_TYPES)('passes public event %s through unchanged to both viewers', (type) => {
    const event = FIXTURES[type] as PublicEvent;
    for (const viewer of [0, 1] as const) {
      expect(toEventView(event, viewer)).toEqual(asView(event));
    }
  });

  it.each(NOT_FORWARDED_TYPES)('does not forward %s yet (deny until 3.2b wires it)', (type) => {
    for (const viewer of [0, 1] as const) {
      expect(toEventView(FIXTURES[type], viewer)).toBeNull();
    }
  });

  it('shows CardDrawn in full to the drawer', () => {
    expect(toEventView(FIXTURES.CardDrawn, 0)).toEqual({
      type: 'CardDrawn',
      playerIndex: 0,
      card: {
        hidden: false,
        instanceId: 'p0-1',
        definitionId: SECRET,
        position: null,
        ownerIndex: 0,
      },
    });
  });

  it('shows CardDrawn as a hidden card to the opponent, without the definitionId', () => {
    const view = toEventView(FIXTURES.CardDrawn, 1);
    expect(view).toEqual({
      type: 'CardDrawn',
      playerIndex: 0,
      card: { hidden: true, instanceId: 'p0-1', ownerIndex: 0 },
    });
    expect(JSON.stringify(view)).not.toContain(SECRET);
    expect(JSON.stringify(toEventView(FIXTURES.CardDrawn, 0))).toContain(SECRET);
  });

  it('draws for player 1 are symmetric', () => {
    const drawn: GameEvent = { ...FIXTURES.CardDrawn, playerIndex: 1, instanceId: 'p1-9' };
    expect(JSON.stringify(toEventView(drawn, 0))).not.toContain(SECRET);
    expect(JSON.stringify(toEventView(drawn, 1))).toContain(SECRET);
  });

  it('never leaks a definitionId through the face-down Set event', () => {
    const set = FIXTURES.MonsterSet;
    for (const viewer of [0, 1] as const) {
      expect(JSON.stringify(toEventView(set, viewer))).not.toContain('definitionId');
    }
  });

  it('denies by default: an unclassified event type yields null', () => {
    const unknown = { type: 'FutureEvent', definitionId: SECRET } as unknown as GameEvent;
    expect(toEventView(unknown, 0)).toBeNull();
    expect(toEventView(unknown, 1)).toBeNull();
  });

  it('toEventViews keeps order and drops hidden events', () => {
    const unknown = { type: 'FutureEvent' } as unknown as GameEvent;
    const events: GameEvent[] = [
      FIXTURES.PhaseChanged,
      unknown,
      FIXTURES.CardDrawn,
      FIXTURES.DamageDealt,
    ];
    const views = toEventViews(events, 1);
    expect(views.map((v) => v.type)).toEqual(['PhaseChanged', 'CardDrawn', 'DamageDealt']);
    expect(JSON.stringify(views)).not.toContain(SECRET);
  });
});
