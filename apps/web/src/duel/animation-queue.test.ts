import type { AiActionView, EventView, PlayerAction, ViewResponse } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import {
  DURATION_MS,
  segmentsFor,
  stepsFor,
  type AnimationStep,
  type StepKind,
} from './animation-queue';

const describe1 = (e: EventView): string => `ev:${e.type}`;
const describeAi = (a: PlayerAction): string => `ai:${a.type}`;

const hidden = { hidden: true as const, instanceId: 'p1-3', ownerIndex: 1 as const };

/** One sample of every EventView type; `Record` makes a new type without a sample a compile error. */
const SAMPLES: Record<EventView['type'], EventView> = {
  DuelStarted: { type: 'DuelStarted', matchId: 'm', turnPlayerIndex: 0 },
  CardDrawn: { type: 'CardDrawn', playerIndex: 1, card: hidden },
  DeckOut: { type: 'DeckOut', playerIndex: 0 },
  CardDiscarded: { type: 'CardDiscarded', playerIndex: 0, instanceId: 'p0-1', definitionId: 'X' },
  PhaseChanged: { type: 'PhaseChanged', from: 'Main1', to: 'Battle', turnPlayerIndex: 0 },
  TurnChanged: { type: 'TurnChanged', turnCount: 2, turnPlayerIndex: 1 },
  NormalSummoned: {
    type: 'NormalSummoned',
    playerIndex: 0,
    instanceId: 'p0-2',
    definitionId: 'X',
    zoneIndex: 2,
  },
  MonsterSet: { type: 'MonsterSet', playerIndex: 1, instanceId: 'p1-4', zoneIndex: 1 },
  MonsterTributed: {
    type: 'MonsterTributed',
    ownerIndex: 0,
    instanceId: 'p0-5',
    definitionId: 'X',
    zoneIndex: 0,
  },
  PositionChanged: {
    type: 'PositionChanged',
    playerIndex: 0,
    instanceId: 'p0-2',
    definitionId: 'X',
    zoneIndex: 2,
    from: 'Attack',
    to: 'DefenseUp',
  },
  MonsterFlipped: {
    type: 'MonsterFlipped',
    ownerIndex: 1,
    instanceId: 'p1-4',
    definitionId: 'X',
    zoneIndex: 1,
  },
  AttackDeclared: {
    type: 'AttackDeclared',
    playerIndex: 0,
    attackerInstanceId: 'p0-2',
    targetInstanceId: 'p1-4',
  },
  MonsterDestroyed: {
    type: 'MonsterDestroyed',
    ownerIndex: 1,
    instanceId: 'p1-4',
    definitionId: 'X',
    zoneIndex: 1,
  },
  DamageDealt: { type: 'DamageDealt', playerIndex: 1, amount: 700 },
  DuelEnded: { type: 'DuelEnded', winnerIndex: 0, reason: 'LP_ZERO' },
};

const KIND_OF: Record<EventView['type'], StepKind | null> = {
  DuelStarted: null,
  CardDrawn: 'draw',
  DeckOut: 'deckOut',
  CardDiscarded: 'discard',
  PhaseChanged: 'phase',
  TurnChanged: 'turn',
  NormalSummoned: 'summon',
  MonsterSet: 'set',
  MonsterTributed: 'tribute',
  PositionChanged: 'changePosition',
  MonsterFlipped: 'flip',
  AttackDeclared: 'attack',
  MonsterDestroyed: 'destroy',
  DamageDealt: 'damage',
  DuelEnded: 'duelEnd',
};

describe('stepsFor', () => {
  for (const [type, event] of Object.entries(SAMPLES)) {
    const kind = KIND_OF[type as EventView['type']];
    it(`${type} → ${kind ?? 'no step'}`, () => {
      const steps = stepsFor([event], describe1);
      if (kind === null) {
        expect(steps).toEqual([]);
        return;
      }
      expect(steps).toHaveLength(1);
      expect(steps[0]?.kind).toBe(kind);
      expect(steps[0]?.durationMs).toBe(DURATION_MS[kind]);
      expect(steps[0]?.durationMs).toBeGreaterThan(0);
      expect(steps[0]?.text).toBe(`ev:${type}`);
    });
  }

  it('carries the fields the scene needs to draw the effect', () => {
    const [summon] = stepsFor([SAMPLES.NormalSummoned], describe1);
    expect(summon).toMatchObject({ playerIndex: 0, instanceId: 'p0-2', zoneIndex: 2 });
    const [attack] = stepsFor([SAMPLES.AttackDeclared], describe1);
    expect(attack).toMatchObject({ instanceId: 'p0-2', targetInstanceId: 'p1-4' });
    const [damage] = stepsFor([SAMPLES.DamageDealt], describe1);
    expect(damage).toMatchObject({ playerIndex: 1, amount: 700 });
  });

  it('keeps the order of the events', () => {
    const steps = stepsFor(
      [SAMPLES.AttackDeclared, SAMPLES.MonsterDestroyed, SAMPLES.DamageDealt],
      describe1,
    );
    expect(steps.map((s) => s.kind)).toEqual(['attack', 'destroy', 'damage']);
  });

  it('merges consecutive draws of one player into one step and keeps different players apart', () => {
    const draw = (playerIndex: 0 | 1): EventView => ({
      type: 'CardDrawn',
      playerIndex,
      card: { hidden: true, instanceId: `p${playerIndex}-x`, ownerIndex: playerIndex },
    });
    const steps = stepsFor([draw(0), draw(0), draw(0), draw(1)], describe1);
    expect(steps.map((s) => s.kind)).toEqual(['draw', 'draw']);
    expect(steps[0]).toMatchObject({ playerIndex: 0, count: 3 });
    expect(steps[1]).toMatchObject({ playerIndex: 1, count: 1 });
  });

  it('keeps only the last phase change of a run, and none when a turn change follows', () => {
    const phase = (to: 'Draw' | 'Standby' | 'Main1'): EventView => ({
      type: 'PhaseChanged',
      from: 'End',
      to,
      turnPlayerIndex: 0,
    });
    const run = stepsFor([phase('Draw'), phase('Standby'), phase('Main1')], describe1);
    expect(run.map((s) => s.kind)).toEqual(['phase']);
    expect(run[0]?.text).toBe('ev:PhaseChanged');
    const withTurn = stepsFor([phase('Draw'), SAMPLES.TurnChanged, phase('Main1')], describe1);
    expect(withTurn.map((s) => s.kind)).toEqual(['turn', 'phase']);
  });

  it('never puts a hidden card name into a step (captions come from the injected describer only)', () => {
    const steps = stepsFor(Object.values(SAMPLES), () => 'neutral');
    expect(JSON.stringify(steps)).not.toContain('definitionId');
    expect(JSON.stringify(steps)).not.toContain('"X"');
  });

  it('empty input → no steps', () => {
    expect(stepsFor([], describe1)).toEqual([]);
  });
});

