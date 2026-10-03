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
/** Task 4.2a/b/c events: PUBLIC (always face-up), forwarded since task 4.2d. */
const MECH_TYPES = [
  'MonsterSpecialSummoned',
  'FlipSummoned',
  'CardEquipped',
] as const satisfies readonly GameEvent['type'][];
/** Task 4.3 Field Zone events: PUBLIC, forwarded since task 4.3b (FieldSpellSet carries no definitionId). */
const FIELD_TYPES = [
  'FieldSpellSet',
  'FieldSpellDestroyed',
] as const satisfies readonly GameEvent['type'][];
/** Task 4.4 events (Counter Trap / Negate): PUBLIC, forwarded since task 4.4b (AttackNegated carries ids only). */
const NEGATE_TYPES = [
  'ChainLinkNegated',
  'AttackNegated',
  'SummonNegated',
] as const satisfies readonly GameEvent['type'][];
/** Task 4.5 events (Fusion): engine-only until task 4.5b — a type listed here must be dropped for both viewers. */
const ENGINE_ONLY_TYPES = [
  'FusionMaterialSent',
  'MonsterFusionSummoned',
] as const satisfies readonly GameEvent['type'][];
type EngineOnlyEvent = Extract<GameEvent, { type: (typeof ENGINE_ONLY_TYPES)[number] }>;
/** Every event but CardDrawn (and the engine-only ones) is forwarded with the engine shape. */
type PublicEvent = Exclude<GameEvent, CardDrawnEvent | EngineOnlyEvent>;
/** No id is hidden from the viewer (most tests); the ChainLinkAdded target filter has its own tests. */
const NONE: ReadonlySet<string> = new Set();

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
  CardEquipped: {
    type: 'CardEquipped',
    playerIndex: 0,
    instanceId: 'p0-9',
    definitionId: SECRET,
    targetInstanceId: 'p1-3',
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
  FieldSpellSet: { type: 'FieldSpellSet', playerIndex: 0, instanceId: 'p0-8' },
  FieldSpellDestroyed: {
    type: 'FieldSpellDestroyed',
    ownerIndex: 1,
    instanceId: 'p1-4',
    definitionId: SECRET,
  },
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
  ChainLinkNegated: {
    type: 'ChainLinkNegated',
    linkId: 'link-1-5',
    playerIndex: 0,
    instanceId: 'p0-9',
    definitionId: SECRET,
    effectId: 'e1',
    byInstanceId: 'p1-4',
  },
  AttackNegated: {
    type: 'AttackNegated',
    playerIndex: 0,
    attackerInstanceId: 'p0-3',
    targetInstanceId: null,
  },
  SummonNegated: {
    type: 'SummonNegated',
    playerIndex: 0,
    instanceId: 'p0-3',
    definitionId: SECRET,
    zoneIndex: 2,
  },
  FusionMaterialSent: {
    type: 'FusionMaterialSent',
    ownerIndex: 0,
    instanceId: 'p0-5',
    definitionId: SECRET,
    from: 'Hand',
  },
  MonsterFusionSummoned: {
    type: 'MonsterFusionSummoned',
    playerIndex: 0,
    instanceId: 'p0-x0',
    definitionId: SECRET,
    zoneIndex: 0,
    position: 'Attack',
    materialInstanceIds: ['p0-5', 'p0-6'],
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
    expect(Object.keys(FIXTURES)).toHaveLength(35);
  });

  it('the Fusion events are engine-only (task 4.5): dropped for both viewers; every other type but CardDrawn is public', () => {
    expect(ENGINE_ONLY_TYPES).toEqual(['FusionMaterialSent', 'MonsterFusionSummoned']);
    expect(PUBLIC_TYPES).toHaveLength(32);
    for (const type of ENGINE_ONLY_TYPES) {
      for (const viewer of [0, 1] as const) {
        expect(toEventView(FIXTURES[type], viewer, NONE)).toBeNull();
      }
    }
  });

  it.each(NEGATE_TYPES)(
    'forwards the Negate event %s unchanged to both viewers (task 4.4b)',
    (type) => {
      expect(PUBLIC_TYPES).toContain(type);
      for (const viewer of [0, 1] as const) {
        expect(toEventView(FIXTURES[type], viewer, NONE)).toEqual(FIXTURES[type]);
      }
      expect(toEventViews([FIXTURES.PhaseChanged, FIXTURES[type]], 1, NONE)).toEqual([
        FIXTURES.PhaseChanged,
        FIXTURES[type],
      ]);
    },
  );

  it('AttackNegated: ids only, for a direct attack and for an attack on a monster — never a definitionId (task 4.4b)', () => {
    const onMonster: GameEvent = { ...FIXTURES.AttackNegated, targetInstanceId: 'p1-1' };
    for (const viewer of [0, 1] as const) {
      for (const event of [FIXTURES.AttackNegated, onMonster]) {
        const view = toEventView(event, viewer, NONE);
        expect(view).toEqual(event);
        expect(JSON.stringify(view)).not.toContain('definitionId');
        expect(Object.keys(view ?? {}).sort()).toEqual([
          'attackerInstanceId',
          'playerIndex',
          'targetInstanceId',
          'type',
        ]);
      }
    }
  });

  it('the hidden set never drops or rewrites a Negate event (their cards are public by then) (task 4.4b)', () => {
    const hidden = new Set(['p0-9', 'p1-4', 'p0-3']);
    for (const type of NEGATE_TYPES) {
      expect(toEventView(FIXTURES[type], 1, hidden)).toEqual(FIXTURES[type]);
    }
  });

  it.each(FIELD_TYPES)(
    'forwards the Field Zone event %s unchanged to both viewers (task 4.3b)',
    (type) => {
      expect(PUBLIC_TYPES).toContain(type);
      for (const viewer of [0, 1] as const) {
        expect(toEventView(FIXTURES[type], viewer, NONE)).toEqual(FIXTURES[type]);
      }
      expect(toEventViews([FIXTURES.PhaseChanged, FIXTURES[type]], 1, NONE)).toEqual([
        FIXTURES.PhaseChanged,
        FIXTURES[type],
      ]);
    },
  );

  it('CardSentToGraveyard: forwarded from the hand, a Spell/Trap Zone and the Field Zone (task 4.3b)', () => {
    for (const viewer of [0, 1] as const) {
      for (const from of ['Hand', 'SpellTrapZone', 'FieldZone'] as const) {
        const event: GameEvent = { ...FIXTURES.CardSentToGraveyard, from };
        expect(toEventView(event, viewer, NONE)).toEqual(event);
      }
    }
  });

  it.each(MECH_TYPES)('forwards event %s unchanged to both viewers (task 4.2d)', (type) => {
    expect(PUBLIC_TYPES).toContain(type);
    for (const viewer of [0, 1] as const) {
      expect(toEventView(FIXTURES[type], viewer, NONE)).toEqual(FIXTURES[type]);
    }
  });

  it('ChainLinkAdded: drops the target ids hidden from the viewer, keeps the others in order (task 4.2d)', () => {
    const event: GameEvent = {
      ...FIXTURES.ChainLinkAdded,
      targetInstanceIds: ['p0-gy', 'p0-hand', 'p1-3'],
    };
    const hidden = new Set(['p0-hand']);
    expect(toEventView(event, 1, hidden)).toEqual({
      ...event,
      targetInstanceIds: ['p0-gy', 'p1-3'],
    });
    expect(toEventView(event, 0, NONE)).toEqual(event);
    expect(toEventViews([event], 1, hidden)[0]).toMatchObject({
      targetInstanceIds: ['p0-gy', 'p1-3'],
    });
  });

  it('the hidden set only filters target lists: other events are untouched even if they mention a hidden id', () => {
    const hidden = new Set(['p0-1', 'p0-9']);
    expect(toEventView(FIXTURES.ChainLinkFizzled, 1, hidden)).toEqual(FIXTURES.ChainLinkFizzled);
    expect(toEventView(FIXTURES.CardDiscarded, 1, hidden)).toEqual(FIXTURES.CardDiscarded);
  });

  it.each(CHAIN_TYPES)('forwards chain event %s unchanged to both viewers (task 3.4b)', (type) => {
    expect(PUBLIC_TYPES).toContain(type);
    for (const viewer of [0, 1] as const) {
      expect(toEventView(FIXTURES[type], viewer, NONE)).toEqual(FIXTURES[type]);
    }
  });

  it.each(PUBLIC_TYPES)('passes public event %s through unchanged to both viewers', (type) => {
    const event = FIXTURES[type] as PublicEvent;
    for (const viewer of [0, 1] as const) {
      expect(toEventView(event, viewer, NONE)).toEqual(asView(event));
    }
  });

  it('forwards every task 3.2 Spell/Trap event (none is dropped any more)', () => {
    for (const type of SPELL_TRAP_TYPES) {
      expect(PUBLIC_TYPES, type).toContain(type);
      expect(toEventView(FIXTURES[type], 1, NONE), type).not.toBeNull();
    }
  });

  it('shows CardDrawn in full to the drawer', () => {
    expect(toEventView(FIXTURES.CardDrawn, 0, NONE)).toEqual({
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
    const view = toEventView(FIXTURES.CardDrawn, 1, NONE);
    expect(view).toEqual({
      type: 'CardDrawn',
      playerIndex: 0,
      card: { hidden: true, instanceId: 'p0-1', ownerIndex: 0 },
    });
    expect(JSON.stringify(view)).not.toContain(SECRET);
    expect(JSON.stringify(toEventView(FIXTURES.CardDrawn, 0, NONE))).toContain(SECRET);
  });

  it('draws for player 1 are symmetric', () => {
    const drawn: GameEvent = { ...FIXTURES.CardDrawn, playerIndex: 1, instanceId: 'p1-9' };
    expect(JSON.stringify(toEventView(drawn, 0, NONE))).not.toContain(SECRET);
    expect(JSON.stringify(toEventView(drawn, 1, NONE))).toContain(SECRET);
  });

  it.each(['MonsterSet', 'SpellTrapSet', 'FieldSpellSet'] as const)(
    'never leaks a definitionId through the face-down Set event %s',
    (type) => {
      for (const viewer of [0, 1] as const) {
        const view = toEventView(FIXTURES[type], viewer, NONE);
        expect(view).not.toBeNull();
        expect(JSON.stringify(view)).not.toContain('definitionId');
      }
    },
  );

  it('denies by default: an unclassified event type yields null', () => {
    const unknown = { type: 'FutureEvent', definitionId: SECRET } as unknown as GameEvent;
    expect(toEventView(unknown, 0, NONE)).toBeNull();
    expect(toEventView(unknown, 1, NONE)).toBeNull();
  });

  it('toEventViews keeps order and drops hidden events', () => {
    const unknown = { type: 'FutureEvent' } as unknown as GameEvent;
    const events: GameEvent[] = [
      FIXTURES.PhaseChanged,
      unknown,
      FIXTURES.CardDrawn,
      FIXTURES.DamageDealt,
    ];
    const views = toEventViews(events, 1, NONE);
    expect(views.map((v) => v.type)).toEqual(['PhaseChanged', 'CardDrawn', 'DamageDealt']);
    expect(JSON.stringify(views)).not.toContain(SECRET);
  });
});
