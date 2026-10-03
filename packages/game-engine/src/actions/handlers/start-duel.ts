import { resolveRuleset } from '@yugi/shared';
import { EngineError } from '../../errors.js';
import { createRng, shuffle } from '../../rng/seeded-rng.js';
import type { CardInstance, GameState, PlayerState } from '../../state/types.js';
import type { GameEvent } from '../../events/types.js';
import type { StartDuelAction } from '../types.js';

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
  const ruleset = resolveRuleset(action.payload.ruleset);
  const startingLP = action.payload.startingLP ?? [ruleset.startingLP, ruleset.startingLP];
  for (const lp of startingLP) {
    if (!Number.isInteger(lp) || lp < 1) {
      throw new EngineError(
        'INVALID_STARTING_LP',
        `Invalid startingLP override: ${lp} (expected an integer >= 1).`,
      );
    }
  }

  // Task 4.5: the Extra Deck is built as listed — no shuffle, no rng, no event — so a duel without one is unchanged.
  const extraDeckLists = action.payload.extraDeckLists ?? [[], []];
  for (const list of extraDeckLists) {
    if (list.length > ruleset.extraDeckSize) {
      throw new EngineError(
        'INVALID_EXTRA_DECK',
        `Extra Deck of ${list.length} cards exceeds the limit of ${ruleset.extraDeckSize}.`,
      );
    }
  }

  let rng = createRng(seed);
  const players: PlayerState[] = [];
  const events: GameEvent[] = [];

  for (const playerIndex of [0, 1] as const) {
    const rawDeck = buildDeck(playerIndex, deckLists[playerIndex]);
    const [shuffledDeck, nextRng] = shuffle(rng, rawDeck);
    rng = nextRng;

    const hand = shuffledDeck.slice(0, ruleset.openingHandSize);
    const deck = shuffledDeck.slice(ruleset.openingHandSize);

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
      lifePoints: startingLP[playerIndex],
      board: emptyBoard(),
      hand,
      deck,
      graveyard: [],
      banished: [],
      extraDeck: extraDeckLists[playerIndex].map((definitionId, i) => ({
        instanceId: `p${playerIndex}-x${i}`,
        definitionId,
        position: null,
        ownerIndex: playerIndex,
      })),
      hasNormalSummonedThisTurn: false,
    });
  }

  const turnPlayerIndex: 0 | 1 = 0;
  events.unshift({ type: 'DuelStarted', matchId, turnPlayerIndex });

  const state: GameState = {
    matchId,
    rng,
    ruleset,
    turnCount: 1,
    turnPlayerIndex,
    phase: 'Draw',
    players: [players[0]!, players[1]!],
    chainStack: [],
    chainWindow: null,
    pendingPrompt: null,
    winnerIndex: null,
    version: 1,
  };

  return { state, events };
}
