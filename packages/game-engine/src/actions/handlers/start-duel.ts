import { createRng, shuffle } from '../../rng/seeded-rng.js';
import type { CardInstance, GameState, PlayerState } from '../../state/types.js';
import type { GameEvent } from '../../events/types.js';
import type { StartDuelAction } from '../types.js';

const OPENING_HAND_SIZE = 5;
const STARTING_LIFE_POINTS = 8000;

function buildDeck(playerIndex: 0 | 1, definitionIds: readonly string[]): CardInstance[] {
  return definitionIds.map((definitionId, i) => ({
    instanceId: `p${playerIndex}-${i}`,
    definitionId,
    position: null,
    ownerIndex: playerIndex,
  }));
}

function emptyBoard(): PlayerState['board'] {
  return {
    monsterZones: [null, null, null, null, null],
    spellTrapZones: [null, null, null, null, null],
    fieldZone: null,
  };
}

export function applyStartDuel(action: StartDuelAction): { state: GameState; events: GameEvent[] } {
  const { matchId, seed, playerIds, deckLists } = action.payload;

  let rng = createRng(seed);
  const players: PlayerState[] = [];
  const events: GameEvent[] = [];

  for (const playerIndex of [0, 1] as const) {
    const rawDeck = buildDeck(playerIndex, deckLists[playerIndex]);
    const [shuffledDeck, nextRng] = shuffle(rng, rawDeck);
    rng = nextRng;

    const hand = shuffledDeck.slice(0, OPENING_HAND_SIZE);
    const deck = shuffledDeck.slice(OPENING_HAND_SIZE);

    for (const card of hand) {
      events.push({
        type: 'CardDrawn',
        playerIndex,
        instanceId: card.instanceId,
        definitionId: card.definitionId,
      });
    }

    players.push({
      playerId: playerIds[playerIndex],
      lifePoints: STARTING_LIFE_POINTS,
      board: emptyBoard(),
      hand,
      deck,
      graveyard: [],
      banished: [],
      extraDeck: [],
      hasNormalSummonedThisTurn: false,
    });
  }

  const turnPlayerIndex: 0 | 1 = 0;
  events.unshift({ type: 'DuelStarted', matchId, turnPlayerIndex });

  const state: GameState = {
    matchId,
    rng,
    turnCount: 1,
    turnPlayerIndex,
    phase: 'Draw',
    players: [players[0]!, players[1]!],
    chainStack: [],
    pendingPrompt: null,
    winnerIndex: null,
    version: 1,
  };

  return { state, events };
}
