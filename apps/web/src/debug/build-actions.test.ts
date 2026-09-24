import {
  PlayerActionSchema,
  type CardDefinition,
  type CardView,
  type PlayerAction,
  type PlayerView,
  type StateView,
  type ViewCardPosition,
} from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import {
  applyLegality,
  buildActionButtons,
  pickViewer,
  shouldContinueEndTurn,
  toAction,
  type ActionButton,
} from './build-actions';

const DEFS: Record<string, CardDefinition> = {
  MON: {
    id: 'MON',
    name: 'Monster',
    kind: 'Monster',
    category: 'Normal',
    attribute: 'EARTH',
    race: 'Beast',
    level: 4,
    atk: 1000,
    def: 1000,
  },
  SPL: { id: 'SPL', name: 'Spell', kind: 'Spell', subType: 'Normal' },
};
const lookup = (id: string): CardDefinition | undefined => DEFS[id];

const visible = (
  instanceId: string,
  definitionId: string,
  owner: 0 | 1,
  position: ViewCardPosition | null = null,
): CardView => ({ hidden: false, instanceId, definitionId, position, ownerIndex: owner });
const hidden = (instanceId: string, owner: 0 | 1): CardView => ({
  hidden: true,
  instanceId,
  ownerIndex: owner,
});

const EMPTY5 = [null, null, null, null, null] as const;

function player(over: Partial<PlayerView> = {}): PlayerView {
  return {
    playerId: 'x',
    lifePoints: 8000,
    hand: [],
    handCount: 0,
    deckCount: 30,
    extraDeckCount: 0,
    graveyard: [],
    banished: [],
    board: { monsterZones: EMPTY5, spellTrapZones: EMPTY5, fieldZone: null },
    hasNormalSummonedThisTurn: false,
    ...over,
  };
}

function view(
  over: Partial<StateView> & { p0?: Partial<PlayerView>; p1?: Partial<PlayerView> } = {},
): StateView {
  const { p0, p1, ...rest } = over;
  return {
    matchId: 'm',
    version: 1,
    viewerIndex: 0,
    ruleset: {} as StateView['ruleset'],
    turnCount: 1,
    turnPlayerIndex: 0,
    phase: 'Main1',
    winnerIndex: null,
    pendingPrompt: null,
    players: [player(p0), player(p1)],
    ...rest,
  };
}

const find = (buttons: readonly ActionButton[], id: string): ActionButton => {
  const b = buttons.find((x) => x.id === id);
  if (!b) throw new Error(`no button ${id}; have ${buttons.map((x) => x.id).join(', ')}`);
  return b;
};
const ids = (buttons: readonly ActionButton[]): string[] => buttons.map((b) => b.id);

