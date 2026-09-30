import type { CardDrawnEvent, GameEvent } from '@yugi/game-engine';
import type { EventView } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { toEventView, toEventViews } from './event-view';

const SECRET = 'SECRET-CARD';

/** Task 3.2 events, forwarded since task 3.2b (all PUBLIC, see docs/design/event-visibility.md). */
const SPELL_TRAP_TYPES = [
  'SpellTrapSet',
  'EffectActivated',
  'EffectResolved',
  'CardSentToGraveyard',
  'LifePointsRecovered',
  'LifePointsPaid',
  'SpellTrapDestroyed',
] as const satisfies readonly GameEvent['type'][];

/** Task 3.3 chain events: PUBLIC, forwarded since task 3.4b (the linked card was revealed by EffectActivated). */
const CHAIN_TYPES = [
  'ChainLinkAdded',
  'ChainLinkFizzled',
  'ChainResolved',
] as const satisfies readonly GameEvent['type'][];
/** Engine-only events (task 4.2+): classified but not forwarded until EventView has them (wire task). */
const ENGINE_ONLY_TYPES = [
  'MonsterSpecialSummoned',
  'FlipSummoned',
] as const satisfies readonly GameEvent['type'][];
type EngineOnlyType = (typeof ENGINE_ONLY_TYPES)[number];
type PublicEvent = Exclude<GameEvent, CardDrawnEvent | { type: EngineOnlyType }>;

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
  MonsterSpecialSummoned: {
    type: 'MonsterSpecialSummoned',
    playerIndex: 0,
    instanceId: 'p0-3',
    definitionId: SECRET,
    zoneIndex: 1,
    from: 'Graveyard',
    position: 'Attack',
  },
  FlipSummoned: {
    type: 'FlipSummoned',
    playerIndex: 0,
    instanceId: 'p0-4',
    definitionId: SECRET,
    zoneIndex: 2,
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
  ChainLinkAdded: {
    type: 'ChainLinkAdded',
    linkId: 'link-1-5',
    chainIndex: 1,
    playerIndex: 0,
    instanceId: 'p0-9',
    definitionId: SECRET,
    effectId: 'e1',
    spellSpeed: 1,
    targetInstanceIds: ['p1-3'],
  },
  ChainLinkFizzled: {
    type: 'ChainLinkFizzled',
    linkId: 'link-1-5',
    playerIndex: 0,
    instanceId: 'p0-9',
    definitionId: SECRET,
    effectId: 'e1',
    reason: 'TARGET_GONE',
  },
  ChainResolved: { type: 'ChainResolved', linkCount: 2 },
  DuelEnded: { type: 'DuelEnded', winnerIndex: 0, reason: 'LP_ZERO' },
};

/** Compile-time check: every non-CardDrawn engine event is assignable to the EventView union unchanged. */
const asView = (e: PublicEvent): EventView => e;

const PUBLIC_TYPES = (Object.keys(FIXTURES) as GameEvent['type'][]).filter(
  (t): t is PublicEvent['type'] =>
    t !== 'CardDrawn' && !(ENGINE_ONLY_TYPES as readonly string[]).includes(t),
);

describe('toEventView', () => {
  it('covers every engine event type', () => {
    expect(Object.keys(FIXTURES)).toHaveLength(27);
  });

  it.each(ENGINE_ONLY_TYPES)(
    'does not forward engine-only event %s yet (task 4.2 containment)',
    (type) => {
      for (const viewer of [0, 1] as const) expect(toEventView(FIXTURES[type], viewer)).toBeNull();
    },
  );

  it.each(CHAIN_TYPES)('forwards chain event %s unchanged to both viewers (task 3.4b)', (type) => {
    expect(PUBLIC_TYPES).toContain(type);
    for (const viewer of [0, 1] as const) {
      expect(toEventView(FIXTURES[type], viewer)).toEqual(FIXTURES[type]);
    }
  });

  it.each(PUBLIC_TYPES)('passes public event %s through unchanged to both viewers', (type) => {
    const event = FIXTURES[type] as PublicEvent;
    for (const viewer of [0, 1] as const) {
      expect(toEventView(event, viewer)).toEqual(asView(event));
    }
  });

  it('forwards every task 3.2 Spell/Trap event (none is dropped any more)', () => {
    for (const type of SPELL_TRAP_TYPES) {
      expect(PUBLIC_TYPES, type).toContain(type);
      expect(toEventView(FIXTURES[type], 1), type).not.toBeNull();
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

  it.each(['MonsterSet', 'SpellTrapSet'] as const)(
    'never leaks a definitionId through the face-down Set event %s',
    (type) => {
      for (const viewer of [0, 1] as const) {
        const view = toEventView(FIXTURES[type], viewer);
        expect(view).not.toBeNull();
        expect(JSON.stringify(view)).not.toContain('definitionId');
      }
    },
  );

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
