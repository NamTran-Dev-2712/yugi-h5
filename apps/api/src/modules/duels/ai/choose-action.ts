import type { CardDefinition, CardView, PlayerAction, StateView } from '@yugi/shared';
import { DEFAULT_AI_CONFIG, type AiConfig } from './ai-config';

/**
 * Rule-based AI. A PURE function of what the AI seat is allowed to know: its own StateView (opponent hand, deck and
 * face-down cards are already hidden there), the actions the engine says are legal, card definitions and a seeded
 * random source for tie-breaks. It never receives a GameState, so it cannot peek. The answer is always one of
 * `legalActions`, and never `Surrender`.
 */

export interface AiInput {
  /** The view of the AI's own seat (`view.viewerIndex`). */
  readonly view: StateView;
  readonly legalActions: readonly PlayerAction[];
  readonly cardDefinitions: (definitionId: string) => CardDefinition | undefined;
  /** Uniform [0,1); only used to break ties. */
  readonly rng: () => number;
  readonly config?: Partial<AiConfig>;
}

export type AiPolicy = (input: AiInput) => PlayerAction;

export class AiNoActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiNoActionError';
  }
}

interface Stats {
  readonly atk: number;
  readonly def: number;
  readonly position: 'Attack' | 'DefenseUp' | 'DefenseDown' | null;
}

const key = (a: PlayerAction): string => JSON.stringify(a);

/** Highest-scoring item; ties are broken with the rng (never by object identity/insertion order alone). */
function best<T>(items: readonly T[], score: (t: T) => number, rng: () => number): T | undefined {
  let top = -Infinity;
  let tied: T[] = [];
  for (const item of items) {
    const s = score(item);
    if (s > top) {
      top = s;
      tied = [item];
    } else if (s === top) {
      tied.push(item);
    }
  }
  if (tied.length === 0) return undefined;
  return tied.length === 1 ? tied[0] : tied[Math.floor(rng() * tied.length)];
}

