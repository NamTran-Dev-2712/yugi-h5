import { isContinuousOperationKind, staysOnField } from '@yugi/shared';
import type { ActionContext } from '../actions/types.js';
import { EngineError } from '../errors.js';
import type { GameEvent } from '../events/types.js';
import { resolveAttack } from '../battle/resolve-attack.js';
import type {
  CardInstance,
  ChainLink,
  ChainWindow,
  GameState,
  PlayerState,
  ReactionTo,
  SummonedMonster,
} from '../state/types.js';
import { OPERATION_HANDLERS } from './operations/index.js';
import { scriptFor } from './effect-scripts/registry.js';
import type { OperationContext } from './operations/types.js';
import { targetCandidates } from './targets.js';
import { fireTriggers } from './triggers.js';

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

/**
 * A window with `reactionTo` (and task 4.4 `summoned`) carried over from the current one: a reaction window keeps them
 * until it closes.
 */
function windowFor(
  state: GameState,
  priorityPlayer: 0 | 1,
  passCount: 0 | 1,
): NonNullable<GameState['chainWindow']> {
  const reactionTo = state.chainWindow?.reactionTo;
  const summoned = state.chainWindow?.summoned;
  return {
    priorityPlayer,
    passCount,
    ...(reactionTo ? { reactionTo } : {}),
    ...(summoned ? { summoned } : {}),
  };
}

/**
 * Task 3.4c: after an attack declaration or a Summon/Set, gives `responder` (the opponent of the turn player) an empty
 * window — only if they can activate something [ASSUMED]. Returns the state with the window, or null (nothing to open).
 * Task 4.4: `summoned` = the monster a real Summon (Normal / Tribute / Flip — not a Set) just put on the field.
 */
export function openReactionWindow(
  state: GameState,
  responder: 0 | 1,
  reactionTo: ReactionTo,
  canActivate: CanActivate,
  summoned?: SummonedMonster,
): GameState | null {
  // Asked with the window already open: outside a window only the turn player may activate.
  const opened: GameState = {
    ...state,
    chainWindow: {
      priorityPlayer: responder,
      passCount: 0,
      reactionTo,
      ...(summoned ? { summoned } : {}),
    },
  };
  return canActivate(opened, responder) ? opened : null;
}

