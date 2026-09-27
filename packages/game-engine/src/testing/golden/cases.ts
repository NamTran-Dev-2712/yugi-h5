import type { CardDefinition } from '@yugi/shared';
import type { Action } from '../../actions/types.js';
import type { GoldenCase } from './replay.js';

function monster(id: string, level: number, atk: number, def: number): CardDefinition {
  return {
    id,
    kind: 'Monster',
    name: { vi: `Golden ${id}`, en: `Golden ${id}` },
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Warrior',
    level,
    atk,
    def,
  };
}

/** Test-only Effect Monster with one trigger effect (task 3.5). */
function triggerMonster(
  id: string,
  atk: number,
  trigger: { kind: 'OnSummon' | 'OnDestroyed'; mandatory?: boolean },
  operation: NonNullable<CardDefinition['effects']>[number]['operations'][number],
): CardDefinition {
  return {
    ...monster(id, 4, atk, 1000),
    category: 'Effect',
    effects: [{ id: 'e1', trigger, operations: [operation] }],
  } as CardDefinition;
}

/** Placeholder cards only (no official names). */
export const GOLDEN_DEFS: Readonly<Record<string, CardDefinition>> = {
  G_SUM_BURN: triggerMonster(
    'G_SUM_BURN',
    1200,
    { kind: 'OnSummon', mandatory: true },
    { kind: 'Damage', amount: 300, target: 'opponent' },
  ),
  G_SUM_HEAL: triggerMonster(
    'G_SUM_HEAL',
    1100,
    { kind: 'OnSummon' },
    { kind: 'Heal', amount: 500, target: 'self' },
  ),
  G_DES_BURN: triggerMonster(
    'G_DES_BURN',
    1000,
    { kind: 'OnDestroyed', mandatory: true },
    { kind: 'Damage', amount: 400, target: 'opponent' },
  ),
  M1000: monster('M1000', 4, 1000, 1000),
  M1800: monster('M1800', 4, 1800, 600),
  L5: monster('L5', 5, 2100, 1500),
  G_DRAW: {
    id: 'G_DRAW',
    kind: 'Spell',
    name: { vi: 'Golden G_DRAW', en: 'Golden G_DRAW' },
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Ignition' },
        operations: [{ kind: 'Draw', count: 1, target: 'self' }],
      },
    ],
  },
  G_QP_HEAL: {
    id: 'G_QP_HEAL',
    kind: 'Spell',
    name: { vi: 'Golden G_QP_HEAL', en: 'Golden G_QP_HEAL' },
    subType: 'QuickPlay',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Heal', amount: 300, target: 'self' }],
      },
    ],
  },
  G_QP_BURN: {
    id: 'G_QP_BURN',
    kind: 'Spell',
    name: { vi: 'Golden G_QP_BURN', en: 'Golden G_QP_BURN' },
    subType: 'QuickPlay',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Damage', amount: 200, target: 'opponent' }],
      },
    ],
  },
  G_TRAP_BURN: {
    id: 'G_TRAP_BURN',
    kind: 'Trap',
    name: { vi: 'Golden G_TRAP_BURN', en: 'Golden G_TRAP_BURN' },
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Damage', amount: 300, target: 'opponent' }],
      },
    ],
  },
  G_TRAP_KILL: {
    id: 'G_TRAP_KILL',
    kind: 'Trap',
    name: { vi: 'Golden G_TRAP_KILL', en: 'Golden G_TRAP_KILL' },
    subType: 'Normal',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        target: { kind: 'Card', zone: 'MonsterZone', side: 'opponent', count: 1 },
        operations: [{ kind: 'Destroy' }],
      },
    ],
  },
  G_COUNTER: {
    id: 'G_COUNTER',
    kind: 'Trap',
    name: { vi: 'Golden G_COUNTER', en: 'Golden G_COUNTER' },
    subType: 'Counter',
    effects: [
      {
        id: 'e1',
        trigger: { kind: 'Quick' },
        operations: [{ kind: 'Heal', amount: 100, target: 'self' }],
      },
    ],
  },
};

const SPELL_DECK = Array.from({ length: 40 }, (_, i) => ['M1000', 'M1800', 'L5', 'G_DRAW'][i % 4]!);

/** Test-only Quick-Play Spells (Speed 2) so a multi-link chain can be recorded (task 3.3). */
const CHAIN_DECK = Array.from(
  { length: 40 },
  (_, i) => ['G_DRAW', 'G_QP_HEAL', 'G_QP_BURN', 'M1000'][i % 4]!,
);

