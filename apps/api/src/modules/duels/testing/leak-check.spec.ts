import type { CardInstance, GameState } from '@yugi/game-engine';
import { applyAction } from '@yugi/game-engine';
import { describe, expect, it } from 'vitest';
import { collectDefinitionIds, findLeaks } from './leak-check';

const base = (): GameState =>
  applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed: 's',
      playerIds: ['a', 'b'],
      deckLists: [Array(10).fill('A'), Array(10).fill('B')],
    },
  }).state;

const card = (
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1,
  position: CardInstance['position'],
): CardInstance => ({ instanceId, definitionId, ownerIndex, position });

/** Player 1 has a face-down Spell and a face-up monster; player 0 a face-down monster; one card in each graveyard. */
function state(): GameState {
  const s = base();
  const [p0, p1] = s.players;
  return {
    ...s,
    players: [
      {
        ...p0,
        graveyard: [card('g0', 'GY-0', 0, null)],
        board: {
          ...p0.board,
          monsterZones: [card('m0', 'SET-MON', 0, 'DefenseDown'), null, null, null, null],
        },
      },
      {
        ...p1,
        board: {
          ...p1.board,
          monsterZones: [card('m1', 'UP-MON', 1, 'Attack'), null, null, null, null],
          spellTrapZones: [card('s1', 'SET-SPELL', 1, 'DefenseDown'), null, null, null, null],
        },
      },
    ],
  };
}

describe('collectDefinitionIds', () => {
  it('finds definitionIds at any depth, with the instanceId next to them', () => {
    const found = collectDefinitionIds({
      a: [{ x: { instanceId: 'i1', definitionId: 'D1' } }],
      b: { definitionId: 'D2' },
    });
    expect(found).toEqual([
      { path: '$.a[0].x', instanceId: 'i1', definitionId: 'D1' },
      { path: '$.b', instanceId: null, definitionId: 'D2' },
    ]);
  });
});

describe('findLeaks', () => {
  it('accepts public and own cards', () => {
    const s = state();
    const hand0 = s.players[0].hand[0]!;
    const payload = [
      { instanceId: 'g0', definitionId: 'GY-0' },
      { instanceId: 'm1', definitionId: 'UP-MON' },
      { instanceId: 'm0', definitionId: 'SET-MON' }, // own face-down card, seen by its owner
      { instanceId: hand0.instanceId, definitionId: hand0.definitionId },
    ];
    expect(findLeaks(s, 0, payload)).toEqual([]);
  });

  it('flags a face-down card of the opponent (Set Spell and Set monster)', () => {
    const s = state();
    expect(findLeaks(s, 0, { instanceId: 's1', definitionId: 'SET-SPELL' })).toMatchObject([
      { reason: 'card is face-down on the opponent field' },
    ]);
    expect(findLeaks(s, 1, { e: { instanceId: 'm0', definitionId: 'SET-MON' } })).toHaveLength(1);
  });

  it("flags a card in the opponent's hand, and a deck card even for its owner", () => {
    const s = state();
    const hand1 = s.players[1].hand[0]!;
    const deck0 = s.players[0].deck[0]!;
    expect(
      findLeaks(s, 0, { instanceId: hand1.instanceId, definitionId: hand1.definitionId }),
    ).toHaveLength(1);
    expect(
      findLeaks(s, 0, { instanceId: deck0.instanceId, definitionId: deck0.definitionId }),
    ).toMatchObject([{ reason: 'card is in a deck' }]);
  });

  it('flags an unknown instance, a wrong definitionId and an unpaired definitionId', () => {
    const s = state();
    expect(findLeaks(s, 0, { instanceId: 'nope', definitionId: 'X' })[0]?.reason).toBe(
      'unknown instance',
    );
    expect(findLeaks(s, 0, { instanceId: 'g0', definitionId: 'OTHER' })[0]?.reason).toMatch(
      /wrong definitionId/,
    );
    expect(findLeaks(s, 0, { candidates: [{ definitionId: 'SET-SPELL' }] })[0]?.reason).toBe(
      'definitionId without instanceId',
    );
  });
});

