import type { CardDefinition, EffectDefinition, PlayerAction, StateView } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { AI_DEFS, AI_SEAT, scenario } from './ai-test-kit';
import { createAiRng } from './ai-rng';
import { chooseAction } from './choose-action';

/**
 * Task 4.2d — the AI does not use the new mechanics on its own, but (1) never takes FlipSummon as a fallback instead of
 * EndPhase and (2) answers target prompts of a Special Summon / Equip effect: there its own cards are the point of the
 * effect (worth their ATK), not a loss.
 */

const text = (s: string) => ({ vi: s, en: s });
const spell = (id: string, subType: string, effects: EffectDefinition[]): CardDefinition =>
  ({ id, kind: 'Spell', name: text(id), subType, effects }) as CardDefinition;

const EXTRA: Record<string, CardDefinition> = {
  'SS-HAND': spell('SS-HAND', 'Normal', [
    {
      id: 'e1',
      trigger: { kind: 'Ignition' },
      target: { kind: 'Card', zone: 'Hand', side: 'self', count: 1, filter: { kind: 'Monster' } },
      operations: [{ kind: 'SpecialSummon' }],
    },
  ]),
  'SS-GY': spell('SS-GY', 'Normal', [
    {
      id: 'e1',
      trigger: { kind: 'Ignition' },
      target: {
        kind: 'Card',
        zone: 'Graveyard',
        side: 'self',
        count: 1,
        filter: { kind: 'Monster' },
      },
      operations: [{ kind: 'SpecialSummon' }],
    },
  ]),
  'EQ-UP': spell('EQ-UP', 'Equip', [
    {
      id: 'e1',
      trigger: { kind: 'Ignition' },
      target: {
        kind: 'Card',
        zone: 'MonsterZone',
        side: 'self',
        count: 1,
        filter: { kind: 'Monster' },
      },
      operations: [{ kind: 'Equip' }],
    },
    {
      id: 'e2',
      trigger: { kind: 'Continuous' },
      operations: [{ kind: 'ModifyStat', stat: 'atk', amount: 500, equipped: true }],
    },
  ]),
};
const defs = (id: string) => EXTRA[id] ?? AI_DEFS[id];

const answer = (promptId: string, ids: string[]): PlayerAction => ({
  type: 'ResolvePendingPrompt',
  payload: { playerIndex: AI_SEAT, promptId, cardInstanceIds: ids },
});

const targetPrompt = (cardInstanceId: string, candidates: string[]) => ({
  promptId: 'target-4-9',
  playerIndex: AI_SEAT,
  kind: 'SelectEffectTarget',
  payload: {
    cardInstanceId,
    effectId: 'e1',
    costInstanceIds: [],
    candidateInstanceIds: candidates,
    count: 1,
  },
});

const choose = (view: StateView, legal: PlayerAction[], seed = 'm') =>
  chooseAction({ view, legalActions: legal, cardDefinitions: defs, rng: createAiRng(seed) });

describe('chooseAction — task 4.2 mechanics (task 4.2d)', () => {
  it('Special Summon from the hand: picks my strongest hand monster (not the weakest)', () => {
    const sit = scenario({ hand: ['SS-HAND', 'A1000', 'A2000'] });
    const view = { ...sit.view, pendingPrompt: targetPrompt('m0', ['m1', 'm2']) };
    const legal = [answer('target-4-9', ['m1']), answer('target-4-9', ['m2'])];
    for (const seed of ['a', 'b', 'c']) expect(choose(view, legal, seed)).toEqual(legal[1]);
  });

  it('Special Summon from the graveyard: reads my graveyard monsters', () => {
    const sit = scenario({ hand: ['SS-GY'] });
    const own = sit.view.players[AI_SEAT];
    const gy = [
      {
        hidden: false as const,
        instanceId: 'g0',
        definitionId: 'A1000',
        position: null,
        ownerIndex: AI_SEAT,
      },
      {
        hidden: false as const,
        instanceId: 'g1',
        definitionId: 'A2000',
        position: null,
        ownerIndex: AI_SEAT,
      },
    ];
    const players = [...sit.view.players] as [StateView['players'][0], StateView['players'][1]];
    players[AI_SEAT] = { ...own, graveyard: gy };
    const view: StateView = {
      ...sit.view,
      players,
      pendingPrompt: targetPrompt('m0', ['g0', 'g1']),
    };
    const legal = [answer('target-4-9', ['g0']), answer('target-4-9', ['g1'])];
    for (const seed of ['a', 'b', 'c']) expect(choose(view, legal, seed)).toEqual(legal[1]);
  });

  it('Equip on my monster: picks my strongest monster', () => {
    const sit = scenario({ hand: ['EQ-UP'], mine: [{ def: 'A1000' }, { def: 'A2000' }] });
    const view = { ...sit.view, pendingPrompt: targetPrompt('m0', ['o0', 'o1']) };
    const legal = [answer('target-4-9', ['o0']), answer('target-4-9', ['o1'])];
    for (const seed of ['a', 'b', 'c']) expect(choose(view, legal, seed)).toEqual(legal[1]);
  });

  it('a harmful target prompt still spares my cards (unchanged)', () => {
    const sit = scenario({ theirs: [{ def: 'A1000' }], mine: [{ def: 'A2000' }] });
    const view = { ...sit.view, pendingPrompt: targetPrompt('x', ['o0', 't0']) };
    const legal = [answer('target-4-9', ['o0']), answer('target-4-9', ['t0'])];
    expect(choose(view, legal)).toEqual(legal[1]);
  });

  const decide = (sit: ReturnType<typeof scenario>, seed: string) =>
    chooseAction({
      view: sit.view,
      legalActions: sit.legalActions,
      cardDefinitions: defs,
      rng: createAiRng(seed),
    });

  it('never takes FlipSummon as a fallback: a Set monster that would lose stays down, EndPhase instead', () => {
    const sit = scenario({
      mine: [{ def: 'A1000', position: 'DefenseDown' }],
      theirs: [{ def: 'A2000' }],
      normalSummoned: true,
    });
    expect(sit.legalActions.some((a) => a.type === 'FlipSummon')).toBe(true);
    for (const seed of ['a', 'b', 'c', 'd']) {
      const a = decide(sit, seed);
      expect(a.type).toBe('EndPhase');
    }
  });

  it('Flip Summons a Set monster that beats everything face-up (Main 1 only)', () => {
    const s = {
      mine: [{ def: 'A2000', position: 'DefenseDown' as const }],
      theirs: [{ def: 'A1000' }],
      normalSummoned: true,
    };
    expect(decide(scenario(s), 'a')).toEqual({
      type: 'FlipSummon',
      payload: { playerIndex: AI_SEAT, cardInstanceId: 'o0' },
    });
    expect(decide(scenario({ ...s, phase: 'Main2' }), 'a').type).toBe('EndPhase');
  });
});
