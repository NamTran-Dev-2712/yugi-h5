import type { EventView, PlayerAction, StateView, ViewResponse } from '@yugi/shared';

/**
 * Structured log for the DuelScene panel, kept BESIDE the plain `log: string[]` (which the debug page and the e2e
 * tools keep using). The category comes from the event/action TYPE, never from the formatted text.
 */
export type LogCategory = 'field' | 'combat' | 'turn' | 'error';

export const ALL_CATEGORIES: readonly LogCategory[] = ['field', 'combat', 'turn', 'error'];

export interface LogEntry {
  readonly text: string;
  readonly category: LogCategory;
}

/** Exhaustive on purpose: a new EventView type is a compile error until it is put in a group. */
export function categoryOfEvent(type: EventView['type']): LogCategory {
  switch (type) {
    case 'NormalSummoned':
    case 'MonsterSet':
    case 'MonsterTributed':
    case 'MonsterFlipped':
    case 'PositionChanged':
    case 'CardDiscarded':
    case 'SpellTrapSet':
    case 'EffectActivated':
    case 'EffectResolved':
    case 'CardSentToGraveyard':
      return 'field';
    case 'AttackDeclared':
    case 'MonsterDestroyed':
    case 'DamageDealt':
    case 'DuelEnded':
    // LP changes and destruction by an effect sit with the battle results.
    case 'LifePointsRecovered':
    case 'LifePointsPaid':
    case 'SpellTrapDestroyed':
      return 'combat';
    case 'TurnChanged':
    case 'PhaseChanged':
    case 'CardDrawn':
    case 'DeckOut':
    case 'DuelStarted':
      return 'turn';
    default: {
      const unhandled: never = type;
      throw new Error(`Event chưa có nhóm log: ${String(unhandled)}`);
    }
  }
}

/** Exhaustive on purpose: a new player action is a compile error until it is put in a group. */
export function categoryOfAiAction(type: PlayerAction['type']): LogCategory {
  switch (type) {
    case 'NormalSummon':
    case 'SetMonster':
    case 'ChangePosition':
    case 'ResolvePendingPrompt':
    case 'SetSpellTrap':
    case 'ActivateEffect':
      return 'field';
    case 'DeclareAttack':
    case 'Surrender':
      return 'combat';
    case 'EndPhase':
      return 'turn';
    default: {
      const unhandled: never = type;
      throw new Error(`Action chưa có nhóm log: ${String(unhandled)}`);
    }
  }
}

export const errorEntry = (text: string): LogEntry => ({ text, category: 'error' });

/**
 * Same order and same texts as `logLinesFor` (debug-state.ts) — each AI action gets its header right before the events
 * it caused, events outside every slice are still kept — but every line carries its category.
 */
export function entriesFor(
  response: ViewResponse,
  describe: (events: readonly EventView[], view: StateView) => readonly string[],
  describeAi: (action: PlayerAction, view: StateView) => string,
): LogEntry[] {
  const { events, view } = response;
  const ai = response.aiActions ?? [];
  const eventEntries = (from: number, to?: number): LogEntry[] => {
    const slice = events.slice(from, to);
    const lines = describe(slice, view);
    return slice.map((e, i) => ({
      text: lines[i] ?? '',
      category: categoryOfEvent(e.type),
    }));
  };
  if (ai.length === 0) return eventEntries(0);
  const out: LogEntry[] = [];
  let cursor = 0;
  for (const step of ai) {
    if (step.eventsFrom > cursor) out.push(...eventEntries(cursor, step.eventsFrom));
    out.push({
      text: describeAi(step.action, view),
      category: categoryOfAiAction(step.action.type),
    });
    out.push(...eventEntries(step.eventsFrom, step.eventsTo));
    cursor = Math.max(cursor, step.eventsTo);
  }
  if (cursor < events.length) out.push(...eventEntries(cursor));
  return out;
}

export function filterEntries(
  entries: readonly LogEntry[],
  enabled: ReadonlySet<LogCategory>,
): LogEntry[] {
  return entries.filter((e) => enabled.has(e.category));
}