describe('findLeaks — chain (task 3.4b)', () => {
  const withChain = (): GameState => ({
    ...state(),
    chainStack: [
      {
        linkId: 'link-1-2',
        playerIndex: 1,
        card: card('c1', 'CHAIN-SPELL', 1, null),
        source: { zone: 'Hand' },
        effectId: 'e1',
        spellSpeed: 1,
        costInstanceIds: [],
        lpPaid: 0,
        targetInstanceIds: [],
      },
    ],
    chainWindow: { priorityPlayer: 0, passCount: 0 },
  });

  it('accepts a card activated from the hand that now lives in a chain link (public)', () => {
    expect(findLeaks(withChain(), 0, { instanceId: 'c1', definitionId: 'CHAIN-SPELL' })).toEqual(
      [],
    );
  });

  it('still flags a wrong definitionId for a chain card', () => {
    expect(
      findLeaks(withChain(), 0, { instanceId: 'c1', definitionId: 'OTHER' })[0]?.reason,
    ).toMatch(/wrong definitionId/);
  });
});

describe('findLeaks — id lists and equippedTo (task 4.2d)', () => {
  it("flags an id of the opponent's hand or of a deck in any *InstanceIds list / *InstanceId field", () => {
    const s = state();
    const hand1 = s.players[1].hand[0]!.instanceId;
    const deck1 = s.players[1].deck[0]!.instanceId;
    expect(findLeaks(s, 0, { link: { targetInstanceIds: [hand1] } })).toMatchObject([
      { path: '$.link.targetInstanceIds[0]', instanceId: hand1 },
    ]);
    expect(
      findLeaks(s, 0, { action: { payload: { cardInstanceIds: ['g0', deck1] } } }),
    ).toHaveLength(1);
    expect(findLeaks(s, 0, { targetInstanceId: hand1 })).toHaveLength(1);
  });

  it('accepts ids the viewer may point at: own hand, graveyard, field (face-down too), and plain instanceId keys', () => {
    const s = state();
    const hand0 = s.players[0].hand[0]!.instanceId;
    const hand1 = s.players[1].hand[0]!.instanceId;
    expect(
      findLeaks(s, 0, {
        targetInstanceIds: [hand0, 'g0', 'm1', 's1'],
        attackerInstanceId: 'm0',
        hand: [{ hidden: true, instanceId: hand1, ownerIndex: 1 }],
      }),
    ).toEqual([]);
  });

  it('accepts equippedTo on a face-up card pointing at a face-up monster on the field', () => {
    expect(
      findLeaks(state(), 0, {
        hidden: false,
        instanceId: 'x',
        position: 'Attack',
        equippedTo: 'm1',
      }),
    ).toEqual([]);
  });

  it('flags equippedTo on a face-down/hidden card, or pointing at a face-down, missing or non-field card', () => {
    const s = state();
    const bad = [
      { hidden: true, instanceId: 'x', equippedTo: 'm1' },
      { hidden: false, instanceId: 'x', position: 'DefenseDown', equippedTo: 'm1' },
      { hidden: false, instanceId: 'x', position: 'Attack', equippedTo: 'm0' },
      { hidden: false, instanceId: 'x', position: 'Attack', equippedTo: 'nope' },
      { hidden: false, instanceId: 'x', position: 'Attack', equippedTo: 'g0' },
      { hidden: false, instanceId: 'x', position: 'Attack', equippedTo: 's1' },
    ];
    for (const payload of bad)
      expect(findLeaks(s, 0, payload), JSON.stringify(payload)).toHaveLength(1);
  });
});