/** Set Trap / Set Quick-Play / Counter Trap chain (task 3.4). */
const TRAP_DECK = Array.from(
  { length: 40 },
  (_, i) => ['G_DRAW', 'G_QP_BURN', 'G_TRAP_BURN', 'G_COUNTER', 'M1000'][i % 5]!,
);

/** Reaction windows after a Set / an attack (task 3.4c). */
const REACTION_DECK = Array.from(
  { length: 40 },
  (_, i) => ['M1000', 'G_TRAP_KILL', 'M1800'][i % 3]!,
);

/** Trigger effects (task 3.5). */
const TRIGGER_DECK = Array.from(
  { length: 40 },
  (_, i) => ['G_SUM_BURN', 'G_SUM_HEAL', 'G_DES_BURN', 'M1800'][i % 4]!,
);

const MIXED_DECK = Array.from({ length: 40 }, (_, i) => ['M1000', 'M1800', 'L5'][i % 3]!);

const endPhase = (playerIndex: 0 | 1, times = 1): Action[] =>
  Array.from({ length: times }, () => ({ type: 'EndPhase', payload: { playerIndex } }));

/*
 * Turn shape reminder (6 EndPhase per full turn): Draw→Standby (draws unless turn 1), Standby→Main1,
 * [Main1 actions], Main1→Battle, [Battle actions], Battle→Main2, Main2→End, End→next turn.
 * Instance ids (`p<player>-<n>`) depend on the seeded shuffle; they were read off the engine once and are pinned
 * by the golden files (changing the shuffle would change them — that is a deliberate regression signal).
 */
