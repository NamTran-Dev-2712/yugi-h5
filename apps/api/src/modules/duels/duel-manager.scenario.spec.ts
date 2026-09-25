import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyAction } from '@yugi/game-engine';
import { ScenarioSchema, type PlayerAction, type Scenario } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { scenarioToState } from '../dev-sandbox/scenario-to-state';
import { lookupCard } from './card-pool';
import { DuelServiceError } from './duel-errors';
import { DuelManager } from './duel-manager';
import { initialStateOf, InMemoryDuelStore } from './duel-store';

const dir = join(__dirname, '../../../../../packages/shared/scenarios');
const sample = (name: string): Scenario =>
  ScenarioSchema.parse(JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')));

function makeManager() {
  const store = new InMemoryDuelStore();
  let n = 0;
  const manager = new DuelManager({
    store,
    cardDefinitions: lookupCard,
    newDuelId: () => `duel-${++n}`,
  });
  return { manager, store };
}

const stateFor = (s: Scenario) =>
  scenarioToState(s, { matchId: 'duel-1', playerIds: ['owner', 'owner:ai'] }, lookupCard);

const config = (s: Scenario, extra: object = {}) => ({
  state: stateFor(s),
  seed: s.seed,
  mode: 'solo-vs-ai' as const,
  ownerId: 'owner',
  aiSeat: 1 as const,
  ...extra,
});

describe('DuelManager.createDuelFromState (Sandbox)', () => {
  it('opens on the loaded state, with the human seat legal actions and filtered views', async () => {
    const { manager } = makeManager();
    const r = await manager.createDuelFromState(config(sample('tribute-summon')));
    expect(r.duelId).toBe('duel-1');
    expect(r.views[0].phase).toBe('Main1');
    expect(r.views[0].turnCount).toBe(3);
    expect(r.legalActionsByViewer[0].length).toBeGreaterThan(0);
    // The human sees their own hand, the AI seat's hand stays hidden.
    expect(JSON.stringify(r.views[0])).toContain('SMP-003');
    expect(JSON.stringify(r.views[0])).not.toContain('SMP-008');
    expect(JSON.stringify(r.views[0])).not.toContain('SMP-007');
  });

  it('is a scenario session: initialState kept, no startAction, replay reproduces the final state', async () => {
    const { manager } = makeManager();
    const { duelId } = await manager.createDuelFromState(config(sample('attack-defense')));
    const before = await manager.getDuel(duelId);
    expect(before.startAction).toBeUndefined();
    const attacker = before.state.players[0].board.monsterZones[0]!;
    await manager
      .submitAction(duelId, 0, {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: attacker.instanceId },
      })
      .catch(() => undefined);
    await manager.submitAction(duelId, 0, { type: 'EndPhase', payload: { playerIndex: 0 } });
    const session = await manager.getDuel(duelId);
    let replayed = initialStateOf(session);
    for (const entry of session.actionLog) {
      replayed = applyAction(replayed, entry.action, { cardDefinitions: lookupCard }).state;
    }
    expect(replayed).toEqual(session.state);
    expect(session.actionLog.length).toBeGreaterThan(0);
  });

  it('applies script actions in order through the normal path and logs them', async () => {
    const { manager } = makeManager();
    const s = sample('tribute-summon');
    const script: PlayerAction[] = [
      { type: 'EndPhase', payload: { playerIndex: 0 } },
      { type: 'EndPhase', payload: { playerIndex: 0 } },
    ];
    const { duelId, views } = await manager.createDuelFromState(config(s, { script }));
    expect(views[0].phase).toBe('Main2');
    const session = await manager.getDuel(duelId);
    expect(session.actionLog.map((e) => e.action.type)).toEqual(['EndPhase', 'EndPhase']);
    expect(session.actionLog.map((e) => e.version)).toEqual([2, 3]);
  });

  it('returns script events (filtered) so the client can show what happened', async () => {
    const { manager } = makeManager();
    const script: PlayerAction[] = [{ type: 'EndPhase', payload: { playerIndex: 0 } }];
    const r = await manager.createDuelFromState(config(sample('tribute-summon'), { script }));
    expect(r.eventsByViewer[0].some((e) => e.type === 'PhaseChanged')).toBe(true);
  });

  it('a script action the engine rejects fails the whole load and leaves no session behind', async () => {
    const { manager, store } = makeManager();
    const script: PlayerAction[] = [
      { type: 'EndPhase', payload: { playerIndex: 0 } },
      // The turn player is 0; seat 1 acting is refused by the engine.
      { type: 'EndPhase', payload: { playerIndex: 1 } },
    ];
    const err = await manager
      .createDuelFromState(config(sample('tribute-summon'), { script }))
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(err).toBeInstanceOf(DuelServiceError);
    expect((err as DuelServiceError).code).toBe('ACTION_REJECTED');
    expect((err as DuelServiceError).message).toMatch(/script step 2/i);
    expect(await store.get('duel-1')).toBeUndefined();
  });

  it('the AI plays first when the scenario starts on its turn', async () => {
    const { manager } = makeManager();
    const s = {
      ...sample('attack-defense'),
      turn: { count: 3, player: 1 as const },
      phase: 'Main1' as const,
    };
    const r = await manager.createDuelFromState(config(s));
    expect(r.aiActions?.length ?? 0).toBeGreaterThan(0);
    expect(r.views[0].turnPlayerIndex).toBe(0);
  });

  it('rejects an unusable config (missing mode owner data does not crash)', async () => {
    const { manager } = makeManager();
    const s = sample('tribute-summon');
    const r = await manager.createDuelFromState({ state: stateFor(s), seed: s.seed });
    expect(r.views).toHaveLength(2);
    const meta = await manager.getMeta(r.duelId);
    expect(meta.mode).toBeUndefined(); // fail closed: nobody reaches it over HTTP
  });
});
