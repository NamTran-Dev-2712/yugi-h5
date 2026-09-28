import { applyDamage } from '../operations/damage.js';
import { sideIndex } from '../filter.js';
import type { EffectScriptHandler } from './types.js';

/**
 * Test-only minimal script (no real card uses it): the opponent loses half their LP, rounded down, as effect damage
 * (same event and win check as the `Damage` operation). 0 damage = nothing happens.
 */
const halveOpponentLp: EffectScriptHandler = (state, ctx) => {
  const opponent = sideIndex(ctx.controller, 'opponent');
  const amount = Math.floor(state.players[opponent].lifePoints / 2);
  if (amount === 0) return { state, events: [] };
  return applyDamage(state, { kind: 'Damage', amount, target: 'opponent' }, ctx);
};

/**
 * `scriptId` → handler (task 3.6). Card data may only reference ids listed here: the engine refuses to activate an
 * effect whose script is missing (`UNKNOWN_SCRIPT`), and a test checks every sample card. Add a script only when the
 * DSL truly cannot express a card (prefer a new operation when two cards need the same thing).
 */
export const EFFECT_SCRIPTS: Readonly<Record<string, EffectScriptHandler>> = {
  'test.halve-opponent-lp': halveOpponentLp,
};

export function scriptFor(scriptId: string): EffectScriptHandler | undefined {
  return Object.prototype.hasOwnProperty.call(EFFECT_SCRIPTS, scriptId)
    ? EFFECT_SCRIPTS[scriptId]
    : undefined;
}
