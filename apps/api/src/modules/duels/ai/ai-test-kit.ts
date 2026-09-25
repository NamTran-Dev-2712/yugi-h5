import {
  applyAction,
  getLegalActions,
  type ActionContext,
  type CardInstance,
  type GameState,
  type Phase,
} from '@yugi/game-engine';
import type { CardDefinition, PlayerAction, StateView } from '@yugi/shared';
import { toStateView } from '../state-view';

/** Test-only helpers: build engine states with a chosen board, then look at them through the AI's eyes. */

export const AI_SEAT = 1 as const;

function mon(id: string, level: number, atk: number, def: number): CardDefinition {
  return {
    id,
    kind: 'Monster',
    name: { vi: `AI ${id}`, en: `AI ${id}` },
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level,
    atk,
    def,
  };
}

export const AI_DEFS: Readonly<Record<string, CardDefinition>> = {
  A1000: mon('A1000', 3, 1000, 800),
  A1500: mon('A1500', 4, 1500, 500),
  A1900: mon('A1900', 4, 1900, 1000),
  A2000: mon('A2000', 4, 2000, 1200),
  D2000: mon('D2000', 4, 800, 2000),
  T2400: mon('T2400', 5, 2400, 1000),
  T2600: mon('T2600', 6, 2600, 1000),
  H3000: mon('H3000', 7, 3000, 2000),
  SP: { id: 'SP', kind: 'Spell', name: { vi: 'AI Spell', en: 'AI Spell' }, subType: 'Normal' },
};
export const aiCtx: ActionContext = { cardDefinitions: (id) => AI_DEFS[id] };

const card = (
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1,
  extra: Partial<CardInstance> = {},
): CardInstance => ({ instanceId, definitionId, position: null, ownerIndex, ...extra });

export interface FieldMon {
  readonly def: string;
  readonly position?: CardInstance['position'];
  readonly zone?: number;
  /** Turn stamp; default 0 = "has been there a while" so it may attack/change position. */
  readonly summonedTurn?: number;
}

export interface Scenario {
  /** Definition ids in the AI hand. */
  readonly hand?: readonly string[];
  readonly phase?: Phase;
  readonly mine?: readonly FieldMon[];
  readonly theirs?: readonly FieldMon[];
  /** The opponent's hand (hidden information; the metamorphic test varies it). */
  readonly theirHand?: readonly string[];
  readonly theirDeck?: readonly string[];
  readonly normalSummoned?: boolean;
  readonly turnCount?: number;
  readonly pendingDiscard?: number;
}

function zonesOf(prefix: string, owner: 0 | 1, mons: readonly FieldMon[] = []) {
  const zones: (CardInstance | null)[] = [null, null, null, null, null];
  mons.forEach((m, i) => {
    zones[m.zone ?? i] = card(`${prefix}${i}`, m.def, owner, {
      position: m.position ?? 'Attack',
      summonedTurn: m.summonedTurn ?? 0,
    });
  });
  return zones as unknown as GameState['players'][0]['board']['monsterZones'];
}

/** The AI (seat 1) is on turn with the given hand/board; seat 0 is the human. */
export function buildState(s: Scenario = {}): GameState {
  const started = applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'ai-kit',
      seed: 'ai-kit-seed',
      playerIds: ['human', 'ai'],
      deckLists: [
        Array.from({ length: 40 }, () => 'A1000'),
        Array.from({ length: 40 }, () => 'A1000'),
      ],
    },
  }).state;
  const [p0, p1] = started.players;
  const theirDeck = s.theirDeck?.map((d, i) => card(`hd${i}`, d, 0));
  return {
    ...started,
    phase: s.phase ?? 'Main1',
    turnCount: s.turnCount ?? 4,
    turnPlayerIndex: AI_SEAT,
    pendingPrompt:
      s.pendingDiscard !== undefined
        ? {
            promptId: 'discard-4',
            playerIndex: AI_SEAT,
            kind: 'DiscardToHandLimit',
            payload: { count: s.pendingDiscard },
          }
        : null,
    players: [
      {
        ...p0,
        hand: (s.theirHand ?? ['A1000']).map((d, i) => card(`hh${i}`, d, 0)),
        ...(theirDeck ? { deck: theirDeck } : {}),
        board: { ...p0.board, monsterZones: zonesOf('t', 0, s.theirs) },
      },
      {
        ...p1,
        hand: (s.hand ?? []).map((d, i) => card(`m${i}`, d, 1)),
        hasNormalSummonedThisTurn: s.normalSummoned ?? false,
        board: { ...p1.board, monsterZones: zonesOf('o', 1, s.mine) },
      },
    ],
  };
}

export interface AiSituation {
  readonly state: GameState;
  readonly view: StateView;
  readonly legalActions: readonly PlayerAction[];
}

export function situation(state: GameState, seat: 0 | 1 = AI_SEAT): AiSituation {
  return {
    state,
    view: toStateView(state, seat),
    legalActions: getLegalActions(state, seat, aiCtx).filter(
      (a) => a.type !== 'StartDuel' && a.type !== 'Draw',
    ) as unknown as PlayerAction[],
  };
}

export const scenario = (s: Scenario = {}): AiSituation => situation(buildState(s));
