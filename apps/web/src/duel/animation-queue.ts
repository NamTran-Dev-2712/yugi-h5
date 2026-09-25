import type { EventView, PlayerAction, PlayerIndex, ViewResponse } from '@yugi/shared';

/**
 * EventView[] → the visual steps the scene plays before it shows the final view. Pure: no Phaser, no timers, no game
 * rules — a step only repeats fields the server put in the event. Captions come from an injected describer (the same
 * text as the log), so nothing here can name a card the viewer may not see.
 */

export type StepKind =
  | 'draw'
  | 'summon'
  | 'set'
  | 'tribute'
  | 'flip'
  | 'changePosition'
  | 'attack'
  | 'destroy'
  | 'damage'
  | 'discard'
  | 'phase'
  | 'turn'
  | 'duelEnd'
  | 'deckOut'
  | 'aiLabel';

/**
 * How long each step lasts at speed 1 (ms). One place to tune the feel (`?fast=1` = ×3, `?anim=off` = none).
 * `[REF]` = midpoint of a single measurement in `docs/reference/notes/animation-durations.md` (video #2, ±0.13–0.5 s,
 * measured once — estimates, not exact). `[GUESS]` = no footage. `[SIMPLIFIED]` = deliberately not the original.
 * Note `summon` is also used by Tribute Summon (tributes + summon add up longer than the original ~2.2 s chain), and
 * `aiLabel`/`phase` play once per AI action, so they stay short.
 */
export const DURATION_MS: Readonly<Record<StepKind, number>> = {
  draw: 450, // [SIMPLIFIED] one value for both players; original: opponent draw ~1.3–1.8 s, own draw not measured
  summon: 2600, // [REF] Normal Summon ~2.6 s
  set: 500, // [GUESS]
  tribute: 375, // [REF] ~0.3–0.4 s per tribute
  flip: 400, // [GUESS] same group as tribute/destroy
  changePosition: 350, // [GUESS] same group
  attack: 700, // [REF] release → hit ~0.7 s
  destroy: 375, // [REF] ~0.3–0.4 s per monster
  damage: 500, // [REF] floating damage number ~0.5 s
  discard: 350, // [GUESS] same group
  phase: 270, // [REF] hex label change ~0.27 s
  turn: 1750, // [REF] "Lượt đối thủ" banner ~1.7–1.8 s
  duelEnd: 1500, // [SIMPLIFIED] original LP 0 → result ~4.6 s is a whole sequence; ours is one caption
  deckOut: 400, // [GUESS]
  aiLabel: 250, // [GUESS] once per AI action
};
/** Several cards drawn in a row (the opening hand) play as one longer step instead of N short ones. */
const DRAW_MANY_MS = 600;

interface StepBase {
  readonly durationMs: number;
  /** Same sentence as the log line for the event (or for the AI action, on `aiLabel`). */
  readonly text: string;
}
export type AnimationStep =
  | (StepBase & {
      readonly kind: 'draw';
      readonly playerIndex: PlayerIndex;
      readonly count: number;
    })
  | (StepBase & {
      readonly kind: 'summon' | 'set';
      readonly playerIndex: PlayerIndex;
      readonly instanceId: string;
      readonly zoneIndex: number;
    })
  | (StepBase & {
      readonly kind: 'tribute' | 'flip' | 'destroy';
      readonly playerIndex: PlayerIndex;
      readonly instanceId: string;
      readonly zoneIndex: number;
    })
  | (StepBase & {
      readonly kind: 'changePosition';
      readonly playerIndex: PlayerIndex;
      readonly instanceId: string;
      readonly zoneIndex: number;
    })
  | (StepBase & {
      readonly kind: 'attack';
      readonly playerIndex: PlayerIndex;
      readonly instanceId: string;
      /** null = direct attack. */
      readonly targetInstanceId: string | null;
    })
  | (StepBase & {
      readonly kind: 'damage';
      readonly playerIndex: PlayerIndex;
      readonly amount: number;
    })
  | (StepBase & {
      readonly kind: 'discard';
      readonly playerIndex: PlayerIndex;
      readonly instanceId: string;
    })
  | (StepBase & { readonly kind: 'phase' })
  | (StepBase & { readonly kind: 'turn'; readonly playerIndex: PlayerIndex })
  | (StepBase & { readonly kind: 'duelEnd'; readonly winnerIndex: PlayerIndex | null })
  | (StepBase & { readonly kind: 'deckOut'; readonly playerIndex: PlayerIndex })
  | (StepBase & { readonly kind: 'aiLabel' });

export interface AnimationSegment {
  /** true = the AI's move (starts with an `aiLabel` step). */
  readonly ai: boolean;
  readonly steps: readonly AnimationStep[];
}

type Describe = (event: EventView) => string;

