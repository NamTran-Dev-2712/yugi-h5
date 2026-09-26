import type { CardInstance } from '@yugi/game-engine';
import type { CardDefinition } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { DuelManager } from './duel-manager';
import { InMemoryDuelStore } from './duel-store';

/**
 * Task 3.2b: SetSpellTrap/ActivateEffect are on the wire. Replaces the task 3.2 containment test (they used to be
 * hidden from legalActions and refused with FORBIDDEN_ACTION).
 */

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
  // Put a Spell player 0 may activate or Set into their hand, in Main1.
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

describe('Spell/Trap actions over the manager (SetSpellTrap / ActivateEffect)', () => {
  it('are listed in legalActions of the player who may use them, never of the other seat', async () => {
    const { manager, duelId } = await setup();
    const mine = await manager.getLegalActions(duelId, 0);
    expect(mine).toContainEqual({
      type: 'SetSpellTrap',
      payload: { playerIndex: 0, cardInstanceId: 'sp-1', zoneIndex: 0 },
    });
    expect(mine).toContainEqual({
      type: 'ActivateEffect',
      payload: { playerIndex: 0, cardInstanceId: 'sp-1', effectId: 'e1' },
    });
    const theirs = await manager.getLegalActions(duelId, 1);
    expect(theirs.some((a) => a.type === 'SetSpellTrap' || a.type === 'ActivateEffect')).toBe(
      false,
    );
  });

  it('SetSpellTrap is accepted: the card is face-down for the opponent, the event has no definitionId', async () => {
    const { manager, duelId } = await setup();
    const result = await manager.submitAction(duelId, 0, {
      type: 'SetSpellTrap',
      payload: { playerIndex: 0, cardInstanceId: 'sp-1', zoneIndex: 2 },
    });
    expect(result.eventsByViewer[1]).toEqual([
      { type: 'SpellTrapSet', playerIndex: 0, instanceId: 'sp-1', zoneIndex: 2 },
    ]);
    const opp = await manager.getView(duelId, 1);
    expect(opp.players[0].board.spellTrapZones[2]).toEqual({
      hidden: true,
      instanceId: 'sp-1',
      ownerIndex: 0,
    });
    expect(JSON.stringify(opp)).not.toContain('TST-SPELL');
    expect(result.view.players[0].board.spellTrapZones[2]).toMatchObject({
      hidden: false,
      definitionId: 'TST-SPELL',
      position: 'DefenseDown',
    });
  });

  it('ActivateEffect is accepted: both players see the activation, the Spell goes to the graveyard', async () => {
    const { manager, duelId } = await setup();
    const handBefore = (await manager.getView(duelId, 0)).players[0].handCount;
    const result = await manager.submitAction(duelId, 0, {
      type: 'ActivateEffect',
      payload: { playerIndex: 0, cardInstanceId: 'sp-1', effectId: 'e1' },
    });
    const types = result.eventsByViewer[1].map((e) => e.type);
    expect(types).toEqual([
      'EffectActivated',
      'CardDrawn',
      'EffectResolved',
      'CardSentToGraveyard',
    ]);
    // The spell left the hand and one card was drawn.
    expect(result.view.players[0].handCount).toBe(handBefore);
    expect(result.view.players[0].graveyard.map((c) => c.definitionId)).toEqual(['TST-SPELL']);
  });
});
