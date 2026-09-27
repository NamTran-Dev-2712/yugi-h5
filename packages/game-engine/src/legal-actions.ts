import type { Action, ActionContext } from './actions/types.js';
import { applyAction } from './apply-action.js';
import { EngineError } from './errors.js';
import {
  activationCandidates,
  combinations,
  MAX_ANSWER_COMBINATIONS,
} from './effects/activation-candidates.js';
import type { CardInstance, GameState } from './state/types.js';

/*
 * `getLegalActions` never re-implements a rule. It (1) enumerates CANDIDATES purely by structure (every hand card ×
 * Summon/Set × zone × tribute subset, every own monster × position / attack target, EndPhase, Surrender, PassPriority, prompt
 * answers) and (2) keeps the candidates that `applyAction` itself accepts (dry run: handlers are pure and throw
 * `EngineError` on rejection). A rule added to the engine is therefore reflected here for free; only a genuinely new
 * KIND of action needs a new candidate generator. Draw/StartDuel are never candidates (server-internal / forbidden).
 */

/** Largest tribute set any card needs (level 7+ → 2, see summon.ts). Candidates are subsets of size 0..this. */
const MAX_TRIBUTES = 2;

type Seat = 0 | 1;

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

  if (prompt && prompt.kind === 'TriggerActivation') {
    // Task 3.5: decline (only an optional trigger accepts it) + every way to pick the targets.
    const payload = prompt.payload as { count?: unknown; candidateInstanceIds?: unknown };
    out.push({
      type: 'ResolvePendingPrompt',
      payload: { playerIndex: seat, promptId: prompt.promptId, cardInstanceIds: [], decline: true },
    });
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

  out.push({ type: 'PassPriority', payload: { playerIndex: seat } });
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
  }
  out.push(...activationCandidates(state, seat, ctx));

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
