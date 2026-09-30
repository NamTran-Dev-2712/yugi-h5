import {
  effectiveStats,
  type CardInstance,
  type ChainLink,
  type GameState,
  type PendingPrompt,
  type PlayerState,
} from '@yugi/game-engine';
import type {
  BoardView,
  CardDefinition,
  CardView,
  ChainLinkView,
  ChainWindowView,
  HiddenCardView,
  PendingPromptView,
  PlayerView,
  StateView,
  VisibleCardView,
} from '@yugi/shared';
import { hiddenIdsFor, visibleIds } from './visibility';

const visible = (c: CardInstance): VisibleCardView => ({
  hidden: false,
  instanceId: c.instanceId,
  definitionId: c.definitionId,
  position: c.position,
  ownerIndex: c.ownerIndex,
});

const hiddenCard = (c: CardInstance): HiddenCardView => ({
  hidden: true,
  instanceId: c.instanceId,
  ownerIndex: c.ownerIndex,
});

export type CardResolver = (definitionId: string) => CardDefinition | undefined;

/**
 * Monsters are face-down iff `DefenseDown`. A face-up monster also carries its effective ATK/DEF (task 3.4b: printed
 * stats + every Continuous modifier, computed by the engine); face-down ones never do, not even for their owner.
 */
const monsterView = (
  state: GameState,
  c: CardInstance | null,
  isOwner: boolean,
  cardDefinitions: CardResolver,
): CardView | null => {
  if (c === null) return null;
  if (c.position === 'DefenseDown') return isOwner ? visible(c) : hiddenCard(c);
  // An unknown/non-monster definition cannot have stats (the engine would throw): leave them out.
  if (cardDefinitions(c.definitionId)?.kind !== 'Monster') return visible(c);
  const stats = effectiveStats(state, c, { cardDefinitions });
  return { ...visible(c), effectiveStats: { atk: stats.atk, def: stats.def } };
};

/**
 * Spell/Trap/Field: `SetSpellTrap` (task 3.2) places them as `DefenseDown` = face-down; an activated Normal Spell goes
 * straight to the graveyard and never sits face-up. Fail closed: the opponent only sees one when it carries an
 * explicit face-up position. [ASSUMED] revisit at task 3.4 (face-up Continuous/activated Traps).
 */
const backrowView = (
  state: GameState,
  c: CardInstance | null,
  isOwner: boolean,
): CardView | null => {
  if (c === null) return null;
  const faceUp = c.position === 'Attack' || c.position === 'DefenseUp';
  if (!faceUp) return isOwner ? visible(c) : hiddenCard(c);
  const equippedTo = equipTarget(state, c);
  return equippedTo === null ? visible(c) : { ...visible(c), equippedTo };
};

/**
 * Task 4.2d: the monster a FACE-UP Equip card is equipped to, only when that monster is face-up in a Monster Zone (either
 * side). Deny by default: anything else (no link, the monster gone or face-down) sends nothing.
 */
function equipTarget(state: GameState, c: CardInstance): string | null {
  const id = c.equippedTo;
  if (id === undefined) return null;
  for (const p of state.players) {
    const m = p.board.monsterZones.find((z) => z?.instanceId === id);
    if (m) return m.position === 'Attack' || m.position === 'DefenseUp' ? id : null;
  }
  return null;
}

function mapFive<T, R>(zones: readonly [T, T, T, T, T], fn: (t: T) => R): [R, R, R, R, R] {
  return [fn(zones[0]), fn(zones[1]), fn(zones[2]), fn(zones[3]), fn(zones[4])];
}

function toPlayerView(
  state: GameState,
  p: PlayerState,
  isOwner: boolean,
  cardDefinitions: CardResolver,
): PlayerView {
  const board: BoardView = {
    monsterZones: mapFive(p.board.monsterZones, (c) =>
      monsterView(state, c, isOwner, cardDefinitions),
    ),
    spellTrapZones: mapFive(p.board.spellTrapZones, (c) => backrowView(state, c, isOwner)),
    fieldZone: backrowView(state, p.board.fieldZone, isOwner),
  };
  return {
    playerId: p.playerId,
    lifePoints: p.lifePoints,
    hand: p.hand.map((c) => (isOwner ? visible(c) : hiddenCard(c))),
    handCount: p.hand.length,
    deckCount: p.deck.length,
    extraDeckCount: p.extraDeck.length,
    graveyard: p.graveyard.map(visible),
    banished: p.banished.map(visible),
    board,
    hasNormalSummonedThisTurn: p.hasNormalSummonedThisTurn,
  };
}

/** Prompt kinds whose payload the NON-prompted player may see. Anything else (incl. future kinds) is denied. */
const PUBLIC_PROMPT_KINDS: ReadonlySet<string> = new Set(['DiscardToHandLimit']);

/**
 * The prompted player gets the prompt as is. The other player gets it too (so a client can say "the opponent is
 * choosing"), but its payload only for a kind classified public: e.g. a `SelectEffectTarget` payload would tell which
 * hand card is being activated before it is revealed.
 */
function promptView(prompt: PendingPrompt | null, viewerIndex: 0 | 1): PendingPromptView | null {
  if (prompt === null) return null;
  if (prompt.playerIndex === viewerIndex || PUBLIC_PROMPT_KINDS.has(prompt.kind)) return prompt;
  return { ...prompt, payload: null };
}

/**
 * A chain link is public to both seats (task 3.4b): activating revealed the card — from the hand it now lives in the
 * link, a Set card was flipped face-up, a trigger's card is face-up on the field or in the graveyard. Cost ids and LP
 * paid stay server-side (the costs were public events already; the client does not need them). Task 4.2d: targets the
 * viewer may not be pointed at (a hand card chosen by a Special Summon) are left out for that viewer only.
 */
const chainLinkView = (link: ChainLink, hidden: ReadonlySet<string>): ChainLinkView => ({
  linkId: link.linkId,
  playerIndex: link.playerIndex,
  card: visible(link.card),
  source: link.source,
  effectId: link.effectId,
  spellSpeed: link.spellSpeed,
  targetInstanceIds: visibleIds(link.targetInstanceIds, hidden),
});

const chainWindowView = (w: GameState['chainWindow']): ChainWindowView | null =>
  w === null
    ? null
    : {
        priorityPlayer: w.priorityPlayer,
        passCount: w.passCount,
        ...(w.reactionTo ? { reactionTo: w.reactionTo } : {}),
      };

/**
 * Filters the full server-side GameState down to what `viewerIndex` may see. Pure. Every payload
 * sent to a client must go through this (never the raw GameState). Deliberately omits `rng`; the chain is sent
 * in its public form. `cardDefinitions` is needed for the effective ATK/DEF of face-up monsters. Event filtering is
 * NOT done here.
 */
export function toStateView(
  state: GameState,
  viewerIndex: 0 | 1,
  cardDefinitions: CardResolver,
): StateView {
  const hidden = hiddenIdsFor(state, viewerIndex);
  return {
    matchId: state.matchId,
    version: state.version,
    viewerIndex,
    ruleset: state.ruleset,
    turnCount: state.turnCount,
    turnPlayerIndex: state.turnPlayerIndex,
    phase: state.phase,
    winnerIndex: state.winnerIndex,
    pendingPrompt: promptView(state.pendingPrompt, viewerIndex),
    chain: state.chainStack.map((link) => chainLinkView(link, hidden)),
    chainWindow: chainWindowView(state.chainWindow),
    players: [
      toPlayerView(state, state.players[0], viewerIndex === 0, cardDefinitions),
      toPlayerView(state, state.players[1], viewerIndex === 1, cardDefinitions),
    ],
  };
}
