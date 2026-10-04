import type { PlayerAction, StateView } from '@yugi/shared';

/**
 * Task 4.5b — the two Fusion prompts as the client reads them. Pure: no rule lives here.
 *
 * Every other choice on the duel screen is picked out of `legalActions` (the server lists each legal answer). A Fusion
 * prompt is answered from its PAYLOAD instead — `candidateInstanceIds` + `count`, both sent by the server — because the
 * engine lists at most 200 material combinations, so a legal one may be missing from the list (ADR 068, 069). This is
 * the ONE exception to "the client only sends an element of `legalActions`", and it is narrow: `isFusionAnswer` accepts
 * nothing but an answer to the Fusion prompt open for the viewer right now, made of exactly `count` different ids out of
 * its candidates. Whether that set of cards is a valid fusion is still decided by the server (a refusal re-opens the
 * selection with the server's message); the client checks no material, no name, no zone.
 */

export type FusionPromptKind = 'SelectFusionMonster' | 'SelectFusionMaterials';

export interface FusionPrompt {
  readonly kind: FusionPromptKind;
  readonly promptId: string;
  /** Ids the server offers, in its order. */
  readonly candidates: readonly string[];
  /** Exactly this many must be chosen. */
  readonly count: number;
}

const isFusionKind = (kind: string): kind is FusionPromptKind =>
  kind === 'SelectFusionMonster' || kind === 'SelectFusionMaterials';

/**
 * The Fusion prompt waiting for the VIEWER, read from the view only. null for any other prompt, a prompt addressed to
 * the other seat (its payload is null anyway), a finished duel, or a payload that is not the expected shape.
 */
export function fusionPromptOf(view: StateView): FusionPrompt | null {
  const prompt = view.pendingPrompt;
  if (!prompt || prompt.playerIndex !== view.viewerIndex || view.winnerIndex !== null) return null;
  if (!isFusionKind(prompt.kind)) return null;
  const payload = prompt.payload;
  if (typeof payload !== 'object' || payload === null) return null;
  const { candidateInstanceIds, count } = payload as Record<string, unknown>;
  if (!Array.isArray(candidateInstanceIds) || typeof count !== 'number') return null;
  const candidates = candidateInstanceIds.filter((id): id is string => typeof id === 'string');
  if (!Number.isInteger(count) || count < 1 || candidates.length < count) return null;
  return { kind: prompt.kind, promptId: prompt.promptId, candidates, count };
}

/** The answer to `prompt` with the chosen ids (the wire action; the server validates it). */
export function fusionAnswer(
  view: StateView,
  prompt: FusionPrompt,
  selected: readonly string[],
): PlayerAction {
  return {
    type: 'ResolvePendingPrompt',
    payload: {
      playerIndex: view.viewerIndex,
      promptId: prompt.promptId,
      cardInstanceIds: [...selected],
    },
  };
}

/**
 * True when `action` answers the Fusion prompt open for the viewer with exactly `count` different candidates and
 * nothing else (no `decline`, no other key). See the note at the top: the one action that may be sent without being
 * listed in `legalActions`.
 */
export function isFusionAnswer(view: StateView, action: PlayerAction): boolean {
  const prompt = fusionPromptOf(view);
  if (prompt === null || action.type !== 'ResolvePendingPrompt') return false;
  const { playerIndex, promptId, cardInstanceIds, ...rest } = action.payload;
  if (Object.keys(rest).length > 0) return false;
  if (playerIndex !== view.viewerIndex || promptId !== prompt.promptId) return false;
  if (cardInstanceIds.length !== prompt.count) return false;
  if (new Set(cardInstanceIds).size !== cardInstanceIds.length) return false;
  return cardInstanceIds.every((id) => prompt.candidates.includes(id));
}

/** Where a material candidate is, for the label under it in the picker: read from the viewer's own zones in the view. */
export type FusionSource = 'hand' | 'field';

export function fusionSourceOf(view: StateView, instanceId: string): FusionSource | null {
  const own = view.players[view.viewerIndex];
  if (own.hand.some((c) => c.instanceId === instanceId)) return 'hand';
  if (own.board.monsterZones.some((c) => c?.instanceId === instanceId)) return 'field';
  return null;
}
