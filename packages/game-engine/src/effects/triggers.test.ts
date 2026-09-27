import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events/types.js';
import { fixtureCtx, fixtureState } from '../testing/effect-fixtures.js';
import { collectTriggers, readyTrigger } from './triggers.js';

/* Task 3.5 — pure trigger helpers: which events fire what, in which order. */

const destroyed = (ownerIndex: 0 | 1, instanceId: string, definitionId: string): GameEvent => ({
  type: 'MonsterDestroyed',
  ownerIndex,
  instanceId,
  definitionId,
  zoneIndex: 0,
});

describe('collectTriggers', () => {
  it('orders the turn player’s triggers first, then the opponent’s; same player keeps event order [ASSUMED G15]', () => {
    const state = fixtureState(); // turn player 0
    const queue = collectTriggers(
      state,
      [
        destroyed(1, 'x1', 'DES_BURN'),
        destroyed(0, 'a1', 'DES_DRAW'),
        destroyed(1, 'x2', 'DES_DRAW'),
        destroyed(0, 'a2', 'DES_BURN'),
      ],
      fixtureCtx,
    );
    expect(queue.map((t) => t.instanceId)).toEqual(['a1', 'a2', 'x1', 'x2']);
    expect(queue.every((t) => t.source.zone === 'Graveyard')).toBe(true);
  });

  it('ignores cards without a matching trigger, MonsterSet, and a finished duel', () => {
    const state = fixtureState();
    const events: GameEvent[] = [
      destroyed(0, 'a', 'M1'),
      { type: 'MonsterSet', playerIndex: 0, instanceId: 'b', zoneIndex: 1 },
      // OnSummon only reacts to a Summon, OnDestroyed only to a destruction.
      destroyed(0, 'c', 'SUM_DRAW'),
      {
        type: 'NormalSummoned',
        playerIndex: 0,
        instanceId: 'd',
        definitionId: 'DES_BURN',
        zoneIndex: 2,
      },
    ];
    expect(collectTriggers(state, events, fixtureCtx)).toEqual([]);
    expect(
      collectTriggers({ ...state, winnerIndex: 0 }, [destroyed(0, 'a', 'DES_BURN')], fixtureCtx),
    ).toEqual([]);
  });

  it('a Spell/Trap destroyed fires its OnDestroyed; a Summon fires OnSummon from its zone', () => {
    const state = fixtureState();
    const queue = collectTriggers(
      state,
      [
        {
          type: 'SpellTrapDestroyed',
          ownerIndex: 1,
          instanceId: 't',
          definitionId: 'TRAP_BURN_DES',
          zoneIndex: 3,
        },
        {
          type: 'NormalSummoned',
          playerIndex: 0,
          instanceId: 's',
          definitionId: 'SUM_DRAW',
          zoneIndex: 2,
        },
      ],
      fixtureCtx,
    );
    expect(queue).toEqual([
      {
        playerIndex: 0,
        instanceId: 's',
        definitionId: 'SUM_DRAW',
        effectId: 'e1',
        source: { zone: 'MonsterZone', zoneIndex: 2 },
      },
      {
        playerIndex: 1,
        instanceId: 't',
        definitionId: 'TRAP_BURN_DES',
        effectId: 'e2',
        source: { zone: 'Graveyard' },
      },
    ]);
  });
});

describe('readyTrigger', () => {
  it('is null once the card left the place it fired from', () => {
    const state = fixtureState({ myMonsters: [[2, 'SUM_DRAW']] });
    const onField = {
      playerIndex: 0 as const,
      instanceId: 'm0-2',
      definitionId: 'SUM_DRAW',
      effectId: 'e1',
      source: { zone: 'MonsterZone' as const, zoneIndex: 2 },
    };
    expect(readyTrigger(state, onField, fixtureCtx)).toMatchObject({
      optional: false,
      spellSpeed: 1,
    });
    expect(
      readyTrigger(
        state,
        { ...onField, source: { zone: 'MonsterZone', zoneIndex: 1 } },
        fixtureCtx,
      ),
    ).toBeNull();
    // Not in the graveyard.
    expect(
      readyTrigger(state, { ...onField, source: { zone: 'Graveyard' } }, fixtureCtx),
    ).toBeNull();
  });

  it('a Trap’s OnDestroyed keeps the Trap default Spell Speed 2 (spellSpeedOf unchanged)', () => {
    const base = fixtureState();
    const state = {
      ...base,
      players: [
        base.players[0],
        {
          ...base.players[1],
          graveyard: [
            { instanceId: 't', definitionId: 'TRAP_DES_HEAL', ownerIndex: 1, position: null },
          ],
        },
      ],
    } as typeof base;
    const ready = readyTrigger(
      state,
      {
        playerIndex: 1,
        instanceId: 't',
        definitionId: 'TRAP_DES_HEAL',
        effectId: 'e1',
        source: { zone: 'Graveyard' },
      },
      fixtureCtx,
    );
    expect(ready).toMatchObject({ optional: false, spellSpeed: 2, candidates: null, count: 0 });
  });
});
