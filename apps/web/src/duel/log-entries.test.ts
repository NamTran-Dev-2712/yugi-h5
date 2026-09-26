import type { EventView, PlayerAction, StateView, ViewResponse } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { logLinesFor } from '../debug/debug-state';
import {
  ALL_CATEGORIES,
  categoryOfAiAction,
  categoryOfEvent,
  entriesFor,
  errorEntry,
  filterEntries,
  type LogCategory,
} from './log-entries';
import { loadFixture } from './fixtures';

const EVENT_CATEGORY: Record<EventView['type'], LogCategory> = {
  DuelStarted: 'turn',
  CardDrawn: 'turn',
  DeckOut: 'turn',
  PhaseChanged: 'turn',
  TurnChanged: 'turn',
  CardDiscarded: 'field',
  NormalSummoned: 'field',
  MonsterSet: 'field',
  MonsterTributed: 'field',
  PositionChanged: 'field',
  MonsterFlipped: 'field',
  AttackDeclared: 'combat',
  MonsterDestroyed: 'combat',
  DamageDealt: 'combat',
  DuelEnded: 'combat',
  SpellTrapSet: 'field',
  EffectActivated: 'field',
  EffectResolved: 'field',
  CardSentToGraveyard: 'field',
  LifePointsRecovered: 'combat',
  LifePointsPaid: 'combat',
  SpellTrapDestroyed: 'combat',
};

const AI_CATEGORY: Record<PlayerAction['type'], LogCategory> = {
  EndPhase: 'turn',
  NormalSummon: 'field',
  SetMonster: 'field',
  ChangePosition: 'field',
  ResolvePendingPrompt: 'field',
  DeclareAttack: 'combat',
  Surrender: 'combat',
  SetSpellTrap: 'field',
  ActivateEffect: 'field',
};

describe('category tables', () => {
  it.each(Object.entries(EVENT_CATEGORY))('event %s -> %s', (type, cat) => {
    expect(categoryOfEvent(type as EventView['type'])).toBe(cat);
  });
  it.each(Object.entries(AI_CATEGORY))('AI action %s -> %s', (type, cat) => {
    expect(categoryOfAiAction(type as PlayerAction['type'])).toBe(cat);
  });
  it('lists the four categories', () => {
    expect([...ALL_CATEGORIES].sort()).toEqual(['combat', 'error', 'field', 'turn']);
  });
});

const view: StateView = loadFixture('midgame').view;
const ev = (e: EventView): EventView => e;
const describeEvents = (events: readonly EventView[]): string[] => events.map((e) => `E:${e.type}`);
const describeAi = (a: PlayerAction): string => `AI:${a.type}`;
const ai = (type: 'EndPhase' | 'DeclareAttack', from: number, to: number) => ({
  action:
    type === 'EndPhase'
      ? ({ type, payload: { playerIndex: 1 } } as const)
      : ({
          type,
          payload: { playerIndex: 1, attackerInstanceId: 'a', targetInstanceId: null },
        } as const),
  eventsFrom: from,
  eventsTo: to,
});

const events: EventView[] = [
  ev({ type: 'TurnChanged', turnCount: 2, turnPlayerIndex: 1 }),
  ev({ type: 'NormalSummoned', playerIndex: 1, instanceId: 'x', definitionId: 'D', zoneIndex: 0 }),
  ev({ type: 'AttackDeclared', playerIndex: 1, attackerInstanceId: 'x', targetInstanceId: null }),
  ev({ type: 'DamageDealt', playerIndex: 0, amount: 100 }),
];

function response(over: Partial<ViewResponse>): ViewResponse {
  return { view, events, legalActions: [], ...over };
}

describe('entriesFor', () => {
  it('without aiActions: one entry per event, category from the event type, text from describe', () => {
    const entries = entriesFor(response({}), describeEvents, describeAi);
    expect(entries).toEqual([
      { text: 'E:TurnChanged', category: 'turn' },
      { text: 'E:NormalSummoned', category: 'field' },
      { text: 'E:AttackDeclared', category: 'combat' },
      { text: 'E:DamageDealt', category: 'combat' },
    ]);
  });

  it('puts each AI header (categorised by its action) before the events it caused; events outside slices stay', () => {
    const r = response({
      aiActions: [ai('EndPhase', 1, 2), ai('DeclareAttack', 2, 3)],
    });
    const entries = entriesFor(r, describeEvents, describeAi);
    expect(entries.map((e) => `${e.category}:${e.text}`)).toEqual([
      'turn:E:TurnChanged',
      'turn:AI:EndPhase',
      'field:E:NormalSummoned',
      'combat:AI:DeclareAttack',
      'combat:E:AttackDeclared',
      'combat:E:DamageDealt',
    ]);
  });

  it('texts are identical to logLinesFor (the two logs can never drift), with and without AI slices', () => {
    for (const aiActions of [undefined, [ai('EndPhase', 0, 2), ai('DeclareAttack', 2, 4)]]) {
      const r = response(aiActions ? { aiActions } : {});
      const describeAll = (es: readonly EventView[]) => describeEvents(es);
      expect(entriesFor(r, describeEvents, describeAi).map((e) => e.text)).toEqual(
        logLinesFor(r, describeAll, describeAi),
      );
    }
  });
});

describe('entriesFor with overlapping AI slices (server bug tolerance)', () => {
  it('never re-logs an event and still matches logLinesFor', () => {
    const r = response({ aiActions: [ai('EndPhase', 0, 3), ai('EndPhase', 1, 2)] });
    const entries = entriesFor(r, describeEvents, describeAi);
    expect(entries.map((e) => e.text)).toEqual(logLinesFor(r, describeEvents, describeAi));
    expect(entries.filter((e) => e.text === 'E:DamageDealt')).toHaveLength(1);
  });
});

describe('errorEntry / filterEntries', () => {
  const entries = [
    { text: 'a', category: 'field' },
    { text: 'b', category: 'combat' },
    { text: 'c', category: 'turn' },
    errorEntry('✗ boom'),
  ] as const;

  it('errorEntry is the error category', () => {
    expect(errorEntry('✗ x')).toEqual({ text: '✗ x', category: 'error' });
  });
  it('all enabled keeps everything, order preserved', () => {
    expect(filterEntries(entries, new Set(ALL_CATEGORIES)).map((e) => e.text)).toEqual([
      'a',
      'b',
      'c',
      '✗ boom',
    ]);
  });
  it('a subset keeps only those categories', () => {
    expect(
      filterEntries(entries, new Set<LogCategory>(['combat', 'error'])).map((e) => e.text),
    ).toEqual(['b', '✗ boom']);
  });
  it('none enabled = empty', () => {
    expect(filterEntries(entries, new Set())).toEqual([]);
  });
});
