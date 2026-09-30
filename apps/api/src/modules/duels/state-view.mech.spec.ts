import { applyAction, type CardInstance, type ChainLink, type GameState } from '@yugi/game-engine';
import type { CardDefinition, VisibleCardView } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { toStateView } from './state-view';

/**
 * Task 4.2d: (1) a chain link's targets never tell the opponent which hand card was chosen (Special Summon from the hand,
 * debt of ADR 4.2a); (2) `equippedTo` is on the wire, only on a face-up Spell/Trap pointing at a face-up monster.
 */

const text = (s: string) => ({ vi: s, en: s });
const DEFS = new Map<string, CardDefinition>([
  [
    'V-MON',
    {
      id: 'V-MON',
      kind: 'Monster',
      name: text('V-MON'),
      category: 'Normal',
      attribute: 'DARK',
      race: 'Fiend',
      level: 4,
      atk: 1500,
      def: 1200,
    },
  ],
]);
const defs = (id: string) => DEFS.get(id);

const card = (
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1,
  position: CardInstance['position'],
  extra: Partial<CardInstance> = {},
): CardInstance => ({ instanceId, definitionId, ownerIndex, position, ...extra });

function base(): GameState {
  const deck = () => Array.from({ length: 12 }, () => 'V-MON');
  return applyAction(null, {
    type: 'StartDuel',
    payload: { matchId: 'm', seed: 's', playerIds: ['a', 'b'], deckLists: [deck(), deck()] },
  }).state;
}

const five = <T>(xs: (T | null)[]) =>
  [0, 1, 2, 3, 4].map((i) => xs[i] ?? null) as unknown as readonly [T, T, T, T, T];

function withBoard(
  s: GameState,
  seat: 0 | 1,
  monsters: (CardInstance | null)[],
  backrow: (CardInstance | null)[] = [],
): GameState {
  const p = s.players[seat];
  const next = {
    ...p,
    board: { ...p.board, monsterZones: five(monsters), spellTrapZones: five(backrow) },
  } as typeof p;
  return { ...s, players: seat === 0 ? [next, s.players[1]] : [s.players[0], next] };
}

describe('toStateView — chain targets hidden from the viewer (task 4.2d)', () => {
  it('a link targeting a card of the activator hand: the activator sees it, the opponent does not', () => {
    const s0 = base();
    const handId = s0.players[0].hand[0]!.instanceId;
    const link: ChainLink = {
      linkId: 'link-3-9',
      playerIndex: 0,
      card: card('p0-ss', 'V-SPELL', 0, null),
      source: { zone: 'Hand' },
      effectId: 'e1',
      spellSpeed: 1,
      costInstanceIds: [],
      lpPaid: 0,
      targetInstanceIds: [handId],
    };
    const s: GameState = {
      ...s0,
      chainStack: [link],
      chainWindow: { priorityPlayer: 1, passCount: 0 },
    };
    expect(toStateView(s, 0, defs).chain[0]!.targetInstanceIds).toEqual([handId]);
    expect(toStateView(s, 1, defs).chain[0]!.targetInstanceIds).toEqual([]);
  });

  it('public targets (field, graveyard) stay for both viewers', () => {
    const s0 = withBoard(base(), 1, [card('p1-m', 'V-MON', 1, 'DefenseDown')]);
    const gy = card('p0-gy', 'V-MON', 0, null);
    const s: GameState = {
      ...s0,
      players: [{ ...s0.players[0], graveyard: [gy] }, s0.players[1]],
      chainStack: [
        {
          linkId: 'l',
          playerIndex: 0,
          card: card('p0-ss', 'V-SPELL', 0, null),
          source: { zone: 'Hand' },
          effectId: 'e1',
          spellSpeed: 1,
          costInstanceIds: [],
          lpPaid: 0,
          targetInstanceIds: ['p0-gy', 'p1-m'],
        },
      ],
      chainWindow: { priorityPlayer: 1, passCount: 0 },
    };
    for (const viewer of [0, 1] as const) {
      expect(toStateView(s, viewer, defs).chain[0]!.targetInstanceIds).toEqual(['p0-gy', 'p1-m']);
    }
  });
});

describe('toStateView — equippedTo (task 4.2d)', () => {
  const equipped = (monsterPos: CardInstance['position'], equipPos: CardInstance['position']) =>
    withBoard(
      base(),
      0,
      [card('p0-m', 'V-MON', 0, monsterPos)],
      [card('p0-eq', 'V-EQUIP', 0, equipPos, { equippedTo: 'p0-m' })],
    );
  const backrow = (s: GameState, viewer: 0 | 1) =>
    toStateView(s, viewer, defs).players[0].board.spellTrapZones[0] as VisibleCardView;

  it('a face-up Equip on a face-up monster: both viewers see the link', () => {
    const s = equipped('Attack', 'Attack');
    for (const viewer of [0, 1] as const) expect(backrow(s, viewer).equippedTo).toBe('p0-m');
  });

  it('never on a face-down card (not even for its owner) nor pointing at a face-down monster', () => {
    expect(backrow(equipped('Attack', 'DefenseDown'), 0).equippedTo).toBeUndefined();
    expect(backrow(equipped('Attack', 'DefenseDown'), 1).hidden).toBe(true);
    expect(backrow(equipped('DefenseDown', 'Attack'), 0).equippedTo).toBeUndefined();
    expect(backrow(equipped('DefenseDown', 'Attack'), 1).equippedTo).toBeUndefined();
  });

  it('never when the monster is not on the field any more', () => {
    const s = withBoard(
      base(),
      0,
      [],
      [card('p0-eq', 'V-EQUIP', 0, 'Attack', { equippedTo: 'gone' })],
    );
    expect(backrow(s, 0).equippedTo).toBeUndefined();
  });

  it('points across the table too (an Equip on the opponent monster)', () => {
    const s0 = withBoard(base(), 1, [card('p1-m', 'V-MON', 1, 'Attack')]);
    const s = withBoard(s0, 0, [], [card('p0-eq', 'V-EQUIP', 0, 'Attack', { equippedTo: 'p1-m' })]);
    expect(backrow(s, 1).equippedTo).toBe('p1-m');
  });

  it('no other card carries the field', () => {
    const s = equipped('Attack', 'Attack');
    const json = JSON.stringify({
      ...toStateView(s, 0, defs),
      players: toStateView(s, 0, defs).players.map((p) => ({
        ...p,
        board: { ...p.board, spellTrapZones: [] },
      })),
    });
    expect(json).not.toContain('equippedTo');
  });
});
