import type { CardDefinition, EffectDefinition } from '@yugi/shared';
import { applyAction } from '../apply-action.js';
import type { ActionContext } from '../actions/types.js';
import type { CardInstance, GameState, Phase } from '../state/types.js';

/** Test-only card pool for the effect handlers (not part of SAMPLE_CARDS; real batch-1 cards arrive in task 3.8). */

const text = (s: string) => ({ vi: s, en: s });

export function spell(id: string, effect: Omit<EffectDefinition, 'id'>): CardDefinition {
  return {
    id,
    kind: 'Spell',
    name: text(id),
    subType: 'Normal',
    effects: [{ id: 'e1', ...effect } as EffectDefinition],
  };
}

export function monster(id: string, level = 4, race = 'Warrior'): CardDefinition {
  return {
    id,
    kind: 'Monster',
    name: text(id),
    category: 'Normal',
    attribute: 'EARTH',
    race,
    level,
    atk: 1000,
    def: 1000,
  };
}

export const FIXTURE_DEFS: Record<string, CardDefinition> = {
  M1: monster('M1'),
  M2: monster('M2', 2, 'Dragon'),
  D: monster('D'),
  DRAW: spell('DRAW', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Draw', count: 1, target: 'self' }],
  }),
  DRAW3: spell('DRAW3', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Draw', count: 3, target: 'self' }],
  }),
  BURN: spell('BURN', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Damage', amount: 500, target: 'opponent' }],
  }),
  BURN_ALL: spell('BURN_ALL', {
    trigger: { kind: 'Ignition' },
    operations: [
      { kind: 'Damage', amount: 9000, target: 'opponent' },
      { kind: 'Heal', amount: 1000, target: 'self' },
    ],
  }),
  HEAL: spell('HEAL', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Heal', amount: 700, target: 'self' }],
  }),
  KILL: spell('KILL', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  DRAW_OPP: spell('DRAW_OPP', {
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Draw', count: 2, target: 'opponent' }],
  }),
  KILL2: spell('KILL2', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 2 },
    operations: [{ kind: 'Destroy' }],
  }),
  DISCARD2: spell('DISCARD2', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Discard', count: 2 }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  DISCARD_LV: spell('DISCARD_LV', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Discard', count: 1, filter: { level: { min: 1 } } }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  KILL_DRAGON: spell('KILL_DRAGON', {
    trigger: { kind: 'Ignition' },
    target: {
      kind: 'Card',
      zone: 'MonsterZone',
      side: 'opponent',
      count: 1,
      filter: { race: 'Dragon' },
    },
    operations: [{ kind: 'Destroy' }],
  }),
  KILL_ST: spell('KILL_ST', {
    trigger: { kind: 'Ignition' },
    target: { kind: 'Card', zone: 'SpellTrapZone', side: 'opponent', count: 1 },
    operations: [{ kind: 'Destroy' }],
  }),
  KILL_DEADLY: spell('KILL_DEADLY', {
    // Destroy without a Card target is a malformed effect.
    trigger: { kind: 'Ignition' },
    operations: [{ kind: 'Destroy' }],
  }),
  PAY_BURN: spell('PAY_BURN', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'PayLP', amount: 500 }],
    operations: [{ kind: 'Damage', amount: 1000, target: 'opponent' }],
  }),
  DISCARD_DRAW: spell('DISCARD_DRAW', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Discard', count: 1 }],
    operations: [{ kind: 'Draw', count: 2, target: 'self' }],
  }),
  DISCARD_MONSTER: spell('DISCARD_MONSTER', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Discard', count: 1, filter: { kind: 'Monster' } }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  TRIBUTE_HEAL: spell('TRIBUTE_HEAL', {
    trigger: { kind: 'Ignition' },
    cost: [{ kind: 'Tribute', count: 1 }],
    operations: [{ kind: 'Heal', amount: 500, target: 'self' }],
  }),
  NEEDS_MONSTER: spell('NEEDS_MONSTER', {
    trigger: { kind: 'Ignition' },
    condition: [{ kind: 'ZoneCount', zone: 'MonsterZone', side: 'self', min: 1 }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  MAIN2_ONLY: spell('MAIN2_ONLY', {
    trigger: { kind: 'Ignition' },
    condition: [{ kind: 'PhaseIs', phase: 'Main2' }],
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  ODD_TRIGGER: spell('ODD_TRIGGER', {
    trigger: { kind: 'Quick' },
    operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
  }),
  NO_EFFECT: { id: 'NO_EFFECT', kind: 'Spell', name: text('NO_EFFECT'), subType: 'Normal' },
  CONT: {
    id: 'CONT',
    kind: 'Spell',
    name: text('CONT'),
    subType: 'Continuous',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'Draw', count: 1, target: 'self' }],
      },
    ],
  },
  TRAP: {
    id: 'TRAP',
    kind: 'Trap',
    name: text('TRAP'),
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
      },
    ],
  },
};

