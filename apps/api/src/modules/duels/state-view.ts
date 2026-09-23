import type { CardInstance, GameState, PlayerState } from '@yugi/game-engine';
import type {
  BoardView,
  CardView,
  HiddenCardView,
  PlayerView,
  StateView,
  VisibleCardView,
} from '@yugi/shared';

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

/** Monsters are face-down iff `DefenseDown`. */
const monsterView = (c: CardInstance | null, isOwner: boolean): CardView | null => {
  if (c === null) return null;
  return isOwner || c.position !== 'DefenseDown' ? visible(c) : hiddenCard(c);
};

/**
 * Spell/Trap/Field: the engine has no face-up marker for them yet (no handler places them, P3),
 * so fail closed — the opponent only sees one when it carries an explicit face-up position.
 * [ASSUMED] revisit at task 3.4 when Set Spell/Trap exists.
 */
const backrowView = (c: CardInstance | null, isOwner: boolean): CardView | null => {
  if (c === null) return null;
  return isOwner || c.position === 'Attack' || c.position === 'DefenseUp'
    ? visible(c)
    : hiddenCard(c);
};

function mapFive<T, R>(zones: readonly [T, T, T, T, T], fn: (t: T) => R): [R, R, R, R, R] {
  return [fn(zones[0]), fn(zones[1]), fn(zones[2]), fn(zones[3]), fn(zones[4])];
}

function toPlayerView(p: PlayerState, isOwner: boolean): PlayerView {
  const board: BoardView = {
    monsterZones: mapFive(p.board.monsterZones, (c) => monsterView(c, isOwner)),
    spellTrapZones: mapFive(p.board.spellTrapZones, (c) => backrowView(c, isOwner)),
    fieldZone: backrowView(p.board.fieldZone, isOwner),
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

/**
 * Filters the full server-side GameState down to what `viewerIndex` may see. Pure. Every payload
 * sent to a client must go through this (never the raw GameState). Deliberately omits `rng` and
 * `chainStack`. Event filtering is NOT done here.
 */
export function toStateView(state: GameState, viewerIndex: 0 | 1): StateView {
  return {
    matchId: state.matchId,
    version: state.version,
    viewerIndex,
    ruleset: state.ruleset,
    turnCount: state.turnCount,
    turnPlayerIndex: state.turnPlayerIndex,
    phase: state.phase,
    winnerIndex: state.winnerIndex,
    pendingPrompt: state.pendingPrompt,
    players: [
      toPlayerView(state.players[0], viewerIndex === 0),
      toPlayerView(state.players[1], viewerIndex === 1),
    ],
  };
}