/** Pushes `link` on top of the chain and hands priority to the activator's opponent (consecutive passes reset). */
export function pushLink(state: GameState, link: ChainLink): Result {
  const chainStack = [...state.chainStack, link];
  return {
    state: {
      ...state,
      chainStack,
      chainWindow: windowFor(state, other(link.playerIndex), 0),
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

/**
 * The priority holder passes: the second consecutive pass resolves the chain, otherwise priority changes hands.
 * An empty reaction window (task 3.4c) closes on its holder's single pass [ASSUMED] and what it interrupted goes on.
 */
export function passPriority(state: GameState, ctx: ActionContext): Result {
  const window = state.chainWindow;
  if (window === null) return { state, events: [] };
  if (state.chainStack.length === 0) {
    const after = continueAfterWindow({ ...state, chainWindow: null }, window.reactionTo, ctx);
    // Task 3.5: what the window let through (the battle) may fire triggers — a new chain.
    const fired = fireTriggers(after.state, after.events, ctx);
    return { state: fired.state, events: [...after.events, ...fired.events] };
  }
  if (window.passCount === 1) return resolveChain(state, ctx);
  return {
    state: { ...state, chainWindow: windowFor(state, other(window.priorityPlayer), 1) },
    events: [],
  };
}

/** What the closed window interrupted goes on (task 3.4c): an attack proceeds to damage; a Summon needs nothing. */
function continueAfterWindow(
  state: GameState,
  reactionTo: ReactionTo | undefined,
  ctx: ActionContext,
): Result {
  if (reactionTo?.kind !== 'Attack' || state.winnerIndex !== null) return { state, events: [] };
  return resolveAttack(
    state,
    {
      playerIndex: reactionTo.playerIndex,
      attackerInstanceId: reactionTo.attackerInstanceId,
      targetInstanceId: reactionTo.targetInstanceId,
    },
    ctx,
  );
}

/** Auto-passes for every holder that cannot activate anything, until someone can respond or the chain resolved. */
export function settle(state: GameState, ctx: ActionContext, canActivate: CanActivate): Result {
  let current = state;
  const events: GameEvent[] = [];
  // Two auto-passes resolve the chain; triggers fired by it (task 3.5) may open a new one, settled the same way. A
  // trigger prompt stops here: its answer settles again.
  while (
    current.chainWindow !== null &&
    current.pendingPrompt === null &&
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
 * Task 4.3 [RULE]: a Continuous Spell/Trap or Field Spell (read from the card's sub type, `staysOnField`) stays face-up
 * where it is — its Continuous effects hold from now on.
 * Task 4.4 [RULE]: `negated` = the card's activation was negated — it never stays: a Continuous / Field / Equip card
 * that went face-up when it was activated is sent to the graveyard too (so its Continuous effect is gone).
 */
function sendToGraveyard(
  state: GameState,
  link: ChainLink,
  ctx: ActionContext,
  negated = false,
): Result {
  const { source, card } = link;
  // A trigger's card never moved (task 3.5): it stays on the field / in the graveyard.
  if (source.zone === 'MonsterZone' || source.zone === 'Graveyard') return { state, events: [] };
  const definition = ctx.cardDefinitions(card.definitionId);
  if (!negated && definition && staysOnField(definition)) return { state, events: [] };
  const owner = state.players[card.ownerIndex];
  let next: PlayerState;
  if (source.zone === 'FieldZone') {
    // Only a Field Spell is ever activated in the Field Zone, and it stays (above) unless its activation was negated.
    const inField = owner.board.fieldZone;
    if (inField?.instanceId !== card.instanceId) return { state, events: [] };
    next = {
      ...owner,
      graveyard: [...owner.graveyard, toGraveyard(inField)],
      board: { ...owner.board, fieldZone: null },
    };
  } else if (source.zone === 'Hand') {
    next = { ...owner, graveyard: [...owner.graveyard, toGraveyard(card)] };
  } else {
    const inZone = owner.board.spellTrapZones[source.zoneIndex];
    if (inZone?.instanceId !== card.instanceId) return { state, events: [] };
    // Task 4.2c: an Equip Spell that got equipped stays on the field with its monster.
    if (!negated && inZone.equippedTo !== undefined) return { state, events: [] };
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

/**
 * Runs one link's operations against its still-valid targets (or fizzles it). Task 4.4: `below` is the link it answered
 * and `window` the window the chain was built in — what a Negate operation acts on. A link negated by an operation
 * (`ChainLinkNegated`) has its card sent to the graveyard right there.
 */
function resolveLink(
  state: GameState,
  link: ChainLink,
  ctx: ActionContext,
  below: ChainLink | undefined,
  window: ChainWindow | undefined,
): Result {
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
  const opCtx: OperationContext = {
    controller: link.playerIndex,
    targetInstanceIds,
    sourceInstanceId: link.card.instanceId,
    ...(below ? { respondsTo: below } : {}),
    ...(window ? { window } : {}),
  };
  for (const op of effect.operations) {
    if (current.winnerIndex !== null) break; // the duel ended mid-effect: later operations never run
    // Continuous operations never resolve (the schema keeps them out of chainable effects; task 3.6).
    if (isContinuousOperationKind(op.kind)) continue;
    const handler = OPERATION_HANDLERS[op.kind] as (
      s: GameState,
      o: typeof op,
      c: OperationContext,
    ) => { state: GameState; events: GameEvent[] };
    const out = handler(current, op, opCtx);
    current = out.state;
    events.push(...out.events);
    // Task 4.4 [RULE]: a card whose activation was negated goes to the graveyard at once, whatever it is.
    if (
      below &&
      out.events.some((e) => e.type === 'ChainLinkNegated' && e.linkId === below.linkId)
    ) {
      const sent = sendToGraveyard(current, below, ctx, true);
      current = sent.state;
      events.push(...sent.events);
    }
  }
  // Task 3.6: the effect's script runs after its operations (validated at activation, so it is registered).
  const script = effect.scriptId === undefined ? undefined : scriptFor(effect.scriptId);
  if (script && current.winnerIndex === null) {
    const out = script(current, opCtx);
    current = out.state;
    events.push(...out.events);
  }
  events.push({ type: 'EffectResolved', ...base });
  return { state: current, events };
}

/**
 * Resolves every link, top (last activated) first. Each card goes to its owner's graveyard after its link (unless it
 * stays on the field: Equip 4.2c, Continuous/Field 4.3). If the duel
 * ends mid-chain the remaining links do not resolve (their cards still go to the graveyard) and `DuelEnded` is last.
 * Task 4.4: what a Negate operation did is read from the events of the link that ran it (like triggers): a negated link
 * is skipped entirely (its card was already sent to the graveyard, its cost is not refunded [ASSUMED]); a negated
 * attack does not go on once the chain is done.
 */
export function resolveChain(state: GameState, ctx: ActionContext): Result {
  const links = state.chainStack;
  let current: GameState = { ...state, chainStack: [], chainWindow: null };
  const events: GameEvent[] = [];
  const negatedLinkIds = new Set<string>();
  let window: ChainWindow | undefined = state.chainWindow ?? undefined;
  let attackNegated = false;

  for (let i = links.length - 1; i >= 0; i--) {
    const link = links[i]!;
    if (negatedLinkIds.has(link.linkId)) continue;
    if (current.winnerIndex === null) {
      const out = resolveLink(current, link, ctx, links[i - 1], window);
      current = out.state;
      events.push(...out.events);
      for (const event of out.events) {
        if (event.type === 'ChainLinkNegated') negatedLinkIds.add(event.linkId);
        if (event.type === 'AttackNegated' && window) {
          attackNegated = true;
          // A second NegateAttack lower in the same chain finds no attack left to negate.
          const { reactionTo: _negated, ...rest } = window;
          window = rest;
        }
      }
    }
    const spent = sendToGraveyard(current, link, ctx);
    current = spent.state;
    events.push(...spent.events);
  }
  if (current.winnerIndex === null) events.push({ type: 'ChainResolved', linkCount: links.length });

  // Task 3.4c: a chain started in a reaction window lets what it interrupted go on (e.g. the attack reaches damage) —
  // unless that attack was negated (task 4.4).
  const after = continueAfterWindow(
    current,
    attackNegated ? undefined : state.chainWindow?.reactionTo,
    ctx,
  );
  current = after.state;
  events.push(...after.events);

  // Task 3.5: triggers fired while the chain resolved (and by the battle it let through) start a new chain.
  const fired = fireTriggers(current, events, ctx);
  current = fired.state;
  events.push(...fired.events);

  // Keep "the duel is over" as the final word of the batch.
  const ordered = [
    ...events.filter((e) => e.type !== 'DuelEnded'),
    ...events.filter((e) => e.type === 'DuelEnded'),
  ];
  return { state: current, events: ordered };
}