describe('findLeaks — Field Zone (task 4.3b)', () => {
  /** Both players hold a face-down Field Spell; player 1 also a face-up Continuous Spell. */
  const withFields = (): GameState => {
    const s = state();
    const [p0, p1] = s.players;
    return {
      ...s,
      players: [
        { ...p0, board: { ...p0.board, fieldZone: card('f0', 'SET-FIELD-0', 0, 'DefenseDown') } },
        {
          ...p1,
          board: {
            ...p1.board,
            fieldZone: card('f1', 'SET-FIELD-1', 1, 'DefenseDown'),
            spellTrapZones: [
              card('s1', 'SET-SPELL', 1, 'DefenseDown'),
              card('c1', 'UP-CONT', 1, 'Attack'),
              null,
              null,
              null,
            ],
          },
        },
      ],
    };
  };
  const SECRET = { instanceId: 'f1', definitionId: 'SET-FIELD-1' };

  it("flags the opponent's face-down Field Spell wherever its definitionId shows up", () => {
    const s = withFields();
    const payloads: unknown[] = [
      { view: { players: [{}, { board: { fieldZone: { hidden: false, ...SECRET } } }] } },
      { events: [{ type: 'EffectActivated', playerIndex: 1, ...SECRET, effectId: 'e1' }] },
      { view: { chain: [{ linkId: 'l', card: { hidden: false, ...SECRET } }] } },
      { post: { aiActions: [{ action: { type: 'SetSpellTrap', payload: {} }, card: SECRET }] } },
      { some: { new: [{ field: { deeply: SECRET } }] } },
    ];
    for (const payload of payloads) {
      expect(findLeaks(s, 0, payload), JSON.stringify(payload)).toMatchObject([
        { instanceId: 'f1', reason: 'card is face-down on the opponent field' },
      ]);
    }
  });

  it('accepts my own face-down Field Spell, a face-up one of the opponent, and a face-up Continuous Spell', () => {
    const s = withFields();
    expect(findLeaks(s, 1, { board: { fieldZone: { hidden: false, ...SECRET } } })).toEqual([]);
    expect(findLeaks(s, 0, { instanceId: 'f0', definitionId: 'SET-FIELD-0' })).toEqual([]);
    expect(findLeaks(s, 0, { instanceId: 'c1', definitionId: 'UP-CONT' })).toEqual([]);
    const faceUp: GameState = {
      ...s,
      players: [
        s.players[0],
        {
          ...s.players[1],
          board: { ...s.players[1].board, fieldZone: card('f1', 'SET-FIELD-1', 1, 'Attack') },
        },
      ],
    };
    expect(findLeaks(faceUp, 0, SECRET)).toEqual([]);
  });

  it('a hidden Field card and a target list naming a face-down Field card are fine (ids are public)', () => {
    const s = withFields();
    expect(
      findLeaks(s, 0, {
        fieldZone: { hidden: true, instanceId: 'f1', ownerIndex: 1 },
        targetInstanceIds: ['f1', 's1'],
      }),
    ).toEqual([]);
  });

  it.each(['FieldSpellSet', 'SpellTrapSet', 'MonsterSet'])(
    'flags a face-down Set event (%s) that carries a definitionId — for BOTH viewers, the owner included',
    (type) => {
      const s = withFields();
      const event = { type, playerIndex: 1, ...SECRET };
      for (const viewer of [0, 1] as const) {
        expect(
          findLeaks(s, viewer, { events: [event] }).map((v) => v.reason),
          `viewer ${viewer}`,
        ).toContain('a face-down Set event carries a definitionId');
      }
      expect(findLeaks(s, 1, { events: [{ type, playerIndex: 1, instanceId: 'f1' }] })).toEqual([]);
    },
  );
});