function res(events: EventView[], aiActions?: AiActionView[]): ViewResponse {
  const base = { view: {} as ViewResponse['view'], legalActions: [], events };
  return aiActions ? { ...base, aiActions } : base;
}
const pa = (t: PlayerAction['type']): PlayerAction =>
  ({ type: t, payload: { playerIndex: 1 } }) as PlayerAction;
const kinds = (steps: readonly AnimationStep[]): string[] => steps.map((s) => s.kind);

describe('segmentsFor', () => {
  const E = SAMPLES;

  it('no aiActions → one player segment with every event', () => {
    const segs = segmentsFor(res([E.NormalSummoned, E.AttackDeclared]), describe1, describeAi);
    expect(segs).toHaveLength(1);
    expect(segs[0]?.ai).toBe(false);
    expect(kinds(segs[0]!.steps)).toEqual(['summon', 'attack']);
  });

  it('cuts the player part before aiActions[0].eventsFrom', () => {
    const segs = segmentsFor(
      res(
        [E.NormalSummoned, E.MonsterSet, E.DamageDealt],
        [{ action: pa('EndPhase'), eventsFrom: 2, eventsTo: 3 }],
      ),
      describe1,
      describeAi,
    );
    expect(segs).toHaveLength(2);
    expect(segs[0]?.ai).toBe(false);
    expect(kinds(segs[0]!.steps)).toEqual(['summon', 'set']);
    expect(segs[1]?.ai).toBe(true);
    // the AI segment starts with a label step, then only ITS events
    expect(kinds(segs[1]!.steps)).toEqual(['aiLabel', 'damage']);
    expect(segs[1]!.steps[0]?.text).toBe('ai:EndPhase');
  });

  it('plays several aiActions one after another, each with its own slice, in order', () => {
    const segs = segmentsFor(
      res(
        [E.PhaseChanged, E.MonsterSet, E.NormalSummoned, E.AttackDeclared, E.DamageDealt],
        [
          { action: pa('SetMonster'), eventsFrom: 1, eventsTo: 2 },
          { action: pa('NormalSummon'), eventsFrom: 2, eventsTo: 3 },
          { action: pa('DeclareAttack'), eventsFrom: 3, eventsTo: 5 },
        ],
      ),
      describe1,
      describeAi,
    );
    expect(segs.map((s) => s.ai)).toEqual([false, true, true, true]);
    expect(kinds(segs[0]!.steps)).toEqual(['phase']);
    expect(kinds(segs[1]!.steps)).toEqual(['aiLabel', 'set']);
    expect(kinds(segs[2]!.steps)).toEqual(['aiLabel', 'summon']);
    expect(kinds(segs[3]!.steps)).toEqual(['aiLabel', 'attack', 'damage']);
    expect(segs.map((s) => s.steps[0]?.text)).toEqual([
      'ev:PhaseChanged',
      'ai:SetMonster',
      'ai:NormalSummon',
      'ai:DeclareAttack',
    ]);
  });

  it('an empty human part is dropped (AI moves only) and an AI action with no events still shows its label', () => {
    const segs = segmentsFor(
      res(
        [E.DamageDealt],
        [
          { action: pa('EndPhase'), eventsFrom: 0, eventsTo: 0 },
          { action: pa('EndPhase'), eventsFrom: 0, eventsTo: 1 },
        ],
      ),
      describe1,
      describeAi,
    );
    expect(segs.map((s) => s.ai)).toEqual([true, true]);
    expect(kinds(segs[0]!.steps)).toEqual(['aiLabel']);
    expect(kinds(segs[1]!.steps)).toEqual(['aiLabel', 'damage']);
  });

  it('clamps slices that fall outside the events array instead of throwing', () => {
    const segs = segmentsFor(
      res([E.MonsterSet], [{ action: pa('EndPhase'), eventsFrom: 1, eventsTo: 9 }]),
      describe1,
      describeAi,
    );
    expect(kinds(segs[0]!.steps)).toEqual(['set']);
    expect(kinds(segs[1]!.steps)).toEqual(['aiLabel']);
  });

  it('nothing at all → no segments', () => {
    expect(segmentsFor(res([]), describe1, describeAi)).toEqual([]);
  });
});
