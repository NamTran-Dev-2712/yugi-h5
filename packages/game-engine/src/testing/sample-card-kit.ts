import { SAMPLE_CARDS, type CardDefinition, type EffectDefinition } from '@yugi/shared';
import { applyAction } from '../apply-action.js';
import type { Action, ActionContext, ActivateEffectAction } from '../actions/types.js';
import type { GameState } from '../state/types.js';
import { effectiveStats } from '../effects/continuous.js';
import { deepFreeze } from './deep-freeze.js';
import { effectMonster, FIXTURE_DEFS, fixtureState, type FixtureSetup } from './effect-fixtures.js';

/*
 * Task 3.8 — helpers for the per-card tests of the REAL sample cards (`cards/sample/<id>.test.ts`): the real
 * `SAMPLE_CARDS` data runs through `applyAction`. Filler cards (`D` deck, `M1`, `BIG`...) come from the test-only
 * FIXTURE_DEFS; a real card id always wins.
 */

const SAMPLE_BY_ID = new Map(SAMPLE_CARDS.map((c) => [c.id, c]));

/** An Effect Monster (Level 4, ATK 1500 / DEF 1000) with one effect `e1`. */
const kitMonster = (id: string, effect: Omit<EffectDefinition, 'id'>): CardDefinition =>
  effectMonster(id, effect, { atk: 1500 });

/**
 * Task 4.8 — test-only cards (never in `SAMPLE_CARDS`) for what no real card does yet:
 * - `P7_*`: a monster whose "when destroyed" trigger destroys 1 Spell/Trap the opponent controls — the first design of
 *   SMP-056, the card that showed the unanswerable prompt (docs/ai/decisions 071);
 * - `IGN_*`: monsters with an Ignition effect activated from the field (`ruleset.allowMonsterEffectActivation`).
 */
export const KIT_DEFS: Record<string, CardDefinition> = {
  /** OnDestroyed OPTIONAL: destroy 1 Spell/Trap the opponent controls. */
  P7_DES_KILL_ST: kitMonster('P7_DES_KILL_ST', {
    trigger: { kind: 'OnDestroyed' },
    target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  /** The same, MANDATORY. */
  P7_DES_KILL_ST_M: kitMonster('P7_DES_KILL_ST_M', {
    trigger: { kind: 'OnDestroyed', mandatory: true },
    target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  /** Ignition, cost: pay 500 LP — 500 damage to the opponent. No limit per turn. */
  IGN_PAY: kitMonster('IGN_PAY', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'PayLP', amount: 500 }],
    operations: [{ kind: 'Damage', amount: 500, target: 'opponent' }],
  }),
  /** Ignition, cost: discard 1 card — draw 2. */
  IGN_DISCARD: kitMonster('IGN_DISCARD', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Discard', count: 1 }],
    operations: [{ kind: 'Draw', count: 2, target: 'self' }],
  }),
  /** Ignition, ONCE PER TURN, cost: pay 500 LP — 500 damage to the opponent. */
  IGN_ONCE: kitMonster('IGN_ONCE', {
    trigger: { kind: 'Ignition' },
    oncePerTurn: true,
    cost: [{ kind: 'PayLP', amount: 500 }],
    operations: [{ kind: 'Damage', amount: 500, target: 'opponent' }],
  }),
  /** Ignition, cost: Tribute 1 monster (another one) — gain 500 LP. */
  IGN_TRIBUTE: kitMonster('IGN_TRIBUTE', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Tribute', count: 1 }],
    operations: [{ kind: 'Heal', amount: 500, target: 'self' }],
  }),
  /** Ignition with a target: destroy 1 monster the opponent controls. */
  IGN_KILL: kitMonster('IGN_KILL', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  /** A Quick effect on a monster: not activatable yet (only Ignition is, task 4.8). */
  MON_QUICK: kitMonster('MON_QUICK', {
    trigger: { kind: 'Quick' },
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
};

export const sampleCtx: ActionContext = {
  cardDefinitions: (id) => SAMPLE_BY_ID.get(id) ?? FIXTURE_DEFS[id] ?? KIT_DEFS[id],
};

/** Task 4.8 — the same state with `ruleset.allowMonsterEffectActivation` switched on (it is off by default). */
export const withMonsterEffects = (state: GameState): GameState => ({
  ...state,
  ruleset: { ...state.ruleset, allowMonsterEffectActivation: true },
});

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
