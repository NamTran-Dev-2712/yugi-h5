import type { ActionContext } from '../actions/types.js';
import { EngineError } from '../errors.js';
import type { GameEvent } from '../events/types.js';
import type { CardInstance, ChainLink, GameState, PlayerState } from '../state/types.js';
import { OPERATION_HANDLERS } from './operations/index.js';
import type { OperationContext } from './operations/types.js';
import { targetCandidates } from './targets.js';

/*
 * Chain stack (task 3.3), pure helpers. [RULE] a new link gives priority to the activator's opponent; two consecutive
 * passes resolve the WHOLE chain LIFO (no new links during resolution) and close the window. [ASSUMED] a holder with no
 * legal activation passes automatically, so the window only waits on a player who can actually respond.
 * None of these bump `version` — the calling action does, once.
 */

type Result = { state: GameState; events: GameEvent[] };

/** "May `seat` activate something right now?" — injected by the activation handler (dry run, no rule copy here). */
export type CanActivate = (state: GameState, seat: 0 | 1) => boolean;

const other = (seat: 0 | 1): 0 | 1 => (seat === 0 ? 1 : 0);

/** Pushes `link` on top of the chain and hands priority to the activator's opponent (consecutive passes reset). */
export function pushLink(state: GameState, link: ChainLink): Result {
  const chainStack = [...state.chainStack, link];
  return {
    state: {
      ...state,
      chainStack,
      chainWindow: { priorityPlayer: other(link.playerIndex), passCount: 0 },
    },
    events: [
      {
        type: 'ChainLinkAdded',
        linkId: link.linkId,
        chainIndex: chainStack.length,
        playerIndex: link.playerIndex,
        instanceId: link.card.instanceId,
        definitionId: link.card.definitionId,
        effectId: link.effectId,
        spellSpeed: link.spellSpeed,
        targetInstanceIds: link.targetInstanceIds,
      },
    ],
  };
}

/** The priority holder passes: the second consecutive pass resolves the chain, otherwise priority changes hands. */
export function passPriority(state: GameState, ctx: ActionContext): Result {
  const window = state.chainWindow;
  if (window === null) return { state, events: [] };
  if (window.passCount === 1) return resolveChain(state, ctx);
  return {
    state: {
      ...state,
      chainWindow: { priorityPlayer: other(window.priorityPlayer), passCount: 1 },
    },
    events: [],
  };
}

/** Auto-passes for every holder that cannot activate anything, until someone can respond or the chain resolved. */
export function settle(state: GameState, ctx: ActionContext, canActivate: CanActivate): Result {
  let current = state;
  const events: GameEvent[] = [];
  // At most two iterations: after two auto-passes the chain has resolved (window null).
  while (
    current.chainWindow !== null &&
    !canActivate(current, current.chainWindow.priorityPlayer)
  ) {
    const out = passPriority(current, ctx);
    current = out.state;
    events.push(...out.events);
  }
  return { state: current, events };
}

const toGraveyard = (c: CardInstance): CardInstance => ({
  instanceId: c.instanceId,
  definitionId: c.definitionId,
  ownerIndex: c.ownerIndex,
  position: null,
});

/**
 * After its link, the activated card goes to its owner's graveyard: from the link itself (activated from the hand), or
 * out of its Spell/Trap Zone. A Set card that already left its zone mid-chain (destroyed) is not sent again.
 */
function sendToGraveyard(state: GameState, link: ChainLink): Result {
  const { source, card } = link;
  const owner = state.players[card.ownerIndex];
  let next: PlayerState;
  if (source.zone === 'Hand') {
    next = { ...owner, graveyard: [...owner.graveyard, toGraveyard(card)] };
  } else {
    const inZone = owner.board.spellTrapZones[source.zoneIndex];
    if (inZone?.instanceId !== card.instanceId) return { state, events: [] };
    next = {
      ...owner,
      graveyard: [...owner.graveyard, toGraveyard(inZone)],
      board: {
        ...owner.board,
        spellTrapZones: owner.board.spellTrapZones.map((slot, i) =>
          i === source.zoneIndex ? null : slot,
        ) as unknown as PlayerState['board']['spellTrapZones'],
      },
    };
  }
  return {
    state: {
      ...state,
      players: card.ownerIndex === 0 ? [next, state.players[1]] : [state.players[0], next],
    },
    events: [
      {
        type: 'CardSentToGraveyard',
        ownerIndex: card.ownerIndex,
        instanceId: card.instanceId,
        definitionId: card.definitionId,
        from: source.zone,
      },
    ],
  };
}

/** Runs one link's operations against its still-valid targets (or fizzles it). */
function resolveLink(state: GameState, link: ChainLink, ctx: ActionContext): Result {
  const base = {
    linkId: link.linkId,
    playerIndex: link.playerIndex,
    instanceId: link.card.instanceId,
    definitionId: link.card.definitionId,
    effectId: link.effectId,
  };
  const effect = ctx
    .cardDefinitions(link.card.definitionId)
    ?.effects?.find((e) => e.id === link.effectId);
  // The effect was validated at activation and card data is static, so this only guards a broken resolver.
  if (!effect)
    throw new EngineError(
      'CARD_DEFINITION_NOT_FOUND',
      `chain link ${link.linkId}: effect "${link.effectId}" of "${link.card.definitionId}" not found.`,
    );

  let targetInstanceIds: readonly string[] = [];
  if (effect.target?.kind === 'Card') {
    // [ASSUMED] targets that left their zone (or no longer qualify) are dropped; with none left the link has no effect.
    const stillValid = new Set(targetCandidates(state, link.playerIndex, effect.target, ctx));
    targetInstanceIds = link.targetInstanceIds.filter((id) => stillValid.has(id));
    if (targetInstanceIds.length === 0) {
      return { state, events: [{ type: 'ChainLinkFizzled', ...base, reason: 'TARGET_GONE' }] };
    }
  }

  let current = state;
  const events: GameEvent[] = [];
  const opCtx: OperationContext = { controller: link.playerIndex, targetInstanceIds };
  for (const op of effect.operations) {
    if (current.winnerIndex !== null) break; // the duel ended mid-effect: later operations never run
    const handler = OPERATION_HANDLERS[op.kind] as (
      s: GameState,
      o: typeof op,
      c: OperationContext,
    ) => { state: GameState; events: GameEvent[] };
    const out = handler(current, op, opCtx);
    current = out.state;
    events.push(...out.events);
  }
  events.push({ type: 'EffectResolved', ...base });
  return { state: current, events };
}

/**
 * Resolves every link, top (last activated) first. Each card goes to its owner's graveyard after its link. If the duel
 * ends mid-chain the remaining links do not resolve (their cards still go to the graveyard) and `DuelEnded` is last.
 */
export function resolveChain(state: GameState, ctx: ActionContext): Result {
  const links = state.chainStack;
  let current: GameState = { ...state, chainStack: [], chainWindow: null };
  const events: GameEvent[] = [];

  for (let i = links.length - 1; i >= 0; i--) {
    const link = links[i]!;
    if (current.winnerIndex === null) {
      const out = resolveLink(current, link, ctx);
      current = out.state;
      events.push(...out.events);
    }
    const spent = sendToGraveyard(current, link);
    current = spent.state;
    events.push(...spent.events);
  }
  if (current.winnerIndex === null) events.push({ type: 'ChainResolved', linkCount: links.length });

  // Keep "the duel is over" as the final word of the batch.
  const ordered = [
    ...events.filter((e) => e.type !== 'DuelEnded'),
    ...events.filter((e) => e.type === 'DuelEnded'),
  ];
  return { state: current, events: ordered };
}
