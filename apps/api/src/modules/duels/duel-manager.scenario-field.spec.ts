import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Action } from '@yugi/game-engine';
import {
  ScenarioSchema,
  type EventView,
  type PlayerAction,
  type Scenario,
  type StateView,
} from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { scenarioToState } from '../dev-sandbox/scenario-to-state';
import { lookupCard } from './card-pool';
import { DuelManager, type SubmitActionResult } from './duel-manager';
import { InMemoryDuelStore } from './duel-store';
import { findLeaks } from './testing/leak-check';

/**
 * Task 4.3b — the Field Zone and the cards that stay on the field, on the wire, through the Sandbox scenarios built on the
 * real cards SMP-113 (Field), SMP-114 (Continuous Spell), SMP-115 (Normal Spell) and SMP-208 (Continuous Trap): the same
 * DuelManager path as HTTP. Engine rules are not re-tested here, only what each seat receives.
 */

const dir = join(__dirname, '../../../../../packages/shared/scenarios');
const sample = (name: string): Scenario =>
  ScenarioSchema.parse(JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')));

async function start(s: Scenario, mode: 'solo-vs-ai' | 'solo-debug' = 'solo-vs-ai') {
  const manager = new DuelManager({
    store: new InMemoryDuelStore(),
    cardDefinitions: lookupCard,
    newDuelId: () => 'duel-1',
  });
  const ai = mode === 'solo-vs-ai';
  const r = await manager.createDuelFromState({
    state: scenarioToState(
      s,
      { matchId: 'duel-1', playerIds: ['owner', ai ? 'owner:ai' : 'owner'] },
      lookupCard,
    ),
    seed: s.seed,
    mode,
    ownerId: 'owner',
    ...(ai ? { aiSeat: 1 as const } : {}),
    ...(s.script ? { script: s.script } : {}),
  });
  return { manager, r };
}
const load = (name: string) => start(sample(name));

const act = (a: PlayerAction): Action => a as unknown as Action;
const types = (events: readonly EventView[]) => events.map((e) => e.type);
const activation = (legal: readonly PlayerAction[], cardInstanceId: string): PlayerAction => {
  const found = legal.find(
    (a) => a.type === 'ActivateEffect' && a.payload.cardInstanceId === cardInstanceId,
  );
  if (!found) throw new Error(`no ActivateEffect listed for ${cardInstanceId}`);
  return found;
};
const atk = (view: StateView, seat: 0 | 1, zone: number): number | undefined => {
  const c = view.players[seat].board.monsterZones[zone];
  return c && !c.hidden ? c.effectiveStats?.atk : undefined;
};
/** Everything both seats got for this step passes the leak oracle. */
async function noLeaks(manager: DuelManager, res: SubmitActionResult): Promise<void> {
  const state = (await manager.getDuel('duel-1')).state;
  for (const viewer of [0, 1] as const) {
    const payload = {
      view: await manager.getView('duel-1', viewer),
      events: res.eventsByViewer[viewer],
      legal: await manager.getLegalActions('duel-1', viewer),
    };
    expect(findLeaks(state, viewer, payload), `viewer ${viewer}`).toEqual([]);
  }
}

describe('Sandbox scenarios on the Field Zone and staying cards (task 4.3b)', () => {
  it('field-real: a Field Spell in the hand lists ONE Set (zoneIndex 0) and its activation', async () => {
    const { r } = await load('field-real');
    const legal = r.legalActionsByViewer[0];
    expect(legal.filter((a) => a.type === 'SetSpellTrap')).toEqual([
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-0', zoneIndex: 0 } },
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex: 0 } },
    ]);
    expect(activation(legal, 'p0-0').type).toBe('ActivateEffect');
  });

  it('field-real: activating from the hand puts it face-up in the Field Zone for both seats; WIND monsters of both sides +300', async () => {
    const { manager, r } = await load('field-real');
    const res = await manager.submitAction(
      'duel-1',
      0,
      act(activation(r.legalActionsByViewer[0], 'p0-0')),
    );
    expect(types(res.events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    for (const viewer of [0, 1] as const) {
      const view = await manager.getView('duel-1', viewer);
      expect(view.players[0].board.fieldZone).toEqual({
        hidden: false,
        instanceId: 'p0-0',
        definitionId: 'SMP-113',
        position: 'Attack',
        ownerIndex: 0,
      });
      expect(view.players[0].board.spellTrapZones.every((c) => c === null)).toBe(true);
      // SMP-008 (WIND 1600) and the opponent's SMP-030 (WIND 1700) gain 300; the WATER / DARK monsters do not.
      expect([atk(view, 0, 1), atk(view, 0, 2)]).toEqual([1900, 1500]);
      expect([atk(view, 1, 2), atk(view, 1, 3)]).toEqual([2000, 1700]);
    }
    await noLeaks(manager, res);
  });

  it('field-real: a second Field Spell replaces mine — CardSentToGraveyard from the FieldZone reaches both seats', async () => {
    const { manager, r } = await load('field-real');
    const first = await manager.submitAction(
      'duel-1',
      0,
      act(activation(r.legalActionsByViewer[0], 'p0-0')),
    );
    const res = await manager.submitAction(
      'duel-1',
      0,
      act(activation(first.legalActions, 'p0-1')),
    );
    const sent = {
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'p0-0',
      definitionId: 'SMP-113',
      from: 'FieldZone',
    };
    for (const viewer of [0, 1] as const) expect(res.eventsByViewer[viewer]).toContainEqual(sent);
    expect(types(res.events)).not.toContain('FieldSpellDestroyed');
    expect(res.view.players[0].board.fieldZone).toMatchObject({
      instanceId: 'p0-1',
      position: 'Attack',
    });
    expect(res.view.players[0].graveyard.map((c) => c.instanceId)).toEqual(['p0-0']);
    expect(atk(res.view, 0, 1)).toBe(1900); // the new one holds
    await noLeaks(manager, res);
  });

  it('field-set-real: the script Set it — FieldSpellSet without a definitionId, hidden from the opponent, known to me', async () => {
    const { manager, r } = await load('field-set-real');
    const set = { type: 'FieldSpellSet', playerIndex: 0, instanceId: 'p0-0' };
    for (const viewer of [0, 1] as const) {
      expect(r.eventsByViewer[viewer]).toContainEqual(set);
      expect(JSON.stringify(r.eventsByViewer[viewer])).not.toContain('SMP-113');
    }
    expect(r.views[1].players[0].board.fieldZone).toEqual({
      hidden: true,
      instanceId: 'p0-0',
      ownerIndex: 0,
    });
    expect(JSON.stringify(r.views[1])).not.toContain('SMP-113');
    expect(r.views[0].players[0].board.fieldZone).toMatchObject({
      hidden: false,
      definitionId: 'SMP-113',
      position: 'DefenseDown',
    });
    // Face-down: no bonus yet (SMP-014, WIND 1100).
    expect(atk(r.views[0], 0, 0)).toBe(1100);
    const state = (await manager.getDuel('duel-1')).state;
    for (const viewer of [0, 1] as const) {
      expect(
        findLeaks(state, viewer, {
          view: r.views[viewer],
          events: r.eventsByViewer[viewer],
          legal: r.legalActionsByViewer[viewer],
        }),
      ).toEqual([]);
    }
  });

  it('field-set-real: activated from the Field Zone on the turn it was Set; the link source is the FieldZone', async () => {
    const { manager, r } = await load('field-set-real');
    const res = await manager.submitAction(
      'duel-1',
      0,
      act(activation(r.legalActionsByViewer[0], 'p0-0')),
    );
    expect(types(res.events)).toEqual([
      'EffectActivated',
      'ChainLinkAdded',
      'EffectResolved',
      'ChainResolved',
    ]);
    const oppView = await manager.getView('duel-1', 1);
    expect(oppView.players[0].board.fieldZone).toMatchObject({
      hidden: false,
      definitionId: 'SMP-113',
      position: 'Attack',
    });
    expect(atk(oppView, 0, 0)).toBe(1400);
    await noLeaks(manager, res);
  });

  it('a face-down Field Spell destroyed by "destroy 1 Spell/Trap": FieldSpellDestroyed (public graveyard) for both seats', async () => {
    // solo-debug variant: seat 1 Sets its Field Spell, the turn passes, seat 0 destroys it with SMP-105.
    const base = sample('field-set-real');
    const end = (playerIndex: 0 | 1): PlayerAction => ({
      type: 'EndPhase',
      payload: { playerIndex },
    });
    const s: Scenario = {
      ...base,
      players: [
        { ...base.players[0], hand: ['SMP-105'] },
        { ...base.players[1], hand: ['SMP-113'] },
      ],
      turn: { count: 4, player: 1 },
      script: [
        { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-0', zoneIndex: 0 } },
        end(1),
        end(1),
        end(1),
        end(1),
        end(0),
        end(0),
      ],
    };
    const { manager, r } = await start(s, 'solo-debug');
    expect(r.views[0].turnPlayerIndex).toBe(0);
    expect(r.views[0].phase).toBe('Main1');
    expect(r.views[0].players[1].board.fieldZone).toEqual({
      hidden: true,
      instanceId: 'p1-0',
      ownerIndex: 1,
    });
    const hand = r.views[0].players[0].hand;
    const kill = hand.find((c) => !c.hidden && c.definitionId === 'SMP-105')!;
    const res = await manager.submitAction(
      'duel-1',
      0,
      act(activation(r.legalActionsByViewer[0], kill.instanceId)),
    );
    const destroyed = {
      type: 'FieldSpellDestroyed',
      ownerIndex: 1,
      instanceId: 'p1-0',
      definitionId: 'SMP-113',
    };
    for (const viewer of [0, 1] as const) {
      expect(res.eventsByViewer[viewer]).toContainEqual(destroyed);
    }
    expect(types(res.events)).not.toContain('SpellTrapDestroyed');
    expect(res.view.players[1].board.fieldZone).toBeNull();
    expect(res.view.players[1].graveyard.map((c) => c.instanceId)).toContain('p1-0');
    await noLeaks(manager, res);
  });

  it('continuous-real-2: the Continuous Spell goes face-up into the lowest empty Spell/Trap Zone and STAYS; my Warriors +300', async () => {
    const { manager, r } = await load('continuous-real-2');
    expect([atk(r.views[0], 0, 0), atk(r.views[0], 0, 1), atk(r.views[0], 0, 3)]).toEqual([
      1200, 1800, 1700,
    ]);
    const res = await manager.submitAction(
      'duel-1',
      0,
      act(activation(r.legalActionsByViewer[0], 'p0-0')),
    );
    expect(types(res.events)).not.toContain('CardSentToGraveyard');
    for (const viewer of [0, 1] as const) {
      const view = await manager.getView('duel-1', viewer);
      expect(view.players[0].board.spellTrapZones[0]).toMatchObject({
        hidden: false,
        instanceId: 'p0-0',
        definitionId: 'SMP-114',
        position: 'Attack',
      });
      expect(view.players[0].graveyard).toEqual([]);
      expect([atk(view, 0, 0), atk(view, 0, 1), atk(view, 0, 3)]).toEqual([1500, 2100, 1700]);
    }
    await noLeaks(manager, res);
  });

  it('continuous-real-2: the Set Continuous Trap flips face-up in place and stays; the opponent loses 300 ATK', async () => {
    const { manager, r } = await load('continuous-real-2');
    expect(r.views[1].players[0].board.spellTrapZones[2]).toMatchObject({ hidden: true });
    const res = await manager.submitAction(
      'duel-1',
      0,
      act(activation(r.legalActionsByViewer[0], 'p0-11')),
    );
    expect(types(res.events)).toContain('EffectActivated');
    expect(types(res.events)).not.toContain('CardSentToGraveyard');
    for (const viewer of [0, 1] as const) {
      const view = await manager.getView('duel-1', viewer);
      expect(view.players[0].board.spellTrapZones[2]).toMatchObject({
        hidden: false,
        definitionId: 'SMP-208',
        position: 'Attack',
      });
      expect([atk(view, 1, 1), atk(view, 1, 3)]).toEqual([1500, 1600]);
    }
    // A face-up staying card is never offered again.
    expect(
      res.legalActions.some(
        (a) => a.type === 'ActivateEffect' && a.payload.cardInstanceId === 'p0-11',
      ),
    ).toBe(false);
    await noLeaks(manager, res);
  });

  it('normal-set-real: a Normal Spell is Set, then activated from its zone on the SAME turn; it goes to the graveyard', async () => {
    const { manager, r } = await load('normal-set-real');
    const set = r.legalActionsByViewer[0].find(
      (a) =>
        a.type === 'SetSpellTrap' &&
        a.payload.cardInstanceId === 'p0-0' &&
        a.payload.zoneIndex === 2,
    )!;
    const afterSet = await manager.submitAction('duel-1', 0, act(set));
    expect(afterSet.events).toEqual([
      { type: 'SpellTrapSet', playerIndex: 0, instanceId: 'p0-0', zoneIndex: 2 },
    ]);
    const res = await manager.submitAction(
      'duel-1',
      0,
      act(activation(afterSet.legalActions, 'p0-0')),
    );
    expect(res.events).toContainEqual({ type: 'DamageDealt', playerIndex: 1, amount: 600 });
    expect(res.events).toContainEqual({
      type: 'CardSentToGraveyard',
      ownerIndex: 0,
      instanceId: 'p0-0',
      definitionId: 'SMP-115',
      from: 'SpellTrapZone',
    });
    expect(res.view.players[1].lifePoints).toBe(7400);
    expect(res.view.players[0].board.spellTrapZones[2]).toBeNull();
    await noLeaks(manager, res);
  });
});
