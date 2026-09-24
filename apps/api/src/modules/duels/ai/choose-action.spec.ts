import type { PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { AI_DEFS, AI_SEAT, buildState, scenario, situation, type Scenario } from './ai-test-kit';
import { chooseAction, AiNoActionError } from './choose-action';
import { createAiRng } from './ai-rng';

const pick = (s: Scenario, opts: { seed?: string } = {}): PlayerAction => {
  const sit = scenario(s);
  return chooseAction({
    view: sit.view,
    legalActions: sit.legalActions,
    cardDefinitions: (id) => AI_DEFS[id],
    rng: createAiRng(opts.seed ?? 'seed'),
  });
};

const summonedCard = (a: PlayerAction) =>
  a.type === 'NormalSummon' || a.type === 'SetMonster' ? a.payload.cardInstanceId : undefined;

describe('chooseAction — pending prompt', () => {
  it('discards the lowest-value cards (spell first, then the weakest monster)', () => {
    const a = pick({
      hand: ['A2000', 'SP', 'A1000', 'T2400', 'A1500', 'A1900', 'H3000'],
      pendingDiscard: 1,
    });
    expect(a.type).toBe('ResolvePendingPrompt');
    if (a.type !== 'ResolvePendingPrompt') return;
    expect(a.payload.cardInstanceIds).toEqual(['m1']); // the Spell
  });

  it('discards two weakest when asked for two', () => {
    const a = pick({
      hand: ['A2000', 'A1000', 'A1500', 'T2400', 'A1900', 'H3000', 'D2000'],
      pendingDiscard: 2,
    });
    if (a.type !== 'ResolvePendingPrompt') throw new Error('expected prompt answer');
    expect([...a.payload.cardInstanceIds].sort()).toEqual(['m1', 'm6']); // A1000 (1000) and D2000 (ATK 800)
  });
});

describe('chooseAction — Main Phase summoning', () => {
  it('Normal Summons the strongest no-tribute monster when it beats every opposing attacker', () => {
    const a = pick({ hand: ['A1000', 'A2000', 'A1500'], theirs: [{ def: 'A1500' }] });
    expect(a.type).toBe('NormalSummon');
    expect(summonedCard(a)).toBe('m1');
    if (a.type === 'NormalSummon') expect(a.payload.tributeInstanceIds ?? []).toEqual([]);
  });

  it('sets (does not summon) when the best monster is not stronger than the opposing attacker', () => {
    const a = pick({ hand: ['A1000', 'A1500'], theirs: [{ def: 'A2000' }] });
    expect(a.type).toBe('SetMonster');
  });

  it('sets the monster with the highest DEF when it must play defensively', () => {
    const a = pick({ hand: ['A1500', 'D2000'], theirs: [{ def: 'A2000' }] });
    expect(a.type).toBe('SetMonster');
    expect(summonedCard(a)).toBe('m1');
  });

  it('does not count a defense-position opposing monster as a threat', () => {
    const a = pick({ hand: ['A1500'], theirs: [{ def: 'A2000', position: 'DefenseUp' }] });
    expect(a.type).toBe('NormalSummon');
  });

  it('tribute summons when the new monster is far stronger than what it sacrifices', () => {
    const a = pick({
      hand: ['H3000'],
      mine: [{ def: 'A1000' }, { def: 'A1500' }, { def: 'A2000' }],
    });
    expect(a.type).toBe('NormalSummon');
    if (a.type !== 'NormalSummon') return;
    // lvl 7 needs 2 tributes: the two weakest are A1000 (o0) and A1500 (o1); 3000 >= 2500 + 300
    expect([...(a.payload.tributeInstanceIds ?? [])].sort()).toEqual(['o0', 'o1']);
  });

  it('does not tribute summon when the gain is not worth it', () => {
    const a = pick({ hand: ['T2400'], mine: [{ def: 'T2400' }] });
    // 2400 < 2400 + 300 margin: skip (nothing else to do -> ends the phase)
    expect(a.type).toBe('EndPhase');
  });

  it('prefers a free Normal Summon over a tribute summon with a smaller net gain', () => {
    const a = pick({ hand: ['A2000', 'T2600'], mine: [{ def: 'A2000' }] });
    expect(a.type).toBe('NormalSummon');
    expect(summonedCard(a)).toBe('m0');
  });

  it('does not summon or set anything once the Normal Summon is used', () => {
    const a = pick({ hand: ['A2000'], normalSummoned: true });
    expect(a.type).toBe('EndPhase');
  });

  it('never picks a Spell to summon', () => {
    const a = pick({ hand: ['SP'] });
    expect(a.type).toBe('EndPhase');
  });
});

describe('chooseAction — changing position', () => {
  it('moves a monster that would lose to the opposing attacker into defense', () => {
    const a = pick({
      normalSummoned: true,
      mine: [{ def: 'A1500' }],
      theirs: [{ def: 'A2000' }],
    });
    expect(a).toMatchObject({
      type: 'ChangePosition',
      payload: { cardInstanceId: 'o0', toPosition: 'DefenseUp' },
    });
  });

  it('moves a defending monster back to attack when it clearly beats the opposing attacker', () => {
    const a = pick({
      normalSummoned: true,
      mine: [{ def: 'A2000', position: 'DefenseUp' }],
      theirs: [{ def: 'A1000' }],
    });
    expect(a).toMatchObject({
      type: 'ChangePosition',
      payload: { cardInstanceId: 'o0', toPosition: 'Attack' },
    });
  });

  it('leaves a strong attacker alone', () => {
    const a = pick({
      normalSummoned: true,
      mine: [{ def: 'A2000' }],
      theirs: [{ def: 'A1000' }],
    });
    expect(a.type).toBe('EndPhase');
  });
});

describe('chooseAction — Battle Phase', () => {
  it('attacks directly whenever it can, with the strongest attacker', () => {
    const a = pick({
      phase: 'Battle',
      mine: [{ def: 'A1500' }, { def: 'A2000' }],
    });
    expect(a).toMatchObject({
      type: 'DeclareAttack',
      payload: { playerIndex: AI_SEAT, attackerInstanceId: 'o1' },
    });
    if (a.type === 'DeclareAttack') expect(a.payload.targetInstanceId ?? null).toBeNull();
  });

  it('attacks a face-up monster only when its ATK wins', () => {
    const win = pick({ phase: 'Battle', mine: [{ def: 'A2000' }], theirs: [{ def: 'A1500' }] });
    expect(win).toMatchObject({ type: 'DeclareAttack', payload: { targetInstanceId: 't0' } });
    const lose = pick({ phase: 'Battle', mine: [{ def: 'A1500' }], theirs: [{ def: 'A2000' }] });
    expect(lose.type).toBe('EndPhase');
  });

  it('does not trade on equal ATK (would destroy itself)', () => {
    const a = pick({ phase: 'Battle', mine: [{ def: 'A2000' }], theirs: [{ def: 'A2000' }] });
    expect(a.type).toBe('EndPhase');
  });

  it('attacks a defense-position monster only when ATK beats its DEF', () => {
    const lose = pick({
      phase: 'Battle',
      mine: [{ def: 'A1900' }],
      theirs: [{ def: 'D2000', position: 'DefenseUp' }],
    });
    expect(lose.type).toBe('EndPhase');
    const win = pick({
      phase: 'Battle',
      mine: [{ def: 'T2400' }],
      theirs: [{ def: 'D2000', position: 'DefenseUp' }],
    });
    expect(win).toMatchObject({ type: 'DeclareAttack', payload: { targetInstanceId: 't0' } });
  });

  it('attacks a face-down monster only from the (configurable) ATK threshold', () => {
    const weak = pick({
      phase: 'Battle',
      mine: [{ def: 'A1500' }],
      theirs: [{ def: 'A2000', position: 'DefenseDown' }],
    });
    expect(weak.type).toBe('EndPhase');
    const strong = pick({
      phase: 'Battle',
      mine: [{ def: 'A2000' }],
      theirs: [{ def: 'A1000', position: 'DefenseDown' }],
    });
    expect(strong).toMatchObject({ type: 'DeclareAttack', payload: { targetInstanceId: 't0' } });
    const sit = scenario({
      phase: 'Battle',
      mine: [{ def: 'A1500' }],
      theirs: [{ def: 'A2000', position: 'DefenseDown' }],
    });
    const lowThreshold = chooseAction({
      view: sit.view,
      legalActions: sit.legalActions,
      cardDefinitions: (id) => AI_DEFS[id],
      rng: createAiRng('x'),
      config: { facedownAttackMinAtk: 1500 },
    });
    expect(lowThreshold.type).toBe('DeclareAttack');
  });

  it('prefers destroying an attack-position monster over a defense-position one', () => {
    const a = pick({
      phase: 'Battle',
      mine: [{ def: 'T2600' }],
      theirs: [
        { def: 'A1000', position: 'DefenseUp' },
        { def: 'A1500', position: 'Attack' },
      ],
    });
    expect(a).toMatchObject({ type: 'DeclareAttack', payload: { targetInstanceId: 't1' } });
  });
});

describe('chooseAction — safety net', () => {
  it('never returns Surrender when something else is legal', () => {
    for (const phase of ['Draw', 'Standby', 'Main1', 'Battle', 'Main2', 'End'] as const) {
      expect(pick({ phase }).type).not.toBe('Surrender');
    }
  });

  it('ends the phase when nothing useful is left', () => {
    expect(pick({ hand: [], phase: 'Main2' }).type).toBe('EndPhase');
  });

  it('falls back to the first non-Surrender action when EndPhase is not offered', () => {
    // Battle Phase: the policy has nothing to attack with; the offered list has no EndPhase.
    const sit = scenario({ hand: ['A1500'], phase: 'Battle' });
    const set = scenario({ hand: ['A1500'] }).legalActions.find((x) => x.type === 'SetMonster')!;
    const a = chooseAction({
      view: sit.view,
      legalActions: [sit.legalActions.find((x) => x.type === 'Surrender')!, set],
      cardDefinitions: (id) => AI_DEFS[id],
      rng: createAiRng('x'),
    });
    expect(a.type).toBe('SetMonster');
  });

  it('throws (instead of surrendering) when Surrender is all that is legal', () => {
    const sit = scenario();
    const only = sit.legalActions.filter((a) => a.type === 'Surrender');
    expect(only).toHaveLength(1);
    expect(() =>
      chooseAction({
        view: sit.view,
        legalActions: only,
        cardDefinitions: (id) => AI_DEFS[id],
        rng: createAiRng('x'),
      }),
    ).toThrow(AiNoActionError);
  });

  it('throws on an empty legal list', () => {
    const sit = scenario();
    expect(() =>
      chooseAction({
        view: sit.view,
        legalActions: [],
        cardDefinitions: (id) => AI_DEFS[id],
        rng: createAiRng('x'),
      }),
    ).toThrow(AiNoActionError);
  });

  it('always answers with one of the given legal actions', () => {
    const kinds: Scenario[] = [
      { hand: ['A1000', 'A2000', 'H3000', 'SP'], mine: [{ def: 'A1500' }] },
      {
        phase: 'Battle',
        mine: [{ def: 'A2000' }],
        theirs: [{ def: 'A1000', position: 'DefenseDown' }],
      },
      { hand: ['A1000', 'A2000', 'H3000', 'SP', 'A1500', 'A1900', 'T2400'], pendingDiscard: 1 },
    ];
    for (const k of kinds) {
      const sit = scenario(k);
      const a = chooseAction({
        view: sit.view,
        legalActions: sit.legalActions,
        cardDefinitions: (id) => AI_DEFS[id],
        rng: createAiRng('r'),
      });
      expect(sit.legalActions.map((x) => JSON.stringify(x))).toContain(JSON.stringify(a));
    }
  });
});

describe('chooseAction — determinism and no peeking', () => {
  it('is deterministic for the same input and seed', () => {
    const s = { hand: ['A1500', 'A1500', 'A1500'], theirs: [{ def: 'A1000' }] } as const;
    expect(pick(s, { seed: 's1' })).toEqual(pick(s, { seed: 's1' }));
  });

  it('cannot tell two states apart that differ only in hidden opponent information', () => {
    const base: Scenario = {
      hand: ['A1500', 'A2000', 'T2400'],
      mine: [{ def: 'A1500' }],
      theirs: [{ def: 'A1900' }, { def: 'A2000', position: 'DefenseDown', zone: 3 }],
      theirHand: ['A1000', 'A1000', 'A1000'],
      theirDeck: Array.from({ length: 30 }, () => 'A1000'),
    };
    const other: Scenario = {
      ...base,
      // same visible board, different face-down identity, opponent hand and deck order
      theirs: [{ def: 'A1900' }, { def: 'H3000', position: 'DefenseDown', zone: 3 }],
      theirHand: ['H3000', 'SP', 'T2400'],
      theirDeck: Array.from({ length: 30 }, (_, i) => (i % 2 ? 'H3000' : 'SP')),
    };
    for (const phase of ['Main1', 'Battle', 'Main2'] as const) {
      const a = situation(buildState({ ...base, phase }));
      const b = situation(buildState({ ...other, phase }));
      // The premise that makes this test meaningful: the AI's window into both states is identical...
      expect(JSON.stringify(b.view)).toEqual(JSON.stringify(a.view));
      expect(JSON.stringify(b.legalActions)).toEqual(JSON.stringify(a.legalActions));
      // ...even though the raw states really do differ in hidden information.
      expect(JSON.stringify(b.state.players[0])).not.toEqual(JSON.stringify(a.state.players[0]));
      // Different hidden facts must not change the answer (same views => same input => same output).
      const args = (s: typeof a) => ({
        view: s.view,
        legalActions: s.legalActions,
        cardDefinitions: (id: string) => AI_DEFS[id],
      });
      const ra = chooseAction({ ...args(a), rng: createAiRng('meta') });
      const rb = chooseAction({ ...args(b), rng: createAiRng('meta') });
      expect(rb).toEqual(ra);
    }
  });
});
