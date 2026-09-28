import { applyAction, type CardInstance, type ChainLink, type GameState } from '@yugi/game-engine';
import type { CardDefinition } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { toStateView } from './state-view';

/**
 * Task 3.4b: the chain, the open window and the effective (post-Continuous) ATK/DEF are on the wire. The chain is
 * public to both seats (activating revealed every linked card); effective stats only exist on face-up monsters.
 */

const text = (s: string) => ({ vi: s, en: s });
const monster = (id: string, atk: number, def: number, extra: Partial<CardDefinition> = {}) =>
  ({
    id,
    kind: 'Monster',
    name: text(id),
    category: 'Effect',
    attribute: 'DARK',
    race: 'Fiend',
    level: 4,
    atk,
    def,
    ...extra,
  }) as CardDefinition;

const DEFS = new Map<string, CardDefinition>([
  ['V-MON', monster('V-MON', 1500, 1200)],
  [
    // Continuous: the opponent's face-up monsters lose 600 ATK and 2000 DEF (DEF clamps at 0).
    'V-WEAKEN',
    monster('V-WEAKEN', 1000, 1000, {
      effects: [
        {
          id: 'c1',
          trigger: { kind: 'Continuous' },
          operations: [
            { kind: 'ModifyStat', stat: 'atk', amount: -600, side: 'opponent' },
            { kind: 'ModifyStat', stat: 'def', amount: -2000, side: 'opponent' },
          ],
        },
      ],
    }),
  ],
  [
    'V-SPELL',
    {
      id: 'V-SPELL',
      kind: 'Spell',
      name: text('V-SPELL'),
      subType: 'Normal',
      effects: [
        {
          id: 'e1',
          trigger: { kind: 'Ignition' },
          operations: [{ kind: 'Draw', count: 1, target: 'self' }],
        },
      ],
    } as CardDefinition,
  ],
]);
const defs = (id: string) => DEFS.get(id);

const card = (
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1,
  position: CardInstance['position'],
): CardInstance => ({ instanceId, definitionId, ownerIndex, position });

function base(): GameState {
  const deck = () => Array.from({ length: 12 }, () => 'V-MON');
  return applyAction(null, {
    type: 'StartDuel',
    payload: { matchId: 'm', seed: 's', playerIds: ['a', 'b'], deckLists: [deck(), deck()] },
  }).state;
}

function withBoard(
  s: GameState,
  seat: 0 | 1,
  monsters: (CardInstance | null)[],
  backrow: (CardInstance | null)[] = [],
): GameState {
  const five = <T>(xs: (T | null)[]) =>
    [0, 1, 2, 3, 4].map((i) => xs[i] ?? null) as unknown as readonly [T, T, T, T, T];
  const p = s.players[seat];
  const next = {
    ...p,
    board: { ...p.board, monsterZones: five(monsters), spellTrapZones: five(backrow) },
  } as typeof p;
  return { ...s, players: seat === 0 ? [next, s.players[1]] : [s.players[0], next] };
}

