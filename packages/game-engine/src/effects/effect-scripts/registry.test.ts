import { describe, expect, it } from 'vitest';
import { SAMPLE_CARDS } from '@yugi/shared';
import { applyAction } from '../../apply-action.js';
import type { Action } from '../../actions/types.js';
import { getLegalActions } from '../../legal-actions.js';
import type { GameState } from '../../state/types.js';
import { deepFreeze } from '../../testing/deep-freeze.js';
import { expectEngineError } from '../../testing/expect-engine-error.js';
import { fixtureCtx, fixtureState, type FixtureSetup } from '../../testing/effect-fixtures.js';
import { EFFECT_SCRIPTS, scriptFor } from './registry.js';

/* Task 3.6 — effect-level `scriptId`: a registered handler runs on resolution, after the effect's operations. */

const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, fixtureCtx);
const main = (setup: FixtureSetup): GameState => ({
  ...fixtureState({ phase: 'Main1', ...setup }),
  turnCount: 3,
});
const activate = (cardInstanceId = 'h0'): Action => ({
  type: 'ActivateEffect',
  payload: { playerIndex: 0, cardInstanceId, effectId: 'e1' },
});

describe('script registry ↔ card data', () => {
  it('every scriptId used by an effect of a sample card is registered', () => {
    const used = SAMPLE_CARDS.flatMap((c) => c.effects ?? []).flatMap((e) =>
      e.scriptId === undefined ? [] : [e.scriptId],
    );
    for (const id of used) expect(EFFECT_SCRIPTS[id]).toBeTypeOf('function');
  });

  it('scriptFor only finds registered ids, never Object.prototype members', () => {
    expect(scriptFor('test.halve-opponent-lp')).toBe(EFFECT_SCRIPTS['test.halve-opponent-lp']);
    for (const id of ['no.such-script', 'constructor', 'toString', '__proto__', 'hasOwnProperty'])
      expect(scriptFor(id)).toBeUndefined();
  });

  it('holds only functions, including the minimal test script', () => {
    expect(Object.keys(EFFECT_SCRIPTS)).toContain('test.halve-opponent-lp');
    for (const handler of Object.values(EFFECT_SCRIPTS)) expect(handler).toBeTypeOf('function');
  });
});

describe('running a script on resolution', () => {
  it('an effect with only a script: the opponent loses half their LP (DamageDealt), the Spell goes to the graveyard', () => {
    const { state, events } = apply(main({ hand: ['SCRIPT_HALVE'] }), activate());
    expect(state.players[1].lifePoints).toBe(4000);
    const types = events.map((e) => e.type);
    expect(events).toContainEqual({ type: 'DamageDealt', playerIndex: 1, amount: 4000 });
    expect(types.indexOf('DamageDealt')).toBeLessThan(types.indexOf('EffectResolved'));
    expect(state.players[0].graveyard.map((c) => c.definitionId)).toEqual(['SCRIPT_HALVE']);
    expect(state.version).toBe(main({ hand: ['SCRIPT_HALVE'] }).version + 1);
  });

  it('operations run first, then the script', () => {
    const { state } = apply(main({ hand: ['SCRIPT_BURN_HALVE'] }), activate());
    expect(state.players[1].lifePoints).toBe(3500);
  });

  it('halving 1 LP deals 0 damage: no event, the duel goes on', () => {
    const { state, events } = apply(main({ hand: ['SCRIPT_HALVE'], oppLp: 1 }), activate());
    // floor(1 / 2) = 0 damage: nothing happens, the duel goes on.
    expect(state.players[1].lifePoints).toBe(1);
    expect(state.winnerIndex).toBeNull();
    expect(events.map((e) => e.type)).not.toContain('DamageDealt');
  });

  it('an unknown scriptId is never activatable and never listed', () => {
    const state = main({ hand: ['SCRIPT_UNKNOWN'] });
    expectEngineError(() => apply(state, activate()), 'UNKNOWN_SCRIPT');
    expect(getLegalActions(state, 0, fixtureCtx).some((a) => a.type === 'ActivateEffect')).toBe(
      false,
    );
  });

  it('a trigger with an unknown scriptId does not activate', () => {
    const { events } = apply(main({ hand: ['SUM_SCRIPT_UNKNOWN'] }), {
      type: 'NormalSummon',
      payload: { playerIndex: 0, cardInstanceId: 'h0', zoneIndex: 0 },
    });
    expect(events.map((e) => e.type)).not.toContain('EffectActivated');
  });
});
