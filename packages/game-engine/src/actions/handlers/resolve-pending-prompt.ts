import { EngineError } from '../../errors.js';
import type { GameEvent } from '../../events/types.js';
import type { CardInstance, GameState, PendingPrompt, PlayerState } from '../../state/types.js';
import type { ActionContext, ResolvePendingPromptAction } from '../types.js';
import { resolveSelectEffectTarget } from './activate-effect.js';

/** `PendingPrompt.payload` of kind `DiscardToHandLimit`. */
export interface DiscardToHandLimitPayload {
  readonly count: number;
}

/**
 * Answers the current `PendingPrompt`. Generic shell: guards, then dispatch on `prompt.kind`
 * (later prompt kinds — target, chain response — add a case here).
 */
export function applyResolvePendingPrompt(
  state: GameState,
  action: ResolvePendingPromptAction,
  ctx?: ActionContext,
): { state: GameState; events: GameEvent[] } {
  if (state.winnerIndex !== null) {
    throw new EngineError(
      'DUEL_ENDED',
      'ResolvePendingPrompt rejected: the duel has already ended.',
    );
  }
  const prompt = state.pendingPrompt;
  if (prompt === null) {
    throw new EngineError(
      'NO_PENDING_PROMPT',
      'ResolvePendingPrompt rejected: nothing is pending.',
    );
  }
  if (
    prompt.promptId !== action.payload.promptId ||
    prompt.playerIndex !== action.payload.playerIndex
  ) {
    throw new EngineError(
      'PROMPT_MISMATCH',
      'ResolvePendingPrompt rejected: wrong promptId or not the prompted player.',
    );
  }

  switch (prompt.kind) {
    case 'DiscardToHandLimit':
      return resolveDiscardToHandLimit(state, prompt, action);
    case 'SelectEffectTarget':
      return resolveSelectEffectTarget(state, prompt, action, ctx);
    default:
      throw new EngineError(
        'UNKNOWN_PROMPT_KIND',
        `ResolvePendingPrompt rejected: unsupported prompt kind "${prompt.kind}".`,
      );
  }
}

function resolveDiscardToHandLimit(
  state: GameState,
  prompt: PendingPrompt,
  action: ResolvePendingPromptAction,
): { state: GameState; events: GameEvent[] } {
  const { count } = prompt.payload as DiscardToHandLimitPayload;
  const { playerIndex, cardInstanceIds } = action.payload;
  const invalid = (reason: string): never => {
    throw new EngineError('INVALID_DISCARD', `ResolvePendingPrompt rejected: ${reason}`);
  };

  if (cardInstanceIds.length !== count) {
    invalid(`must discard exactly ${count} card(s), got ${cardInstanceIds.length}.`);
  }
  if (new Set(cardInstanceIds).size !== cardInstanceIds.length) {
    invalid('duplicate card ids.');
  }

  const player = state.players[playerIndex];
  const discarded: CardInstance[] = cardInstanceIds.map((id) => {
    const card = player.hand.find((c) => c.instanceId === id);
    return card ?? invalid(`${id} is not in your hand.`);
  });

  const chosen = new Set(cardInstanceIds);
  const nextPlayer: PlayerState = {
    ...player,
    hand: player.hand.filter((c) => !chosen.has(c.instanceId)),
    graveyard: [
      ...player.graveyard,
      ...discarded.map((c): CardInstance => ({ ...c, position: null })),
    ],
  };
  const players: [PlayerState, PlayerState] =
    playerIndex === 0 ? [nextPlayer, state.players[1]] : [state.players[0], nextPlayer];

  return {
    state: { ...state, players, pendingPrompt: null, phase: 'End', version: state.version + 1 },
    events: [
      ...discarded.map((c): GameEvent => ({
        type: 'CardDiscarded',
        playerIndex,
        instanceId: c.instanceId,
        definitionId: c.definitionId,
      })),
      { type: 'PhaseChanged', from: 'Main2', to: 'End', turnPlayerIndex: state.turnPlayerIndex },
    ],
  };
}