function stepFor(e: EventView, text: string): AnimationStep | null {
  const d = (kind: StepKind): { durationMs: number; text: string } => ({
    durationMs: DURATION_MS[kind],
    text,
  });
  switch (e.type) {
    case 'DuelStarted':
      return null;
    case 'CardDrawn':
      return { kind: 'draw', ...d('draw'), playerIndex: e.playerIndex, count: 1 };
    case 'DeckOut':
      return { kind: 'deckOut', ...d('deckOut'), playerIndex: e.playerIndex };
    case 'CardDiscarded':
      return {
        kind: 'discard',
        ...d('discard'),
        playerIndex: e.playerIndex,
        instanceId: e.instanceId,
      };
    case 'PhaseChanged':
      return { kind: 'phase', ...d('phase') };
    case 'TurnChanged':
      return { kind: 'turn', ...d('turn'), playerIndex: e.turnPlayerIndex };
    case 'NormalSummoned':
      return {
        kind: 'summon',
        ...d('summon'),
        playerIndex: e.playerIndex,
        instanceId: e.instanceId,
        zoneIndex: e.zoneIndex,
      };
    case 'MonsterSet':
      return {
        kind: 'set',
        ...d('set'),
        playerIndex: e.playerIndex,
        instanceId: e.instanceId,
        zoneIndex: e.zoneIndex,
      };
    case 'MonsterTributed':
      return {
        kind: 'tribute',
        ...d('tribute'),
        playerIndex: e.ownerIndex,
        instanceId: e.instanceId,
        zoneIndex: e.zoneIndex,
      };
    case 'PositionChanged':
      return {
        kind: 'changePosition',
        ...d('changePosition'),
        playerIndex: e.playerIndex,
        instanceId: e.instanceId,
        zoneIndex: e.zoneIndex,
      };
    case 'MonsterFlipped':
      return {
        kind: 'flip',
        ...d('flip'),
        playerIndex: e.ownerIndex,
        instanceId: e.instanceId,
        zoneIndex: e.zoneIndex,
      };
    case 'AttackDeclared':
      return {
        kind: 'attack',
        ...d('attack'),
        playerIndex: e.playerIndex,
        instanceId: e.attackerInstanceId,
        targetInstanceId: e.targetInstanceId,
      };
    case 'MonsterDestroyed':
      return {
        kind: 'destroy',
        ...d('destroy'),
        playerIndex: e.ownerIndex,
        instanceId: e.instanceId,
        zoneIndex: e.zoneIndex,
      };
    case 'DamageDealt':
      return { kind: 'damage', ...d('damage'), playerIndex: e.playerIndex, amount: e.amount };
    case 'DuelEnded':
      return { kind: 'duelEnd', ...d('duelEnd'), winnerIndex: e.winnerIndex };
    default: {
      const exhaustive: never = e;
      return exhaustive;
    }
  }
}

export function stepsFor(events: readonly EventView[], describe: Describe): AnimationStep[] {
  const out: AnimationStep[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.type === 'PhaseChanged') {
      // Walking through Draw/Standby/... of an EndPhase run is noise: keep the last phase of a run, and none at all
      // when a turn change follows the run (the turn banner already says it).
      let j = i;
      while (events[j + 1]?.type === 'PhaseChanged') j++;
      i = j;
      if (events[j + 1]?.type === 'TurnChanged') continue;
      const step = stepFor(events[j]!, describe(events[j]!));
      if (step) out.push(step);
      continue;
    }
    const step = stepFor(e, describe(e));
    if (!step) continue;
    const last = out[out.length - 1];
    if (step.kind === 'draw' && last?.kind === 'draw' && last.playerIndex === step.playerIndex) {
      out[out.length - 1] = {
        ...last,
        count: last.count + 1,
        durationMs: DRAW_MANY_MS,
        text: last.count === 1 ? step.text : last.text,
      };
      continue;
    }
    out.push(step);
  }
  return out;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * Splits a response into what the person's own action caused (events before the first AI action) and, in order,
 * one segment per AI action (its `[eventsFrom, eventsTo)` slice of the SAME `events` array).
 */
export function segmentsFor(
  response: Pick<ViewResponse, 'events' | 'aiActions'>,
  describe: Describe,
  describeAi: (action: PlayerAction) => string,
): AnimationSegment[] {
  const { events } = response;
  const aiActions = response.aiActions ?? [];
  const humanEnd = clamp(aiActions[0]?.eventsFrom ?? events.length, 0, events.length);
  const segments: AnimationSegment[] = [];

  const human = stepsFor(events.slice(0, humanEnd), describe);
  if (human.length > 0) segments.push({ ai: false, steps: human });

  for (const ai of aiActions) {
    const from = clamp(ai.eventsFrom, 0, events.length);
    const to = clamp(ai.eventsTo, from, events.length);
    const label: AnimationStep = {
      kind: 'aiLabel',
      durationMs: DURATION_MS.aiLabel,
      text: describeAi(ai.action),
    };
    segments.push({ ai: true, steps: [label, ...stepsFor(events.slice(from, to), describe)] });
  }
  return segments;
}
