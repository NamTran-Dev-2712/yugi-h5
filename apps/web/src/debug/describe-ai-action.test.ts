import type { PlayerAction } from '@yugi/shared';
import { describe, expect, it } from 'vitest';
import { describeAiAction } from './describe-ai-action';

const ctx = { instanceLabel: (id: string) => `«${id}»` };
const say = (a: PlayerAction) => describeAiAction(a, ctx);

describe('describeAiAction', () => {
  it('words every player action, always naming the AI', () => {
    expect(say({ type: 'EndPhase', payload: { playerIndex: 1 } })).toBe('🤖 AI kết thúc phase');
    expect(
      say({
        type: 'NormalSummon',
        payload: { playerIndex: 1, cardInstanceId: 'p1-3', zoneIndex: 2 },
      }),
    ).toBe('🤖 AI Normal Summon «p1-3» ở ô 2');
    expect(
      say({
        type: 'NormalSummon',
        payload: {
          playerIndex: 1,
          cardInstanceId: 'p1-9',
          zoneIndex: 0,
          tributeInstanceIds: ['p1-1', 'p1-2'],
        },
      }),
    ).toBe('🤖 AI Tribute Summon «p1-9» ở ô 0, hiến tế «p1-1», «p1-2»');
    expect(
      say({
        type: 'SetMonster',
        payload: { playerIndex: 1, cardInstanceId: 'p1-4', zoneIndex: 1 },
      }),
    ).toBe('🤖 AI úp «p1-4» ở ô 1');
    expect(
      say({
        type: 'ChangePosition',
        payload: { playerIndex: 1, cardInstanceId: 'p1-5', toPosition: 'DefenseUp' },
      }),
    ).toBe('🤖 AI đổi thế «p1-5» sang DefenseUp');
    expect(
      say({ type: 'DeclareAttack', payload: { playerIndex: 1, attackerInstanceId: 'p1-6' } }),
    ).toBe('🤖 AI tấn công trực tiếp bằng «p1-6»');
    expect(
      say({
        type: 'DeclareAttack',
        payload: { playerIndex: 1, attackerInstanceId: 'p1-6', targetInstanceId: 'p0-7' },
      }),
    ).toBe('🤖 AI tấn công «p0-7» bằng «p1-6»');
    expect(
      say({
        type: 'ResolvePendingPrompt',
        payload: { playerIndex: 1, promptId: 'discard-4', cardInstanceIds: ['p1-1', 'p1-2'] },
      }),
    ).toBe('🤖 AI bỏ «p1-1», «p1-2» xuống mộ');
    expect(say({ type: 'Surrender', payload: { playerIndex: 1 } })).toBe('🤖 AI đầu hàng');
    expect(
      say({
        type: 'SetSpellTrap',
        payload: { playerIndex: 1, cardInstanceId: 'p1-8', zoneIndex: 3 },
      }),
    ).toBe('🤖 AI úp «p1-8» vào ô Phép/Bẫy 3');
    expect(
      say({
        type: 'ActivateEffect',
        payload: { playerIndex: 1, cardInstanceId: 'p1-9', effectId: 'e1' },
      }),
    ).toBe('🤖 AI kích hoạt «p1-9»');
  });

  it('treats a null target as a direct attack', () => {
    expect(
      say({
        type: 'DeclareAttack',
        payload: { playerIndex: 1, attackerInstanceId: 'a', targetInstanceId: null },
      }),
    ).toBe('🤖 AI tấn công trực tiếp bằng «a»');
  });
});
