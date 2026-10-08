import { SAMPLE_CARDS } from '@yugi/shared';
import { applyAction } from '../apply-action.js';
import type { Action, ActionContext, ActivateEffectAction } from '../actions/types.js';
import type { GameState } from '../state/types.js';
import { effectiveStats } from '../effects/continuous.js';
import { deepFreeze } from './deep-freeze.js';
import { FIXTURE_DEFS, fixtureState, type FixtureSetup } from './effect-fixtures.js';

/*
 * Task 3.8 — helpers for the per-card tests of the REAL sample cards (`cards/sample/<id>.test.ts`): the real
 * `SAMPLE_CARDS` data runs through `applyAction`. Filler cards (`D` deck, `M1`, `BIG`...) come from the test-only
 * FIXTURE_DEFS; a real card id always wins.
 */

const SAMPLE_BY_ID = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));

export const sampleCtx: ActionContext = {
  cardDefinitions: (id) => SAMPLE_BY_ID.get(id) ?? FIXTURE_DEFS[id],
};

export const apply = (state: GameState, action: Action) =>
  applyAction(deepFreeze(state), action, sampleCtx);

export const types = (events: readonly { type: string }[]) => events.map((e) => e.type);

/** Player 0 is the turn player; turnCount 3 so attacks are allowed. */
export const main = (setup: FixtureSetup, phase: 'Main1' | 'Main2' = 'Main1'): GameState => ({
  ...fixtureState({ phase, ...setup }),
  turnCount: 3,
});

export const battle = (setup: FixtureSetup): GameState => ({
  ...fixtureState({ phase: 'Battle', ...setup }),
  turnCount: 3,
});

export const summon = (cardInstanceId: string, zoneIndex = 0): Action => ({
  type: 'NormalSummon',
  payload: { playerIndex: 0, cardInstanceId, zoneIndex },
});

export const setMonster = (cardInstanceId: string, zoneIndex = 0): Action => ({
  type: 'SetMonster',
  payload: { playerIndex: 0, cardInstanceId, zoneIndex },
});

export const setSpellTrap = (cardInstanceId: string, zoneIndex = 0): Action => ({
  type: 'SetSpellTrap',
  payload: { playerIndex: 0, cardInstanceId, zoneIndex },
});

export const attack = (attackerInstanceId: string, targetInstanceId?: string): Action => ({
  type: 'DeclareAttack',
  payload: {
    playerIndex: 0,
    attackerInstanceId,
    ...(targetInstanceId ? { targetInstanceId } : {}),
  },
});

export const activate = (
  cardInstanceId: string,
  effectId: string,
  playerIndex: 0 | 1 = 0,
  costInstanceIds?: string[],
): ActivateEffectAction => ({
  type: 'ActivateEffect',
  payload: {
    playerIndex,
    cardInstanceId,
    effectId,
    ...(costInstanceIds ? { costInstanceIds } : {}),
  },
});

export const pass = (playerIndex: 0 | 1): Action => ({
  type: 'PassPriority',
  payload: { playerIndex },
});

export const answer = (
  state: GameState,
  cardInstanceIds: string[] = [],
  decline?: boolean,
): Action => ({
  type: 'ResolvePendingPrompt',
  payload: {
    playerIndex: state.pendingPrompt!.playerIndex,
    promptId: state.pendingPrompt!.promptId,
    cardInstanceIds,
    ...(decline !== undefined ? { decline } : {}),
  },
});

export const lp = (state: GameState): [number, number] => [
  state.players[0].lifePoints,
  state.players[1].lifePoints,
];

/** Task 4.7 — Flip Summon one of player 0's face-down monsters. */
export const flipSummon = (cardInstanceId: string): Action => ({
  type: 'FlipSummon',
  payload: { playerIndex: 0, cardInstanceId },
});

export const endPhase = (playerIndex: 0 | 1 = 0): Action => ({
  type: 'EndPhase',
  payload: { playerIndex },
});

/** Task 4.7 — ATK / DEF of the monster in `player`'s Monster Zone `zone` after every Continuous effect. */
export const stats = (state: GameState, player: 0 | 1, zone = 0): { atk: number; def: number } => {
  const { atk, def } = effectiveStats(
    state,
    state.players[player].board.monsterZones[zone]!,
    sampleCtx,
  );
  return { atk, def };
};