describe('buildActionButtons', () => {
  it('offers nothing once the duel is over', () => {
    expect(buildActionButtons(view({ winnerIndex: 1 }), lookup)).toEqual([]);
    expect(buildActionButtons(view({ winnerIndex: 'draw' }), lookup)).toEqual([]);
  });

  it('always offers EndPhase, EndTurn and Surrender for the viewer seat while the duel runs', () => {
    const b = buildActionButtons(view({ viewerIndex: 1 }), lookup);
    expect(ids(b)).toEqual(expect.arrayContaining(['EndPhase', 'EndTurn', 'Surrender']));
    expect(find(b, 'Surrender').playerIndex).toBe(1);
  });

  it('offers Summon and Set for each monster in hand, not for spells or hidden cards', () => {
    const v = view({
      p0: { hand: [visible('p0-1', 'MON', 0), visible('p0-2', 'SPL', 0), hidden('p0-3', 0)] },
    });
    const b = buildActionButtons(v, lookup);
    expect(ids(b)).toEqual(expect.arrayContaining(['NormalSummon:p0-1', 'SetMonster:p0-1']));
    expect(ids(b).filter((i) => i.includes('p0-2') || i.includes('p0-3'))).toEqual([]);
  });

  it('a summon asks for a zone (0-4) and lets the player pick any own monsters as tributes', () => {
    const v = view({
      p0: {
        hand: [visible('p0-1', 'MON', 0)],
        board: {
          monsterZones: [visible('p0-8', 'MON', 0, 'Attack'), null, hidden('p0-9', 0), null, null],
          spellTrapZones: EMPTY5,
          fieldZone: null,
        },
      },
    });
    const btn = find(buildActionButtons(v, lookup), 'NormalSummon:p0-1');
    const zone = btn.inputs.find((i) => i.name === 'zoneIndex');
    const tribute = btn.inputs.find((i) => i.name === 'tributeInstanceIds');
    expect(zone?.options.map((o) => o.value)).toEqual(['0', '1', '2', '3', '4']);
    expect(zone?.multiple).toBe(false);
    expect(tribute?.multiple).toBe(true);
    expect(tribute?.options.map((o) => o.value)).toEqual(['p0-8', 'p0-9']);
  });

  it('a face-up Attack monster can change to defense and attack any opponent monster or directly', () => {
    const v = view({
      p0: {
        board: {
          monsterZones: [visible('p0-8', 'MON', 0, 'Attack'), null, null, null, null],
          spellTrapZones: EMPTY5,
          fieldZone: null,
        },
      },
      p1: {
        board: {
          monsterZones: [null, visible('p1-4', 'MON', 1, 'Attack'), hidden('p1-5', 1), null, null],
          spellTrapZones: EMPTY5,
          fieldZone: null,
        },
      },
    });
    const b = buildActionButtons(v, lookup);
    expect(find(b, 'ChangePosition:p0-8').fixed).toMatchObject({ toPosition: 'DefenseUp' });
    const attack = find(b, 'DeclareAttack:p0-8');
    const target = attack.inputs.find((i) => i.name === 'targetInstanceId');
    expect(target?.options.map((o) => o.value)).toEqual(['', 'p1-4', 'p1-5']); // '' = direct attack
  });

  it('a defense monster can only switch back to Attack; a face-down one has no monster actions', () => {
    const v = view({
      p0: {
        board: {
          monsterZones: [
            visible('p0-8', 'MON', 0, 'DefenseUp'),
            hidden('p0-9', 0),
            null,
            null,
            null,
          ],
          spellTrapZones: EMPTY5,
          fieldZone: null,
        },
      },
    });
    const b = buildActionButtons(v, lookup);
    expect(find(b, 'ChangePosition:p0-8').fixed).toMatchObject({ toPosition: 'Attack' });
    expect(ids(b).some((i) => i === 'DeclareAttack:p0-8')).toBe(false);
    expect(ids(b).filter((i) => i.endsWith('p0-9'))).toEqual([]);
  });

  it('offers a discard answer when the viewer seat has a DiscardToHandLimit prompt', () => {
    const v = view({
      p0: {
        hand: [visible('p0-1', 'MON', 0), visible('p0-2', 'SPL', 0), visible('p0-3', 'MON', 0)],
      },
      pendingPrompt: {
        promptId: 'discard-3',
        playerIndex: 0,
        kind: 'DiscardToHandLimit',
        payload: { count: 1 },
      },
    });
    const prompt = find(buildActionButtons(v, lookup), 'ResolvePendingPrompt');
    expect(prompt.fixed).toMatchObject({ promptId: 'discard-3' });
    const pick = prompt.inputs.find((i) => i.name === 'cardInstanceIds');
    expect(pick?.multiple).toBe(true);
    expect(pick?.options.map((o) => o.value)).toEqual(['p0-1', 'p0-2', 'p0-3']);
    expect(prompt.label).toContain('1');
  });

  it('does not offer the discard answer to the seat that is not being asked', () => {
    const v = view({
      viewerIndex: 1,
      p1: { hand: [visible('p1-1', 'MON', 1)] },
      pendingPrompt: {
        promptId: 'discard-3',
        playerIndex: 0,
        kind: 'DiscardToHandLimit',
        payload: { count: 1 },
      },
    });
    expect(ids(buildActionButtons(v, lookup))).not.toContain('ResolvePendingPrompt');
  });
});