export const fixtureCtx: ActionContext = { cardDefinitions: (id) => FIXTURE_DEFS[id] };

export function inst(
  instanceId: string,
  definitionId: string,
  ownerIndex: 0 | 1 = 0,
): CardInstance {
  return { instanceId, definitionId, position: null, ownerIndex };
}

export interface FixtureSetup {
  /** Definition ids for player 0's hand; instance ids are h0, h1, ... */
  hand?: string[];
  phase?: Phase;
  /** Player 0 monsters as [zone, definitionId, position?]; instance ids m0-<zone>. */
  myMonsters?: [number, string][];
  /** Player 1 monsters; instance ids o0-<zone>. `DefenseDown` = face-down. */
  oppMonsters?: [number, string, ('Attack' | 'DefenseUp' | 'DefenseDown')?][];
  /** Player 1 Spell/Trap Zone cards; instance ids os-<zone>. */
  oppSpellTraps?: [number, string][];
  /** Player 0 deck (definition ids) — defaults to 40 × D. */
  deck?: string[];
  myLp?: number;
  oppLp?: number;
}

/** Duel in turn 1, player 0 to act. Player 0's deck is the top of the deck list (instance ids d0, d1, ...). */
export function fixtureState(s: FixtureSetup = {}): GameState {
  const deckList = s.deck ?? Array.from({ length: 40 }, () => 'D');
  const started = applyAction(null, {
    type: 'StartDuel',
    payload: {
      matchId: 'm',
      seed: 'seed-effects',
      playerIds: ['alice', 'bob'],
      deckLists: [deckList, Array.from({ length: 40 }, () => 'D')],
    },
  }).state;
  const zones = <T>(
    fill: (i: number) => T | null,
  ): [T | null, T | null, T | null, T | null, T | null] => [
    fill(0),
    fill(1),
    fill(2),
    fill(3),
    fill(4),
  ];
  const mine = new Map(s.myMonsters ?? []);
  const theirs = new Map((s.oppMonsters ?? []).map(([z, d, p]) => [z, { d, p: p ?? 'Attack' }]));
  const theirST = new Map(s.oppSpellTraps ?? []);
  const p0 = started.players[0];
  const p1 = started.players[1];
  const hand = (s.hand ?? []).map((d, i) => inst(`h${i}`, d));
  const monsterZones0 = zones((i) =>
    mine.has(i) ? ({ ...inst(`m0-${i}`, mine.get(i)!), position: 'Attack' } as CardInstance) : null,
  );
  const monsterZones1 = zones((i) => {
    const t = theirs.get(i);
    return t ? ({ ...inst(`o0-${i}`, t.d, 1), position: t.p } as CardInstance) : null;
  });
  const spellTrapZones1 = zones((i) =>
    theirST.has(i)
      ? ({ ...inst(`os-${i}`, theirST.get(i)!, 1), position: 'DefenseDown' } as CardInstance)
      : null,
  );
  return {
    ...started,
    phase: s.phase ?? 'Main1',
    players: [
      {
        ...p0,
        hand,
        lifePoints: s.myLp ?? p0.lifePoints,
        board: { ...p0.board, monsterZones: monsterZones0 },
      },
      {
        ...p1,
        lifePoints: s.oppLp ?? p1.lifePoints,
        board: { ...p1.board, monsterZones: monsterZones1, spellTrapZones: spellTrapZones1 },
      },
    ],
  };
}
