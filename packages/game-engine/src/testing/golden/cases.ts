import type { CardDefinition } from '@yugi/shared';
import type { Action } from '../../actions/types.js';
import type { GoldenCase } from './replay.js';

function monster(id: string, level: number, atk: number, def: number): CardDefinition {
  return {
    id,
    kind: 'Monster',
    name: { vi: `Golden ${id}`, en: `Golden ${id}` },
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level,
    atk,
    def,
  };
}

/** Placeholder cards only (no official names). */
export const GOLDEN_DEFS: Readonly<Record<string, CardDefinition>> = {
  M1000: monster('M1000', 4, 1000, 1000),
  M1800: monster('M1800', 4, 1800, 600),
  L5: monster('L5', 5, 2100, 1500),
};

const MIXED_DECK = Array.from({ length: 40 }, (_, i) => ['M1000', 'M1800', 'L5'][i % 3]!);

const endPhase = (playerIndex: 0 | 1, times = 1): Action[] =>
  Array.from({ length: times }, () => ({ type: 'EndPhase', payload: { playerIndex } }));

/*
 * Turn shape reminder (6 EndPhase per full turn): Draw→Standby (draws unless turn 1), Standby→Main1,
 * [Main1 actions], Main1→Battle, [Battle actions], Battle→Main2, Main2→End, End→next turn.
 * Instance ids (`p<player>-<n>`) depend on the seeded shuffle; they were read off the engine once and are pinned
 * by the golden files (changing the shuffle would change them — that is a deliberate regression signal).
 */
export const GOLDEN_CASES: readonly GoldenCase[] = [
  {
    name: 'direct-attack-lp-zero',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-attack',
        playerIds: ['alice', 'bob'],
        deckLists: [MIXED_DECK, MIXED_DECK],
        startingLP: [1000, 1000],
      },
    },
    actions: [
      // T1 (P0): Normal Summon M1000 (p0-39), end turn.
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-39', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): pass.
      ...endPhase(1, 6),
      // T3 (P0): direct attack for exactly 1000 → LP 0.
      ...endPhase(0, 3),
      { type: 'DeclareAttack', payload: { playerIndex: 0, attackerInstanceId: 'p0-39' } },
      // After the duel ended, everything is rejected.
      ...endPhase(0, 1),
    ],
  },
  {
    name: 'tribute-position-flip-attack',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-tribute',
        playerIds: ['alice', 'bob'],
        deckLists: [MIXED_DECK, MIXED_DECK],
      },
    },
    actions: [
      // T1 (P0): Normal Summon M1000 (p0-36).
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-36', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): Set M1000 (p1-9).
      ...endPhase(1, 2),
      { type: 'SetMonster', payload: { playerIndex: 1, cardInstanceId: 'p1-9', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): Tribute Summon L5 (p0-20) over p0-36; it cannot attack the turn it is summoned (rejected).
      ...endPhase(0, 2),
      {
        type: 'NormalSummon',
        payload: {
          playerIndex: 0,
          cardInstanceId: 'p0-20',
          zoneIndex: 0,
          tributeInstanceIds: ['p0-36'],
        },
      },
      ...endPhase(0, 1),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-20', targetInstanceId: 'p1-9' },
      },
      ...endPhase(0, 3),
      // T4 (P1): pass.
      ...endPhase(1, 6),
      // T5 (P0): attack the Set monster (Flip-on-Attack, ATK > DEF), then try to switch to Defense in Main2 (rejected: it already attacked).
      ...endPhase(0, 3),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-20', targetInstanceId: 'p1-9' },
      },
      ...endPhase(0, 1),
      {
        type: 'ChangePosition',
        payload: { playerIndex: 0, cardInstanceId: 'p0-20', toPosition: 'DefenseUp' },
      },
      ...endPhase(0, 2),
    ],
  },
  {
    name: 'surrender-mid-duel',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-hand',
        playerIds: ['alice', 'bob'],
        deckLists: [MIXED_DECK, MIXED_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-18', zoneIndex: 2 } },
      // The non-turn player concedes during P0's Main1.
      { type: 'Surrender', payload: { playerIndex: 1 } },
      // Both a repeated Surrender and normal play are rejected afterwards.
      { type: 'Surrender', payload: { playerIndex: 0 } },
      ...endPhase(0, 1),
    ],
  },
  {
    name: 'deck-out',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-deckout',
        playerIds: ['alice', 'bob'],
        // Exactly the opening hand: the first real draw (P1, turn 2) has nothing to draw.
        deckLists: [Array(5).fill('M1000'), Array(5).fill('M1000')],
      },
    },
    actions: [...endPhase(0, 6), ...endPhase(1, 1), ...endPhase(1, 1)],
  },
  {
    name: 'hand-limit-discard',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-hand',
        playerIds: ['alice', 'bob'],
        deckLists: [MIXED_DECK, MIXED_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      // Hand 5 → 7, so leaving Main2 must open a discard-1 prompt.
      { type: 'Draw', payload: { playerIndex: 0, count: 2 } },
      ...endPhase(0, 3),
      // Wrong answers are rejected without changing anything, then the real one resolves.
      { type: 'EndPhase', payload: { playerIndex: 0 } },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'nope', cardInstanceIds: ['p0-18'] },
      },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'discard-1', cardInstanceIds: ['p0-18'] },
      },
      ...endPhase(0, 1),
    ],
  },
];