describe('toStateView — chain (task 3.4b)', () => {
  const handLink: ChainLink = {
    linkId: 'link-1-5',
    playerIndex: 0,
    card: card('p0-spell', 'V-SPELL', 0, null),
    source: { zone: 'Hand' },
    effectId: 'e1',
    spellSpeed: 1,
    costInstanceIds: ['p0-cost'],
    lpPaid: 0,
    targetInstanceIds: [],
  };
  const setLink: ChainLink = {
    linkId: 'link-1-6',
    playerIndex: 1,
    card: card('p1-trap', 'V-TRAP', 1, 'Attack'),
    source: { zone: 'SpellTrapZone', zoneIndex: 2 },
    effectId: 't1',
    spellSpeed: 2,
    costInstanceIds: [],
    lpPaid: 500,
    targetInstanceIds: ['p0-m0'],
  };

  it('is empty with no window outside a chain', () => {
    const v = toStateView(base(), 0, defs);
    expect(v.chain).toEqual([]);
    expect(v.chainWindow).toBeNull();
  });

  it('shows every link, bottom → top, identically to both seats (no cost ids, no LP paid)', () => {
    const s: GameState = {
      ...base(),
      chainStack: [handLink, setLink],
      chainWindow: { priorityPlayer: 0, passCount: 0 },
    };
    const expected = [
      {
        linkId: 'link-1-5',
        playerIndex: 0,
        card: {
          hidden: false,
          instanceId: 'p0-spell',
          definitionId: 'V-SPELL',
          position: null,
          ownerIndex: 0,
        },
        source: { zone: 'Hand' },
        effectId: 'e1',
        spellSpeed: 1,
        targetInstanceIds: [],
      },
      {
        linkId: 'link-1-6',
        playerIndex: 1,
        card: {
          hidden: false,
          instanceId: 'p1-trap',
          definitionId: 'V-TRAP',
          position: 'Attack',
          ownerIndex: 1,
        },
        source: { zone: 'SpellTrapZone', zoneIndex: 2 },
        effectId: 't1',
        spellSpeed: 2,
        targetInstanceIds: ['p0-m0'],
      },
    ];
    for (const viewer of [0, 1] as const) {
      const v = toStateView(s, viewer, defs);
      expect(v.chain).toEqual(expected);
      expect(v.chainWindow).toEqual({ priorityPlayer: 0, passCount: 0 });
      expect(JSON.stringify(v.chain)).not.toContain('p0-cost');
    }
  });

  it('carries the reaction window and what it was opened for', () => {
    const reactionTo = {
      kind: 'Attack',
      playerIndex: 0,
      attackerInstanceId: 'p0-m0',
      targetInstanceId: null,
    } as const;
    const s: GameState = {
      ...base(),
      chainWindow: { priorityPlayer: 1, passCount: 0, reactionTo },
    };
    for (const viewer of [0, 1] as const) {
      expect(toStateView(s, viewer, defs).chainWindow).toEqual({
        priorityPlayer: 1,
        passCount: 0,
        reactionTo,
      });
    }
  });
});

describe('toStateView — effective ATK/DEF (task 3.4b)', () => {
  const board = () => {
    let s = withBoard(base(), 0, [
      card('p0-weak', 'V-WEAKEN', 0, 'Attack'),
      card('p0-down', 'V-MON', 0, 'DefenseDown'),
    ]);
    s = withBoard(s, 1, [
      card('p1-up', 'V-MON', 1, 'Attack'),
      card('p1-down', 'V-MON', 1, 'DefenseDown'),
      card('p1-def', 'V-MON', 1, 'DefenseUp'),
    ]);
    return s;
  };

  it('adds the modified stats to face-up monsters, clamped at 0, for both viewers', () => {
    for (const viewer of [0, 1] as const) {
      const v = toStateView(board(), viewer, defs);
      const opp = v.players[1].board.monsterZones;
      expect(opp[0]).toMatchObject({ effectiveStats: { atk: 900, def: 0 } });
      expect(opp[2]).toMatchObject({ effectiveStats: { atk: 900, def: 0 } });
      // The source is not affected by its own opponent-side modifier.
      expect(v.players[0].board.monsterZones[0]).toMatchObject({
        effectiveStats: { atk: 1000, def: 1000 },
      });
    }
  });

  it('never adds stats to face-down monsters (not even for their owner) nor outside the field', () => {
    const s = board();
    const own = toStateView(s, 1, defs).players[1];
    expect(own.board.monsterZones[1]).not.toHaveProperty('effectiveStats');
    const theirs = toStateView(s, 0, defs).players[1];
    expect(theirs.board.monsterZones[1]).toEqual({
      hidden: true,
      instanceId: 'p1-down',
      ownerIndex: 1,
    });
    expect(toStateView(s, 0, defs).players[0].board.monsterZones[1]).not.toHaveProperty(
      'effectiveStats',
    );
    for (const c of toStateView(s, 0, defs).players[0].hand) {
      expect(c).not.toHaveProperty('effectiveStats');
    }
  });

  it('equals the printed stats when nothing modifies them', () => {
    const s = withBoard(base(), 1, [card('p1-up', 'V-MON', 1, 'Attack')]);
    expect(toStateView(s, 0, defs).players[1].board.monsterZones[0]).toMatchObject({
      effectiveStats: { atk: 1500, def: 1200 },
    });
  });

  it('skips a card the resolver does not know (no throw)', () => {
    const s = withBoard(base(), 1, [card('p1-x', 'UNKNOWN', 1, 'Attack')]);
    const zone = toStateView(s, 0, defs).players[1].board.monsterZones[0];
    expect(zone).not.toBeNull();
    expect(zone).not.toHaveProperty('effectiveStats');
  });
});