describe('toAction', () => {
  const summonView = view({
    p0: { hand: [visible('p0-1', 'MON', 0)] },
  });

  it('builds a schema-valid NormalSummon with the chosen zone and tributes', () => {
    const btn = find(buildActionButtons(summonView, lookup), 'NormalSummon:p0-1');
    const action = toAction(btn, { zoneIndex: '3', tributeInstanceIds: ['p0-8', 'p0-9'] });
    expect(action).toEqual({
      type: 'NormalSummon',
      payload: {
        playerIndex: 0,
        cardInstanceId: 'p0-1',
        zoneIndex: 3,
        tributeInstanceIds: ['p0-8', 'p0-9'],
      },
    });
    expect(PlayerActionSchema.safeParse(action).success).toBe(true);
  });

  it('leaves tributeInstanceIds out when none were chosen', () => {
    const btn = find(buildActionButtons(summonView, lookup), 'SetMonster:p0-1');
    const action = toAction(btn, { zoneIndex: '0', tributeInstanceIds: [] });
    expect(action.payload).not.toHaveProperty('tributeInstanceIds');
  });

  it('turns the empty target choice into a direct attack (null)', () => {
    const v = view({
      p0: {
        board: {
          monsterZones: [visible('p0-8', 'MON', 0, 'Attack'), null, null, null, null],
          spellTrapZones: EMPTY5,
          fieldZone: null,
        },
      },
    });
    const btn = find(buildActionButtons(v, lookup), 'DeclareAttack:p0-8');
    expect(toAction(btn, { targetInstanceId: '' })).toEqual({
      type: 'DeclareAttack',
      payload: { playerIndex: 0, attackerInstanceId: 'p0-8', targetInstanceId: null },
    });
    expect(toAction(btn, { targetInstanceId: 'p1-4' }).payload).toMatchObject({
      targetInstanceId: 'p1-4',
    });
  });

  it('builds EndPhase, Surrender and ResolvePendingPrompt', () => {
    const b = buildActionButtons(
      view({
        p0: { hand: [visible('p0-1', 'MON', 0)] },
        pendingPrompt: {
          promptId: 'discard-1',
          playerIndex: 0,
          kind: 'DiscardToHandLimit',
          payload: { count: 1 },
        },
      }),
      lookup,
    );
    expect(toAction(find(b, 'EndPhase'), {})).toEqual({
      type: 'EndPhase',
      payload: { playerIndex: 0 },
    });
    expect(toAction(find(b, 'Surrender'), {})).toEqual({
      type: 'Surrender',
      payload: { playerIndex: 0 },
    });
    expect(toAction(find(b, 'ResolvePendingPrompt'), { cardInstanceIds: ['p0-1'] })).toEqual({
      type: 'ResolvePendingPrompt',
      payload: { playerIndex: 0, promptId: 'discard-1', cardInstanceIds: ['p0-1'] },
    });
  });

  it('refuses to build an action from the client-only EndTurn button', () => {
    const btn = find(buildActionButtons(view(), lookup), 'EndTurn');
    expect(() => toAction(btn, {})).toThrow();
  });
});

describe('pickViewer', () => {
  it('follows the turn player', () => {
    expect(pickViewer(view({ turnPlayerIndex: 1, viewerIndex: 0 }))).toBe(1);
    expect(pickViewer(view({ turnPlayerIndex: 0, viewerIndex: 1 }))).toBe(0);
  });

  it('follows the seat being asked by a pending prompt, even when it is not the turn player', () => {
    const v = view({
      turnPlayerIndex: 0,
      pendingPrompt: { promptId: 'p', playerIndex: 1, kind: 'X', payload: {} },
    });
    expect(pickViewer(v)).toBe(1);
  });

  it('keeps the current viewer once the duel is over', () => {
    expect(pickViewer(view({ winnerIndex: 0, turnPlayerIndex: 1, viewerIndex: 0 }))).toBe(0);
  });
});