export const GOLDEN_CASES: readonly GoldenCase[] = [
  {
    name: 'direct-attack-lp-zero',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-attack',
        playerIds: ['alice', 'bob'],
        deckLists: [MIXED_DECK, MIXED_DECK],
        startingLP: [1000, 1000],
      },
    },
    actions: [
      // T1 (P0): Normal Summon M1000 (p0-39), end turn.
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-39', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): pass.
      ...endPhase(1, 6),
      // T3 (P0): direct attack for exactly 1000 → LP 0.
      ...endPhase(0, 3),
      { type: 'DeclareAttack', payload: { playerIndex: 0, attackerInstanceId: 'p0-39' } },
      // After the duel ended, everything is rejected.
      ...endPhase(0, 1),
    ],
  },
  {
    name: 'tribute-position-flip-attack',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-tribute',
        playerIds: ['alice', 'bob'],
        deckLists: [MIXED_DECK, MIXED_DECK],
      },
    },
    actions: [
      // T1 (P0): Normal Summon M1000 (p0-36).
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-36', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): Set M1000 (p1-9).
      ...endPhase(1, 2),
      { type: 'SetMonster', payload: { playerIndex: 1, cardInstanceId: 'p1-9', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): Tribute Summon L5 (p0-20) over p0-36; it cannot attack the turn it is summoned (rejected).
      ...endPhase(0, 2),
      {
        type: 'NormalSummon',
        payload: {
          playerIndex: 0,
          cardInstanceId: 'p0-20',
          zoneIndex: 0,
          tributeInstanceIds: ['p0-36'],
        },
      },
      ...endPhase(0, 1),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-20', targetInstanceId: 'p1-9' },
      },
      ...endPhase(0, 3),
      // T4 (P1): pass.
      ...endPhase(1, 6),
      // T5 (P0): attack the Set monster (Flip-on-Attack, ATK > DEF), then try to switch to Defense in Main2 (rejected: it already attacked).
      ...endPhase(0, 3),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-20', targetInstanceId: 'p1-9' },
      },
      ...endPhase(0, 1),
      {
        type: 'ChangePosition',
        payload: { playerIndex: 0, cardInstanceId: 'p0-20', toPosition: 'DefenseUp' },
      },
      ...endPhase(0, 2),
    ],
  },
  {
    name: 'surrender-mid-duel',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-hand',
        playerIds: ['alice', 'bob'],
        deckLists: [MIXED_DECK, MIXED_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-18', zoneIndex: 2 } },
      // The non-turn player concedes during P0's Main1.
      { type: 'Surrender', payload: { playerIndex: 1 } },
      // Both a repeated Surrender and normal play are rejected afterwards.
      { type: 'Surrender', payload: { playerIndex: 0 } },
      ...endPhase(0, 1),
    ],
  },
  {
    name: 'deck-out',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-deckout',
        playerIds: ['alice', 'bob'],
        // Exactly the opening hand: the first real draw (P1, turn 2) has nothing to draw.
        deckLists: [Array(5).fill('M1000'), Array(5).fill('M1000')],
      },
    },
    actions: [...endPhase(0, 6), ...endPhase(1, 1), ...endPhase(1, 1)],
  },
  {
    name: 'hand-limit-discard',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-hand',
        playerIds: ['alice', 'bob'],
        deckLists: [MIXED_DECK, MIXED_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      // Hand 5 → 7, so leaving Main2 must open a discard-1 prompt.
      { type: 'Draw', payload: { playerIndex: 0, count: 2 } },
      ...endPhase(0, 3),
      // Wrong answers are rejected without changing anything, then the real one resolves.
      { type: 'EndPhase', payload: { playerIndex: 0 } },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'nope', cardInstanceIds: ['p0-18'] },
      },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'discard-1', cardInstanceIds: ['p0-18'] },
      },
      ...endPhase(0, 1),
    ],
  },
  {
    name: 'spell-set-and-activate',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-spell',
        playerIds: ['alice', 'bob'],
        deckLists: [SPELL_DECK, SPELL_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      // T1 (P0) hand: p0-17 M1800, p0-14 L5, p0-3 G_DRAW, p0-10 L5, p0-32 M1000.
      // Rejects (state untouched): a monster is not a Spell, unknown effect id.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-17', effectId: 'e1' },
      },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-3', effectId: 'nope' },
      },
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-17', zoneIndex: 0 } },
      // The real activation: draw 1, the Spell goes to the graveyard.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-3', effectId: 'e1' },
      },
      ...endPhase(0, 4),
      // T2 (P1) hand after its draw includes p1-19 G_DRAW: Set it face-down; a Set Normal Spell is not activatable (3.4: NOT_ACTIVATABLE).
      ...endPhase(1, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-19', zoneIndex: 2 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-19', effectId: 'e1' },
      },
      ...endPhase(1, 4),
    ],
  },
  {
    name: 'chain-three-links',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-chain-3',
        playerIds: ['alice', 'bob'],
        deckLists: [CHAIN_DECK, CHAIN_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      // T1 (P0) hand: p0-36 G_DRAW, p0-9 G_QP_HEAL, p0-22 G_QP_BURN, p0-12 G_DRAW, p0-8 G_DRAW.
      // Link 1 (Speed 1). P1 cannot respond (auto-pass); P0 still holds Quick-Plays, so the window stays open.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-36', effectId: 'e1' },
      },
      // Rejects while the window is open: wrong player passes, other actions, a Speed 1 response.
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      { type: 'EndPhase', payload: { playerIndex: 0 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-12', effectId: 'e1' },
      },
      // Link 2 (Speed 2); P0 can still respond with the last Quick-Play.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-9', effectId: 'e1' },
      },
      // Link 3: nobody can respond any more → the chain resolves LIFO (BURN, HEAL, DRAW) in this call.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-22', effectId: 'e1' },
      },
      // No window left.
      { type: 'PassPriority', payload: { playerIndex: 0 } },
      ...endPhase(0, 4),
    ],
  },
  {
    name: 'set-trap-quickplay-counter-chain',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-trap-qp',
        playerIds: ['alice', 'bob'],
        deckLists: [TRAP_DECK, TRAP_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      // T1 (P0) hand: p0-2 G_TRAP_BURN, p0-14 M1000, p0-36 G_QP_BURN, p0-38 G_COUNTER, p0-19 M1000.
      // Set a Trap, a Quick-Play and a Counter Trap; neither Set card may be activated the turn it was Set.
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-2', zoneIndex: 0 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-2', effectId: 'e1' },
      },
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-36', zoneIndex: 1 } },
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-36', effectId: 'e1' },
      },
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-38', zoneIndex: 2 } },
      ...endPhase(0, 4),
      // T2 (P1) hand: p1-26 G_QP_BURN, p1-18 G_COUNTER, p1-0 G_DRAW, p1-4 M1000, p1-19 M1000 (+ draws p1-38).
      ...endPhase(1, 2),
      // Link 1 (Speed 1): P0 holds Set cards from an earlier turn, so the window opens for P0.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-0', effectId: 'e1' },
      },
      // Link 2: P0's Set Quick-Play on the opponent's turn. P1 could answer with its hand Quick-Play (own turn).
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-36', effectId: 'e1' },
      },
      // Reject: a Counter Trap in the hand is not Set.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-18', effectId: 'e1' },
      },
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      // Link 3: P0's Set Normal Trap (Speed 2).
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-2', effectId: 'e1' },
      },
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      // Link 4: Counter Trap (Speed 3). P1 has nothing at Speed 3 → the chain resolves LIFO in this call.
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 0, cardInstanceId: 'p0-38', effectId: 'e1' },
      },
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      ...endPhase(1, 4),
    ],
  },
  {
    name: 'attack-and-summon-reaction',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-reaction',
        playerIds: ['alice', 'bob'],
        deckLists: [REACTION_DECK, REACTION_DECK],
      },
    },
    actions: [
      ...endPhase(0, 2),
      // T1 (P0): P1 has no Set card, so the Summon opens no window.
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-3', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1) hand: p1-37 G_TRAP_KILL, ...: Set it.
      ...endPhase(1, 2),
      { type: 'SetSpellTrap', payload: { playerIndex: 1, cardInstanceId: 'p1-37', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): Setting a monster opens a reaction window for P1 (its Trap was Set last turn).
      ...endPhase(0, 2),
      { type: 'SetMonster', payload: { playerIndex: 0, cardInstanceId: 'p0-12', zoneIndex: 1 } },
      // Rejects while the window is open: the turn player can neither act on nor pass it.
      { type: 'EndPhase', payload: { playerIndex: 0 } },
      { type: 'PassPriority', payload: { playerIndex: 0 } },
      // P1 passes once: the empty window closes.
      { type: 'PassPriority', payload: { playerIndex: 1 } },
      ...endPhase(0, 1),
      // Direct attack → window for P1 before damage.
      { type: 'DeclareAttack', payload: { playerIndex: 0, attackerInstanceId: 'p0-3' } },
      // P1's Trap has two possible targets → target prompt; it destroys the attacker, so the attack stops (no damage).
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-37', effectId: 'e1' },
      },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 1, promptId: 'effect-3-21', cardInstanceIds: ['p0-3'] },
      },
      ...endPhase(0, 3),
    ],
  },
  {
    name: 'on-summon-mandatory',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-trig-1',
        playerIds: ['alice', 'bob'],
        deckLists: [TRIGGER_DECK, TRIGGER_DECK],
      },
    },
    actions: [
      // T1 (P0): Normal Summon G_SUM_BURN (p0-32) → its mandatory OnSummon goes on the chain and resolves (300 damage).
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-32', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): a Set (p1-19 M1800) fires nothing.
      ...endPhase(1, 2),
      { type: 'SetMonster', payload: { playerIndex: 1, cardInstanceId: 'p1-19', zoneIndex: 0 } },
      ...endPhase(1, 4),
    ],
  },
  {
    name: 'on-summon-optional-declined',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-trig-1',
        playerIds: ['alice', 'bob'],
        deckLists: [TRIGGER_DECK, TRIGGER_DECK],
      },
    },
    actions: [
      // T1 (P0): Normal Summon G_SUM_HEAL (p0-33) → TriggerActivation prompt for P0.
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-33', zoneIndex: 0 } },
      // Rejected while the prompt waits: EndPhase, P1 answering, an id where none is expected.
      ...endPhase(0, 1),
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 1, promptId: 'trigger-1-3', cardInstanceIds: [], decline: true },
      },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'trigger-1-3', cardInstanceIds: ['p0-33'] },
      },
      // P0 declines: nothing happens.
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'trigger-1-3', cardInstanceIds: [], decline: true },
      },
      ...endPhase(0, 4),
      // T2 (P1): Normal Summon G_SUM_HEAL (p1-21) and accept: heal 500.
      ...endPhase(1, 2),
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-21', zoneIndex: 0 } },
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 1, promptId: 'trigger-2-11', cardInstanceIds: [] },
      },
      ...endPhase(1, 4),
    ],
  },
  {
    name: 'on-destroyed-in-combat',
    definitions: GOLDEN_DEFS,
    start: {
      type: 'StartDuel',
      payload: {
        matchId: 'golden',
        seed: 'g-trig-1',
        playerIds: ['alice', 'bob'],
        deckLists: [TRIGGER_DECK, TRIGGER_DECK],
      },
    },
    actions: [
      // T1 (P0): Normal Summon M1800 (p0-15).
      ...endPhase(0, 2),
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-15', zoneIndex: 0 } },
      ...endPhase(0, 4),
      // T2 (P1): Normal Summon G_DES_BURN (p1-34, ATK 1000) in Attack Position.
      ...endPhase(1, 2),
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-34', zoneIndex: 0 } },
      ...endPhase(1, 4),
      // T3 (P0): M1800 attacks it → destroyed, 800 to P1; its mandatory OnDestroyed (from the graveyard) → 400 to P0.
      ...endPhase(0, 3),
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-15', targetInstanceId: 'p1-34' },
      },
      ...endPhase(0, 3),
    ],
  },
];
