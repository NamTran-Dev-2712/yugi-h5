import type { Cost } from '@yugi/shared';
import type { Action, ActionContext } from './actions/types.js';
import { applyAction } from './apply-action.js';
import { EngineError } from './errors.js';
import type { CardInstance, GameState } from './state/types.js';

/*
 * `getLegalActions` never re-implements a rule. It (1) enumerates CANDIDATES purely by structure (every hand card ×
 * Summon/Set × zone × tribute subset, every own monster × position / attack target, EndPhase, Surrender, prompt
 * answers) and (2) keeps the candidates that `applyAction` itself accepts (dry run: handlers are pure and throw
 * `EngineError` on rejection). A rule added to the engine is therefore reflected here for free; only a genuinely new
 * KIND of action needs a new candidate generator. Draw/StartDuel are never candidates (server-internal / forbidden).
 */

/** Largest tribute set any card needs (level 7+ → 2, see summon.ts). Candidates are subsets of size 0..this. */
const MAX_TRIBUTES = 2;
/** Upper bound on generated prompt-answer combinations (C(n, k) can explode for big hands). */
const MAX_ANSWER_COMBINATIONS = 200;

type Seat = 0 | 1;

function combinations<T>(items: readonly T[], size: number, limit: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, chosen: T[]): void => {
    if (out.length >= limit) return;
    if (chosen.length === size) {
      out.push([...chosen]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      chosen.push(items[i]!);
      pick(i + 1, chosen);
      chosen.pop();
    }
  };
  pick(0, []);
  return out;
}

/**
 * Candidate cost-id lists for an effect: the cartesian product, per cost, of every way to pick `count` cards from the
 * pool that kind of cost draws on (hand without the activating card / own monsters). PayLP contributes no ids.
 * Structure only — whether a selection is actually payable is decided by the engine (dry run).
 */
function costSelections(
  costs: readonly Cost[] | undefined,
  source: CardInstance,
  hand: readonly CardInstance[],
  monsters: readonly CardInstance[],
): string[][] {
  let selections: string[][] = [[]];
  for (const cost of costs ?? []) {
    if (cost.kind === 'PayLP') continue;
    const pool =
      cost.kind === 'Discard' ? hand.filter((c) => c.instanceId !== source.instanceId) : monsters;
    const picks = combinations(pool, cost.count, MAX_ANSWER_COMBINATIONS).map((c) =>
      c.map((x) => x.instanceId),
    );
    const next: string[][] = [];
    for (const base of selections) {
      for (const pick of picks) {
        if (next.length >= MAX_ANSWER_COMBINATIONS) break;
        next.push([...base, ...pick]);
      }
    }
    selections = next;
  }
  return selections;
}

function candidates(state: GameState, seat: Seat, ctx: ActionContext): Action[] {
  const me = state.players[seat];
  const opp = state.players[seat === 0 ? 1 : 0];
  const out: Action[] = [];

  const ownMonsters = me.board.monsterZones.filter((c): c is CardInstance => c !== null);
  const oppMonsters = opp.board.monsterZones.filter((c): c is CardInstance => c !== null);

  // Prompt answers.
  const prompt = state.pendingPrompt;
  if (prompt && prompt.kind === 'DiscardToHandLimit') {
    const payload = prompt.payload as { count?: unknown };
    if (
      typeof payload.count === 'number' &&
      Number.isInteger(payload.count) &&
      payload.count >= 0
    ) {
      for (const combo of combinations(me.hand, payload.count, MAX_ANSWER_COMBINATIONS)) {
        out.push({
          type: 'ResolvePendingPrompt',
          payload: {
            playerIndex: seat,
            promptId: prompt.promptId,
            cardInstanceIds: combo.map((c) => c.instanceId),
          },
        });
      }
    }
  }

  if (prompt && prompt.kind === 'SelectEffectTarget') {
    const payload = prompt.payload as { count?: unknown; candidateInstanceIds?: unknown };
    if (
      typeof payload.count === 'number' &&
      Number.isInteger(payload.count) &&
      payload.count >= 0 &&
      Array.isArray(payload.candidateInstanceIds)
    ) {
      const ids = payload.candidateInstanceIds.filter((id): id is string => typeof id === 'string');
      for (const combo of combinations(ids, payload.count, MAX_ANSWER_COMBINATIONS)) {
        out.push({
          type: 'ResolvePendingPrompt',
          payload: { playerIndex: seat, promptId: prompt.promptId, cardInstanceIds: combo },
        });
      }
    }
  }

  out.push({ type: 'EndPhase', payload: { playerIndex: seat } });
  out.push({ type: 'Surrender', payload: { playerIndex: seat } });

  // Summon / Set: hand card × zone × tribute subset.
  const tributeSets: CardInstance[][] = [];
  for (let size = 0; size <= MAX_TRIBUTES; size++) {
    tributeSets.push(...combinations(ownMonsters, size, Number.POSITIVE_INFINITY));
  }
  for (const handCard of me.hand) {
    for (const type of ['NormalSummon', 'SetMonster'] as const) {
      for (let zoneIndex = 0; zoneIndex < 5; zoneIndex++) {
        for (const tributes of tributeSets) {
          out.push({
            type,
            payload: {
              playerIndex: seat,
              cardInstanceId: handCard.instanceId,
              zoneIndex,
              ...(tributes.length > 0
                ? { tributeInstanceIds: tributes.map((t) => t.instanceId) }
                : {}),
            },
          });
        }
      }
    }
  }

  // Spell/Trap: Set into each zone; activate each effect of a hand card with every candidate cost selection.
  for (const handCard of me.hand) {
    for (let zoneIndex = 0; zoneIndex < 5; zoneIndex++) {
      out.push({
        type: 'SetSpellTrap',
        payload: { playerIndex: seat, cardInstanceId: handCard.instanceId, zoneIndex },
      });
    }
    const def = ctx.cardDefinitions(handCard.definitionId);
    if (!def || def.kind === 'Monster') continue;
    for (const effect of def.effects ?? []) {
      for (const costInstanceIds of costSelections(effect.cost, handCard, me.hand, ownMonsters)) {
        out.push({
          type: 'ActivateEffect',
          payload: {
            playerIndex: seat,
            cardInstanceId: handCard.instanceId,
            effectId: effect.id,
            ...(costInstanceIds.length > 0 ? { costInstanceIds } : {}),
          },
        });
      }
    }
  }

  for (const monster of ownMonsters) {
    for (const toPosition of ['Attack', 'DefenseUp'] as const) {
      out.push({
        type: 'ChangePosition',
        payload: { playerIndex: seat, cardInstanceId: monster.instanceId, toPosition },
      });
    }
    out.push({
      type: 'DeclareAttack',
      payload: { playerIndex: seat, attackerInstanceId: monster.instanceId },
    });
    for (const target of oppMonsters) {
      out.push({
        type: 'DeclareAttack',
        payload: {
          playerIndex: seat,
          attackerInstanceId: monster.instanceId,
          targetInstanceId: target.instanceId,
        },
      });
    }
  }

  return out;
}

/** Actions `seat` may submit right now: each one is accepted by `applyAction(state, action, ctx)`. Pure; deterministic order. */
export function getLegalActions(state: GameState, seat: Seat, ctx: ActionContext): Action[] {
  if (state.winnerIndex !== null) return [];
  const seen = new Set<string>();
  const legal: Action[] = [];
  for (const candidate of candidates(state, seat, ctx)) {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      applyAction(state, candidate, ctx);
    } catch (error) {
      if (error instanceof EngineError) continue;
      throw error;
    }
    legal.push(candidate);
  }
  return legal;
}