describe('findLeaks — Negate events (task 4.4b)', () => {
  const ID_ONLY = 'an id-only event carries a definitionId';
  /** Player 1 attacked player 0's face-down monster m0 with its face-up m1; the attack was negated. */
  const attackNegated = {
    type: 'AttackNegated',
    playerIndex: 1,
    attackerInstanceId: 'm1',
    targetInstanceId: 'm0',
  };

  it('accepts the three events as the engine emits them: graveyard cards, and ids only for the attack', () => {
    const s = state();
    const events = [
      {
        type: 'ChainLinkNegated',
        linkId: 'link-1-1',
        playerIndex: 0,
        instanceId: 'g0',
        definitionId: 'GY-0',
        effectId: 'e1',
        byInstanceId: 's1',
      },
      {
        type: 'SummonNegated',
        playerIndex: 0,
        instanceId: 'g0',
        definitionId: 'GY-0',
        zoneIndex: 2,
      },
      attackNegated,
      { ...attackNegated, targetInstanceId: null },
    ];
    for (const viewer of [0, 1] as const) expect(findLeaks(s, viewer, { events })).toEqual([]);
  });

  it('flags an AttackNegated that names its face-down target — for BOTH viewers, the owner of the target included', () => {
    const s = state();
    const flat = { ...attackNegated, definitionId: 'SET-MON' };
    const nested = { ...attackNegated, target: { instanceId: 'm0', definitionId: 'SET-MON' } };
    for (const event of [flat, nested]) {
      for (const viewer of [0, 1] as const) {
        expect(
          findLeaks(s, viewer, { events: [event] }).map((v) => v.reason),
          `viewer ${viewer}`,
        ).toContain(ID_ONLY);
      }
    }
    // The attacker (viewer 1) is also caught by the older rule: m0 is face-down on the opponent's field.
    expect(findLeaks(s, 1, { events: [nested] }).map((v) => v.reason)).toContain(
      'card is face-down on the opponent field',
    );
  });

  it('flags an AttackNegated that names its attacker too: the event is ids only, whatever the card', () => {
    const s = state();
    const event = { ...attackNegated, attacker: { instanceId: 'm1', definitionId: 'UP-MON' } };
    expect(findLeaks(s, 0, { events: [event] }).map((v) => v.reason)).toEqual([ID_ONLY]);
  });

  it("flags a Negate event that carries a card of the opponent's hand", () => {
    const s = state();
    const hand1 = s.players[1].hand[0]!;
    for (const type of ['ChainLinkNegated', 'SummonNegated', 'AttackNegated']) {
      const event = {
        type,
        playerIndex: 0,
        revealed: { instanceId: hand1.instanceId, definitionId: hand1.definitionId },
      };
      expect(
        findLeaks(s, 0, { events: [event] }).map((v) => v.reason),
        type,
      ).toContain("card is in the opponent's hand");
    }
  });

  it('flags a ChainLinkNegated / SummonNegated whose card is still face-down on the opponent field', () => {
    const s = state();
    const negated = {
      type: 'ChainLinkNegated',
      linkId: 'link-1-1',
      playerIndex: 1,
      instanceId: 's1',
      definitionId: 'SET-SPELL',
      effectId: 'e1',
      byInstanceId: 'g0',
    };
    expect(findLeaks(s, 0, { events: [negated] })).toMatchObject([
      { instanceId: 's1', reason: 'card is face-down on the opponent field' },
    ]);
    const summon = {
      type: 'SummonNegated',
      playerIndex: 0,
      instanceId: 'm0',
      definitionId: 'SET-MON',
      zoneIndex: 0,
    };
    expect(findLeaks(s, 1, { events: [summon] })).toMatchObject([
      { instanceId: 'm0', reason: 'card is face-down on the opponent field' },
    ]);
  });

  it("flags a Negate event whose pointer names a card in the opponent's hand (byInstanceId / targetInstanceId)", () => {
    const s = state();
    const hand1 = s.players[1].hand[0]!;
    const byHand = {
      type: 'ChainLinkNegated',
      linkId: 'link-1-1',
      playerIndex: 0,
      instanceId: 'g0',
      definitionId: 'GY-0',
      effectId: 'e1',
      byInstanceId: hand1.instanceId,
    };
    expect(findLeaks(s, 0, { events: [byHand] }).map((v) => v.reason)).toEqual([
      'an id list points at a card hidden from the viewer',
    ]);
    expect(
      findLeaks(s, 0, { events: [{ ...attackNegated, targetInstanceId: hand1.instanceId }] }),
    ).toHaveLength(1);
  });
});