describe('shouldContinueEndTurn', () => {
  it('keeps pressing EndPhase while it is still the same turn', () => {
    expect(shouldContinueEndTurn(1, view({ turnCount: 1 }))).toBe(true);
  });

  it.each([
    ['the turn changed', view({ turnCount: 2 })],
    ['the duel ended', view({ winnerIndex: 0 })],
    [
      'a prompt is waiting',
      view({
        pendingPrompt: { promptId: 'p', playerIndex: 0, kind: 'DiscardToHandLimit', payload: {} },
      }),
    ],
  ])('stops when %s', (_n, v) => {
    expect(shouldContinueEndTurn(1, v)).toBe(false);
  });
});

describe('applyLegality', () => {
  const v = view({
    p0: {
      hand: [visible('p0-1', 'MON', 0)],
      board: {
        monsterZones: [visible('p0-9', 'MON', 0, 'Attack'), null, null, null, null],
        spellTrapZones: EMPTY5,
        fieldZone: null,
      },
    },
    p1: {
      board: {
        monsterZones: [visible('p1-5', 'MON', 1, 'Attack'), null, null, null, null],
        spellTrapZones: EMPTY5,
        fieldZone: null,
      },
    },
  });
  const buttons = buildActionButtons(v, lookup);
  const legalOf = (list: readonly PlayerAction[], narrow = true) =>
    Object.fromEntries(applyLegality(buttons, list, narrow).map((a) => [a.button.id, a.legal]));

  it('leaves everything legal before the server has answered (null)', () => {
    const all = applyLegality(buttons, null, true);
    expect(all.every((a) => a.legal)).toBe(true);
  });

  it('marks only buttons that appear in legalActions', () => {
    const legal = legalOf([
      { type: 'EndPhase', payload: { playerIndex: 0 } },
      { type: 'Surrender', payload: { playerIndex: 0 } },
    ]);
    expect(legal['EndPhase']).toBe(true);
    expect(legal['EndTurn']).toBe(true); // EndTurn = repeated EndPhase
    expect(legal['Surrender']).toBe(true);
    expect(legal['NormalSummon:p0-1']).toBe(false);
    expect(legal['SetMonster:p0-1']).toBe(false);
    expect(legal['DeclareAttack:p0-9']).toBe(false);
    expect(legal['ChangePosition:p0-9']).toBe(false);
  });

  it('matches by card (fixed payload fields), not just by action type', () => {
    const legal = legalOf([
      {
        type: 'NormalSummon',
        payload: { playerIndex: 0, cardInstanceId: 'p0-OTHER', zoneIndex: 1 },
      },
    ]);
    expect(legal['NormalSummon:p0-1']).toBe(false);
  });

  it('narrows zone and target choices to the legal ones, and keeps all of them when narrow=false', () => {
    const list: PlayerAction[] = [
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex: 2 } },
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex: 4 } },
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-9', targetInstanceId: 'p1-5' },
      },
    ];
    const narrowed = applyLegality(buttons, list, true);
    const summon = narrowed.find((a) => a.button.id === 'NormalSummon:p0-1')!.button;
    expect(summon.inputs[0]!.options.map((o) => o.value)).toEqual(['2', '4']);
    const attack = narrowed.find((a) => a.button.id === 'DeclareAttack:p0-9')!.button;
    expect(attack.inputs[0]!.options.map((o) => o.value)).toEqual(['p1-5']); // no direct attack

    const wide = applyLegality(buttons, list, false).find(
      (a) => a.button.id === 'NormalSummon:p0-1',
    )!.button;
    expect(wide.inputs[0]!.options).toHaveLength(5);
  });

  it('offers the direct-attack option only when a direct attack is legal', () => {
    const direct: PlayerAction[] = [
      { type: 'DeclareAttack', payload: { playerIndex: 0, attackerInstanceId: 'p0-9' } },
    ];
    const attack = applyLegality(buttons, direct, true).find(
      (a) => a.button.id === 'DeclareAttack:p0-9',
    )!.button;
    expect(attack.inputs[0]!.options.map((o) => o.value)).toEqual(['']);
  });

  it('is fully illegal (nothing enabled) for an empty list', () => {
    expect(applyLegality(buttons, [], true).some((a) => a.legal)).toBe(false);
  });
});