export function chooseAction(input: AiInput): PlayerAction {
  const { view, legalActions } = input;
  const config: AiConfig = { ...DEFAULT_AI_CONFIG, ...input.config };
  const seat = view.viewerIndex;
  const own = view.players[seat];
  const opp = view.players[seat === 0 ? 1 : 0];

  const statsOf = (c: CardView): Stats | undefined => {
    if (c.hidden) return undefined;
    const def = input.cardDefinitions(c.definitionId);
    if (!def || def.kind !== 'Monster') return undefined;
    return { atk: def.atk, def: def.def, position: c.position };
  };
  const stats = new Map<string, Stats>();
  const noteAll = (cards: readonly (CardView | null)[]) => {
    for (const c of cards) {
      if (!c) continue;
      const s = statsOf(c);
      if (s) stats.set(c.instanceId, s);
    }
  };
  noteAll(own.hand);
  noteAll(own.board.monsterZones);
  noteAll(opp.board.monsterZones); // face-down ones are hidden cards: no stats, by design

  /** Cards without stats (Spells, unknown) are worth nothing. */
  const valueOf = (instanceId: string): number => stats.get(instanceId)?.atk ?? 0;

  /** Strongest ATK among the opponent's face-up attack-position monsters. */
  let threat = 0;
  /** Strongest thing the opponent has face-up, attack or defense. */
  let strongest = 0;
  for (const c of opp.board.monsterZones) {
    if (!c || c.hidden) continue;
    const s = stats.get(c.instanceId);
    if (!s) continue;
    if (s.position === 'Attack') {
      threat = Math.max(threat, s.atk);
      strongest = Math.max(strongest, s.atk);
    } else {
      strongest = Math.max(strongest, s.def);
    }
  }

  const candidate = decide();
  if (candidate && legalActions.some((a) => key(a) === key(candidate))) return candidate;
  return fallback();

  function decide(): PlayerAction | undefined {
    if (view.pendingPrompt !== null) return discard();
    switch (view.phase) {
      case 'Main1':
      case 'Main2':
        return summon() ?? reposition();
      case 'Battle':
        return attack();
      default:
        return undefined;
    }
  }

  function discard(): PlayerAction | undefined {
    const answers = legalActions.filter((a) => a.type === 'ResolvePendingPrompt');
    return best(
      answers,
      (a) =>
        a.type === 'ResolvePendingPrompt'
          ? -a.payload.cardInstanceIds.reduce((sum, id) => sum + valueOf(id), 0)
          : -Infinity,
      input.rng,
    );
  }

  function summon(): PlayerAction | undefined {
    const options: { action: PlayerAction; atk: number; cost: number; tributes: number }[] = [];
    for (const a of legalActions) {
      if (a.type !== 'NormalSummon') continue;
      const atk = stats.get(a.payload.cardInstanceId)?.atk;
      if (atk === undefined) continue;
      const tributes = a.payload.tributeInstanceIds ?? [];
      const cost = tributes.reduce((sum, id) => sum + (stats.get(id)?.atk ?? Infinity), 0);
      if (tributes.length > 0 && !(atk >= cost + config.tributeAtkMargin)) continue;
      options.push({ action: a, atk, cost, tributes: tributes.length });
    }
    // Net board gain; on equal gain, the free summon wins.
    const top = best(options, (o) => (o.atk - o.cost) * 2 - (o.tributes > 0 ? 1 : 0), input.rng);
    if (top && top.atk > threat) return top.action;

    // Cannot out-muscle the opposing attackers: play a monster face-down, best DEF first.
    const sets = legalActions.filter(
      (a) => a.type === 'SetMonster' && (a.payload.tributeInstanceIds ?? []).length === 0,
    );
    return best(
      sets,
      (a) =>
        a.type === 'SetMonster' ? (stats.get(a.payload.cardInstanceId)?.def ?? 0) : -Infinity,
      input.rng,
    );
  }

  function reposition(): PlayerAction | undefined {
    const moves = legalActions.filter((a) => a.type === 'ChangePosition');
    const scored = moves.flatMap((a) => {
      if (a.type !== 'ChangePosition') return [];
      const s = stats.get(a.payload.cardInstanceId);
      if (!s) return [];
      // Would lose an attack: defend instead (a defender never costs Life Points).
      if (s.position === 'Attack' && a.payload.toPosition === 'DefenseUp' && s.atk < threat) {
        return [{ a, score: threat - s.atk }];
      }
      // Clearly stronger than everything face-up: go on the offensive (only worthwhile before Battle).
      if (
        view.phase === 'Main1' &&
        s.position === 'DefenseUp' &&
        a.payload.toPosition === 'Attack' &&
        s.atk > strongest
      ) {
        return [{ a, score: s.atk - strongest }];
      }
      return [];
    });
    return best(scored, (x) => x.score, input.rng)?.a;
  }

  function attack(): PlayerAction | undefined {
    const attacks = legalActions.filter((a) => a.type === 'DeclareAttack');
    const direct = attacks.filter(
      (a) => a.type === 'DeclareAttack' && (a.payload.targetInstanceId ?? null) === null,
    );
    if (direct.length > 0) {
      return best(
        direct,
        (a) =>
          a.type === 'DeclareAttack' ? (stats.get(a.payload.attackerInstanceId)?.atk ?? 0) : 0,
        input.rng,
      );
    }
    const scored = attacks.flatMap((a) => {
      if (a.type !== 'DeclareAttack' || a.payload.targetInstanceId == null) return [];
      const mine = stats.get(a.payload.attackerInstanceId);
      if (!mine) return [];
      const target = opp.board.monsterZones.find(
        (c) => c?.instanceId === a.payload.targetInstanceId,
      );
      if (!target) return [];
      // Prefer the attacker that is just strong enough (keep the big ones for bigger targets).
      const thrift = -mine.atk / 100000;
      if (target.hidden) {
        return mine.atk >= config.facedownAttackMinAtk ? [{ a, score: 100 + thrift }] : [];
      }
      const t = stats.get(target.instanceId);
      if (!t) return [];
      if (t.position === 'Attack')
        return mine.atk > t.atk ? [{ a, score: 2000 + t.atk + thrift }] : [];
      return mine.atk > t.def ? [{ a, score: 500 + t.def + thrift }] : [];
    });
    return best(scored, (x) => x.score, input.rng)?.a;
  }

  function fallback(): PlayerAction {
    const end = legalActions.find((a) => a.type === 'EndPhase');
    if (end) return end;
    const other = legalActions.find((a) => a.type !== 'Surrender');
    if (other) return other;
    throw new AiNoActionError('The AI has no legal action other than Surrender.');
  }
}
