import { getLegalActions, type CardInstance, type GameState } from '@yugi/game-engine';
import type { CardDefinition, PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { toStateView } from '../state-view';
import { toPlayerActions } from '../wire-actions';
import { AI_DEFS, AI_SEAT, buildState, type Scenario } from './ai-test-kit';
import { createAiRng } from './ai-rng';
import { AiNoActionError, chooseAction } from './choose-action';

/**
 * Task 4.3b — the Field Zone is on the wire, so the AI's `legalActions` now carry `SetSpellTrap` into the Field Zone and
 * `ActivateEffect` of a Field / Continuous card. The AI must (1) never get stuck on them (`AiNoActionError`) and (2)
 * still never Set / activate a Spell/Trap on its own outside a window it holds (ADR 048, 055): it ends the phase.
 */

const text = (s: string) => ({ vi: s, en: s });
const staying = (id: string, kind: 'Spell' | 'Trap', subType: string): CardDefinition =>
  ({
    id,
    kind,
    name: text(id),
    subType,
    effects: [
      { id: 'e1', trigger: { kind: kind === 'Trap' ? 'Quick' : 'Ignition' }, operations: [] },
      {
        id: 'e2',
        trigger: { kind: 'Continuous' },
        operations: [{ kind: 'ModifyStat', stat: 'atk', amount: -300, side: 'opponent' }],
      },
    ],
  }) as CardDefinition;

const EXTRA: Record<string, CardDefinition> = {
  FLD: staying('FLD', 'Spell', 'Field'),
  CSP: staying('CSP', 'Spell', 'Continuous'),
  CTR: staying('CTR', 'Trap', 'Continuous'),
};
const defs = (id: string) => EXTRA[id] ?? AI_DEFS[id];

const card = (instanceId: string, definitionId: string): CardInstance => ({
  instanceId,
  definitionId,
  ownerIndex: AI_SEAT,
  position: 'DefenseDown',
});

/** The AI's board gets a Set Field Spell (`f0`) and/or Set Spell/Trap cards (`s<i>`), Set on an earlier turn. */
function withBackrow(
  s: Scenario,
  backrow: { field?: string; spellTraps?: readonly string[] },
): GameState {
  const state = buildState(s);
  const ai = state.players[AI_SEAT];
  const zones = [null, null, null, null, null] as (CardInstance | null)[];
  (backrow.spellTraps ?? []).forEach((d, i) => (zones[i] = card(`s${i}`, d)));
  const players = [...state.players] as [GameState['players'][0], GameState['players'][1]];
  players[AI_SEAT] = {
    ...ai,
    board: {
      ...ai.board,
      spellTrapZones: zones as unknown as typeof ai.board.spellTrapZones,
      fieldZone: backrow.field ? card('f0', backrow.field) : null,
    },
  };
  return { ...state, players };
}

function see(state: GameState) {
  return {
    view: toStateView(state, AI_SEAT, defs),
    legalActions: toPlayerActions(getLegalActions(state, AI_SEAT, { cardDefinitions: defs })),
  };
}
const decide = (sit: ReturnType<typeof see>, seed: string, legal = sit.legalActions) =>
  chooseAction({
    view: sit.view,
    legalActions: legal,
    cardDefinitions: defs,
    rng: createAiRng(seed),
  });
const SEEDS = ['a', 'b', 'c', 'd', 'e'];
const isSpellTrapMove = (a: PlayerAction) =>
  a.type === 'SetSpellTrap' || a.type === 'ActivateEffect';

describe('chooseAction — Field Zone / staying cards in legalActions (task 4.3b)', () => {
  it('a Field Spell in the hand: Set (zoneIndex 0) and activation are listed; the AI takes neither and ends the phase', () => {
    const sit = see(withBackrow({ hand: ['FLD'], normalSummoned: true }, {}));
    expect(sit.legalActions).toContainEqual({
      type: 'SetSpellTrap',
      payload: { playerIndex: AI_SEAT, cardInstanceId: 'm0', zoneIndex: 0 },
    });
    expect(sit.legalActions.some((a) => a.type === 'ActivateEffect')).toBe(true);
    for (const seed of SEEDS) expect(decide(sit, seed).type).toBe('EndPhase');
  });

  it('a Set Field Spell and a Set Continuous Spell of its own: their activations are listed; the AI still ends the phase', () => {
    const sit = see(
      withBackrow({ normalSummoned: true }, { field: 'FLD', spellTraps: ['CSP', 'CTR'] }),
    );
    const listed = sit.legalActions.filter((a) => a.type === 'ActivateEffect');
    expect(
      listed.map((a) => a.type === 'ActivateEffect' && a.payload.cardInstanceId).sort(),
    ).toEqual(['f0', 's0', 's1']);
    for (const seed of SEEDS) expect(decide(sit, seed).type).toBe('EndPhase');
  });

  it('with a monster to play it plays the monster, never the Field / Continuous cards', () => {
    const sit = see(withBackrow({ hand: ['FLD', 'CSP', 'A1900'] }, { field: 'FLD' }));
    for (const seed of SEEDS) {
      const a = decide(sit, seed);
      expect(isSpellTrapMove(a), JSON.stringify(a)).toBe(false);
      expect(a.type).toBe('NormalSummon');
    }
  });

  it('never throws AiNoActionError while a Field Set / activation is listed, even without EndPhase', () => {
    const sit = see(withBackrow({ hand: ['FLD'], normalSummoned: true }, { field: 'FLD' }));
    const onlyField = sit.legalActions.filter((a) => isSpellTrapMove(a) || a.type === 'Surrender');
    expect(onlyField.some(isSpellTrapMove)).toBe(true);
    for (const seed of SEEDS) {
      let answer: PlayerAction | undefined;
      expect(() => (answer = decide(sit, seed, onlyField))).not.toThrow(AiNoActionError);
      expect(answer?.type).not.toBe('Surrender');
      expect(onlyField).toContainEqual(answer);
    }
  });

  it('holding a reaction window with only a Set Continuous Trap (no harm in its activation): it passes', () => {
    const base = withBackrow({ normalSummoned: true }, { spellTraps: ['CTR'] });
    // The human (seat 0) is on turn and just attacked: the AI holds the window.
    const state: GameState = {
      ...base,
      turnPlayerIndex: 0,
      phase: 'Battle',
      chainWindow: { priorityPlayer: AI_SEAT, passCount: 0, reactionTo: { kind: 'Summon' } },
    };
    const sit = see(state);
    expect(sit.legalActions.some((a) => a.type === 'ActivateEffect')).toBe(true);
    for (const seed of SEEDS) expect(decide(sit, seed).type).toBe('PassPriority');
  });
});
