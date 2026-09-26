import { describe, expect, it } from 'vitest';
import { ActionInputSchema, PlayerActionSchema } from './action-schema.js';

const ok = (action: unknown) => PlayerActionSchema.safeParse(action).success;

describe('PlayerActionSchema — well-formed actions', () => {
  it.each([
    ['EndPhase', { type: 'EndPhase', payload: { playerIndex: 0 } }],
    [
      'NormalSummon',
      { type: 'NormalSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-3', zoneIndex: 4 } },
    ],
    [
      'NormalSummon with tributes',
      {
        type: 'NormalSummon',
        payload: {
          playerIndex: 0,
          cardInstanceId: 'p0-3',
          zoneIndex: 0,
          tributeInstanceIds: ['p0-1', 'p0-2'],
        },
      },
    ],
    [
      'SetMonster',
      { type: 'SetMonster', payload: { playerIndex: 0, cardInstanceId: 'p0-3', zoneIndex: 2 } },
    ],
    [
      'ChangePosition',
      {
        type: 'ChangePosition',
        payload: { playerIndex: 0, cardInstanceId: 'p0-3', toPosition: 'DefenseUp' },
      },
    ],
    [
      'DeclareAttack (monster)',
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-3', targetInstanceId: 'p1-4' },
      },
    ],
    [
      'DeclareAttack (direct, null)',
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-3', targetInstanceId: null },
      },
    ],
    [
      'DeclareAttack (direct, omitted)',
      { type: 'DeclareAttack', payload: { playerIndex: 0, attackerInstanceId: 'p0-3' } },
    ],
    ['Surrender', { type: 'Surrender', payload: { playerIndex: 1 } }],
    [
      'SetSpellTrap',
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-7', zoneIndex: 4 } },
    ],
    [
      'ActivateEffect (no cost)',
      {
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-7', effectId: 'e1' },
      },
    ],
    [
      'ActivateEffect (with cost)',
      {
        type: 'ActivateEffect',
        payload: {
          playerIndex: 0,
          cardInstanceId: 'p0-7',
          effectId: 'e1',
          costInstanceIds: ['p0-2'],
        },
      },
    ],
    [
      'ResolvePendingPrompt',
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'discard-3', cardInstanceIds: ['p0-1'] },
      },
    ],
  ])('accepts %s', (_n, action) => {
    expect(ok(action)).toBe(true);
  });
});

