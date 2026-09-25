import type { CardInstance } from '@yugi/game-engine';
import type { CardDefinition } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { DuelManager } from './duel-manager';
import { InMemoryDuelStore } from './duel-store';

/** Task 3.2 containment: SetSpellTrap/ActivateEffect exist in the engine but are not on the wire yet (task 3.2b). */

const DEFS = new Map<string, CardDefinition>([
  [
    'TST-MON',
    {
      id: 'TST-MON',
      kind: 'Monster',
      name: { vi: 'TST-MON', en: 'TST-MON' },
      category: 'Normal',
      attribute: 'EARTH',
      race: 'Warrior',
      level: 3,
      atk: 1000,
      def: 1000,
    },
  ],
  [
    'TST-SPELL',
    {
      id: 'TST-SPELL',
      kind: 'Spell',
      name: { vi: 'TST-SPELL', en: 'TST-SPELL' },
      subType: 'Normal',
      effects: [
        {
          id: 'e1',
          trigger: { kind: 'Ignition' },
          operations: [{ kind: 'Draw', count: 1, target: 'self' }],
        },
      ],
    },
  ],
]);

async function setup() {
  const store = new InMemoryDuelStore();
  const manager = new DuelManager({
    store,
    cardDefinitions: (id) => DEFS.get(id),
    newDuelId: () => 'duel-1',
    newSeed: () => 'seed-1',
  });
  const { duelId } = await manager.createDuel({
    playerIds: ['alice', 'bob'],
    deckLists: [Array(20).fill('TST-MON'), Array(20).fill('TST-MON')],
  });
  // Put a Spell that the engine WOULD let player 0 activate/Set into their hand, in Main1.
  const session = (await store.get(duelId))!;
  const spell: CardInstance = {
    instanceId: 'sp-1',
    definitionId: 'TST-SPELL',
    ownerIndex: 0,
    position: null,
  };
  const p0 = session.state.players[0];
  await store.save({
    ...session,
    state: {
      ...session.state,
      phase: 'Main1',
      players: [{ ...p0, hand: [...p0.hand, spell] }, session.state.players[1]],
    },
  });
  return { manager, duelId };
}

describe('engine-only actions (SetSpellTrap / ActivateEffect)', () => {
  it('are never listed in legalActions, although the engine would accept them', async () => {
    const { manager, duelId } = await setup();
    const legal = await manager.getLegalActions(duelId, 0);
    expect(legal.length).toBeGreaterThan(0);
    expect(legal.some((a) => (a.type as string) === 'SetSpellTrap')).toBe(false);
    expect(legal.some((a) => (a.type as string) === 'ActivateEffect')).toBe(false);
  });

  it.each([
    { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'sp-1', zoneIndex: 0 } },
    { type: 'ActivateEffect', payload: { playerIndex: 0, cardInstanceId: 'sp-1', effectId: 'e1' } },
  ] as const)('$type is refused with FORBIDDEN_ACTION and changes nothing', async (action) => {
    const { manager, duelId } = await setup();
    const before = (await manager.getDuel(duelId)).state;
    await expect(manager.submitAction(duelId, 0, action)).rejects.toMatchObject({
      code: 'FORBIDDEN_ACTION',
    });
    expect((await manager.getDuel(duelId)).state).toBe(before);
  });
});
