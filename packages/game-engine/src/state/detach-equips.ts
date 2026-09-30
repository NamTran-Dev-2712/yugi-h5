import type { GameEvent } from '../events/types.js';
import type { CardInstance, GameState, PlayerState } from './types.js';

/**
 * Task 4.2c [RULE]: an Equip Spell leaves the field with its monster. After every action (`applyAction`), each face-up
 * card with `equippedTo` whose monster is no longer face-up in a Monster Zone (destroyed, Tributed, … or face-down) goes
 * to its owner's graveyard: `CardSentToGraveyard {from: 'SpellTrapZone'}`. [ASSUMED] G18: "sent to the graveyard", not
 * "destroyed" (no OnDestroyed). Pure; returns the SAME state object when there is nothing to detach.
 */
export function detachOrphanEquips(state: GameState): { state: GameState; events: GameEvent[] } {
  const faceUpMonsters = new Set<string>();
  for (const p of state.players) {
    for (const c of p.board.monsterZones) {
      if (c && c.position !== 'DefenseDown') faceUpMonsters.add(c.instanceId);
    }
  }

  const events: GameEvent[] = [];
  const players = state.players.map((p): PlayerState => {
    const orphans = p.board.spellTrapZones.flatMap((c, i) =>
      c?.equippedTo !== undefined && !faceUpMonsters.has(c.equippedTo) ? [i] : [],
    );
    if (orphans.length === 0) return p;
    const buried: CardInstance[] = [];
    const spellTrapZones = p.board.spellTrapZones.map((c, i) => {
      if (c === null || !orphans.includes(i)) return c;
      // Fresh instance: the link to the monster (and any field mark) never follows the card to the graveyard.
      buried.push({
        instanceId: c.instanceId,
        definitionId: c.definitionId,
        ownerIndex: c.ownerIndex,
        position: null,
      });
      events.push({
        type: 'CardSentToGraveyard',
        ownerIndex: c.ownerIndex,
        instanceId: c.instanceId,
        definitionId: c.definitionId,
        from: 'SpellTrapZone',
      });
      return null;
    }) as unknown as PlayerState['board']['spellTrapZones'];
    return { ...p, board: { ...p.board, spellTrapZones }, graveyard: [...p.graveyard, ...buried] };
  }) as unknown as GameState['players'];

  return events.length === 0 ? { state, events } : { state: { ...state, players }, events };
}