describe('PlayerActionSchema — malformed payloads are rejected', () => {
  it.each([
    ['unknown type', { type: 'Nuke', payload: { playerIndex: 0 } }],
    ['missing payload', { type: 'EndPhase' }],
    ['seat out of range', { type: 'EndPhase', payload: { playerIndex: 2 } }],
    ['seat as string', { type: 'EndPhase', payload: { playerIndex: '0' } }],
    ['extra payload key', { type: 'EndPhase', payload: { playerIndex: 0, hax: true } }],
    [
      'summon without cardInstanceId',
      { type: 'NormalSummon', payload: { playerIndex: 0, zoneIndex: 0 } },
    ],
    [
      'summon zone too high',
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex: 5 } },
    ],
    [
      'summon zone negative',
      { type: 'SetMonster', payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex: -1 } },
    ],
    [
      'summon zone fractional',
      { type: 'SetMonster', payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex: 1.5 } },
    ],
    [
      'summon zone as string',
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex: '0' } },
    ],
    [
      'empty cardInstanceId',
      { type: 'NormalSummon', payload: { playerIndex: 0, cardInstanceId: '', zoneIndex: 0 } },
    ],
    [
      'tributes not an array',
      {
        type: 'NormalSummon',
        payload: {
          playerIndex: 0,
          cardInstanceId: 'p0-1',
          zoneIndex: 0,
          tributeInstanceIds: 'p0-2',
        },
      },
    ],
    [
      'tributes with non-strings',
      {
        type: 'NormalSummon',
        payload: { playerIndex: 0, cardInstanceId: 'p0-1', zoneIndex: 0, tributeInstanceIds: [1] },
      },
    ],
    [
      'position DefenseDown',
      {
        type: 'ChangePosition',
        payload: { playerIndex: 0, cardInstanceId: 'p0-1', toPosition: 'DefenseDown' },
      },
    ],
    [
      'position missing',
      { type: 'ChangePosition', payload: { playerIndex: 0, cardInstanceId: 'p0-1' } },
    ],
    ['attack without attacker', { type: 'DeclareAttack', payload: { playerIndex: 0 } }],
    [
      'attack target as number',
      {
        type: 'DeclareAttack',
        payload: { playerIndex: 0, attackerInstanceId: 'p0-1', targetInstanceId: 7 },
      },
    ],
    [
      'prompt without promptId',
      { type: 'ResolvePendingPrompt', payload: { playerIndex: 0, cardInstanceIds: [] } },
    ],
    [
      'SetSpellTrap zone 5',
      { type: 'SetSpellTrap', payload: { playerIndex: 0, cardInstanceId: 'p0-7', zoneIndex: 5 } },
    ],
    [
      'SetSpellTrap without card',
      { type: 'SetSpellTrap', payload: { playerIndex: 0, zoneIndex: 0 } },
    ],
    [
      'SetSpellTrap with an extra key',
      {
        type: 'SetSpellTrap',
        payload: { playerIndex: 0, cardInstanceId: 'p0-7', zoneIndex: 0, position: 'DefenseDown' },
      },
    ],
    [
      'ActivateEffect without effectId',
      { type: 'ActivateEffect', payload: { playerIndex: 0, cardInstanceId: 'p0-7' } },
    ],
    [
      'ActivateEffect with an empty effectId',
      { type: 'ActivateEffect', payload: { playerIndex: 0, cardInstanceId: 'p0-7', effectId: '' } },
    ],
    [
      'ActivateEffect cost not an array',
      {
        type: 'ActivateEffect',
        payload: {
          playerIndex: 0,
          cardInstanceId: 'p0-7',
          effectId: 'e1',
          costInstanceIds: 'p0-2',
        },
      },
    ],
    [
      'ActivateEffect with target ids in the payload (targets go through the prompt)',
      {
        type: 'ActivateEffect',
        payload: {
          playerIndex: 0,
          cardInstanceId: 'p0-7',
          effectId: 'e1',
          targetInstanceIds: ['p1-1'],
        },
      },
    ],
    [
      'prompt answer not an array',
      {
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 0, promptId: 'd', cardInstanceIds: 'p0-1' },
      },
    ],
  ])('rejects %s', (_n, action) => {
    expect(ok(action)).toBe(false);
  });
});

describe('ActionInputSchema', () => {
  it('still lets StartDuel and Draw through the envelope so the server can answer 403 for them', () => {
    expect(
      ActionInputSchema.safeParse({ type: 'StartDuel', payload: { playerIndex: 0 } }).success,
    ).toBe(true);
    expect(
      ActionInputSchema.safeParse({ type: 'Draw', payload: { playerIndex: 0, count: 1 } }).success,
    ).toBe(true);
  });

  it('accepts every player-sendable action and rejects malformed ones', () => {
    expect(
      ActionInputSchema.safeParse({ type: 'Surrender', payload: { playerIndex: 0 } }).success,
    ).toBe(true);
    expect(
      ActionInputSchema.safeParse({ type: 'NormalSummon', payload: { playerIndex: 0 } }).success,
    ).toBe(false);
  });

  it('PlayerActionSchema itself refuses StartDuel and Draw', () => {
    expect(ok({ type: 'StartDuel', payload: { playerIndex: 0 } })).toBe(false);
    expect(ok({ type: 'Draw', payload: { playerIndex: 0, count: 1 } })).toBe(false);
  });
});
