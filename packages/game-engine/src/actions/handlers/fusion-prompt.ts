import { EngineError } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import { finishFusionLink, settle } from '../../effects/chain.js';
import {
  applyFusion,
  chosenMaterials,
  fusionOperationOf,
  fusionOptions,
  type FusionOption,
  type FusionSummonOperation,
  type SelectFusionMaterialsPayload,
  type SelectFusionMonsterPayload,
} from '../../effects/operations/fusion-summon.js';
import type { ChainLink, GameState, PendingPrompt } from '../../state/types.js';
import type { ActionContext, ResolvePendingPromptAction } from '../types.js';
import { hasLegalActivation } from './activate-effect.js';

/*
 * Task 4.5 — the two prompts of a Fusion Summon, asked while its chain link resolves (`effects/chain.ts` paused the
 * chain on it): `SelectFusionMonster` (1 Fusion Monster of the Extra Deck), then `SelectFusionMaterials` (its
 * materials). Every answer is re-checked against the current state; a bad one is `INVALID_EFFECT_TARGET` and leaves the
 * prompt open. `version` +1 per answer.
 */

type Result = { state: GameState; events: GameEvent[] };

const bad = (reason: string): never => {
  throw new EngineError('INVALID_EFFECT_TARGET', `ResolvePendingPrompt rejected: ${reason}`);
};

function requireContext(ctx: ActionContext | undefined): ActionContext {
  if (!ctx)
    throw new EngineError(
      'NO_CARD_RESOLVER',
      'ResolvePendingPrompt needs an ActionContext with cardDefinitions.',
    );
  return ctx;
}

/** The paused link and what its controller can still make. The state did not change since the chain paused. */
function pausedFusion(
  state: GameState,
  linkId: string,
  ctx: ActionContext,
): { link: ChainLink; op: FusionSummonOperation; options: FusionOption[] } {
  const link = state.chainStack.find((l) => l.linkId === linkId);
  const effect = link
    ? ctx.cardDefinitions(link.card.definitionId)?.effects?.find((e) => e.id === link.effectId)
    : undefined;
  const op = effect ? fusionOperationOf(effect) : undefined;
  // Only a corrupted prompt gets here.
  if (!link || !op) return bad('no Fusion Summon is resolving.');
  return { link, op, options: fusionOptions(state, link.playerIndex, op, ctx) };
}

/** Answer to `SelectFusionMonster`: exactly 1 candidate. Opens `SelectFusionMaterials` for it; nothing moves yet. */
export function resolveSelectFusionMonster(
  state: GameState,
  prompt: PendingPrompt,
  action: ResolvePendingPromptAction,
  ctx: ActionContext | undefined,
): Result {
  const saved = prompt.payload as SelectFusionMonsterPayload;
  const { options } = pausedFusion(state, saved.linkId, requireContext(ctx));
  const chosen = action.payload.cardInstanceIds;
  if (chosen.length !== 1) bad(`choose exactly 1 Fusion Monster, got ${chosen.length}.`);
  const option = options.find((o) => o.fusion.instanceId === chosen[0]);
  if (!option) return bad(`${chosen[0]} cannot be Fusion Summoned right now.`);

  const payload: SelectFusionMaterialsPayload = {
    linkId: saved.linkId,
    fusionInstanceId: option.fusion.instanceId,
    candidateInstanceIds: option.candidates.map((c) => c.card.instanceId),
    count: option.materials.length,
    owedTriggers: saved.owedTriggers,
    linkCount: saved.linkCount,
  };
  const next: PendingPrompt = {
    promptId: `fusion-${state.turnCount}-${state.version}`,
    playerIndex: prompt.playerIndex,
    kind: 'SelectFusionMaterials',
    payload,
  };
  return { state: { ...state, pendingPrompt: next, version: state.version + 1 }, events: [] };
}

/**
 * Answer to `SelectFusionMaterials`: one card per material of the chosen Fusion Monster. The Fusion Summon happens, the
 * paused chain ends, then the owed triggers and the Summon's own go on a new chain and priority is settled.
 */
export function resolveSelectFusionMaterials(
  state: GameState,
  prompt: PendingPrompt,
  action: ResolvePendingPromptAction,
  ctx: ActionContext | undefined,
): Result {
  const context = requireContext(ctx);
  const saved = prompt.payload as SelectFusionMaterialsPayload;
  const { link, op, options } = pausedFusion(state, saved.linkId, context);
  const option = options.find((o) => o.fusion.instanceId === saved.fusionInstanceId);
  if (!option) return bad(`${saved.fusionInstanceId} cannot be Fusion Summoned any more.`);
  const materials = chosenMaterials(
    state,
    link.playerIndex,
    option,
    action.payload.cardInstanceIds,
  );
  if (materials === null)
    return bad(
      `choose ${option.materials.length} different cards, one per material, leaving an empty Monster Zone.`,
    );

  const base: GameState = { ...state, pendingPrompt: null };
  const fused = applyFusion(base, link.playerIndex, op, option.fusion, materials);
  const finished = finishFusionLink(
    fused.state,
    fused.events,
    saved.owedTriggers,
    saved.linkCount,
    context,
  );
  const settled = settle(finished.state, context, (s, seat) =>
    hasLegalActivation(s, seat, context),
  );
  return {
    state: { ...settled.state, version: state.version + 1 },
    events: [...finished.events, ...settled.events],
  };
}
