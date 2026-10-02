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
      describeAiAction(
        {
          type: 'ResolvePendingPrompt',
          payload: { playerIndex: 1, promptId: 'discard-4', cardInstanceIds: ['p1-1', 'p1-2'] },
        },
        ctx,
        'DiscardToHandLimit',
      ),
    ).toBe('🤖 AI bỏ «p1-1», «p1-2» xuống mộ');
    expect(say({ type: 'Surrender', payload: { playerIndex: 1 } })).toBe('🤖 AI đầu hàng');
    expect(say({ type: 'FlipSummon', payload: { playerIndex: 1, cardInstanceId: 'p1-4' } })).toBe(
      '🤖 AI Triệu hồi Lật «p1-4»',
    );
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

  it('words the chain answers of task 3.4b: pass, trigger accepted / declined', () => {
    expect(say({ type: 'PassPriority', payload: { playerIndex: 1 } })).toBe(
      '🤖 AI bỏ qua (không phản ứng)',
    );
    expect(
      describeAiAction(
        {
          type: 'ResolvePendingPrompt',
          payload: { playerIndex: 1, promptId: 'x', cardInstanceIds: [], decline: true },
        },
        ctx,
        'TriggerActivation',
      ),
    ).toBe('🤖 AI không kích hoạt hiệu ứng trigger');
    expect(
      describeAiAction(
        {
          type: 'ResolvePendingPrompt',
          payload: { playerIndex: 1, promptId: 'x', cardInstanceIds: [] },
        },
        ctx,
        'TriggerActivation',
      ),
    ).toBe('🤖 AI kích hoạt hiệu ứng trigger');
  });

  describe('prompt answers are worded from the KIND of the prompt, never guessed from the ids (task 4.3b)', () => {
    const answer = (cardInstanceIds: string[], decline?: boolean): PlayerAction => ({
      type: 'ResolvePendingPrompt',
      payload: {
        playerIndex: 1,
        promptId: 'x',
        cardInstanceIds,
        ...(decline ? { decline: true } : {}),
      },
    });
    const sayKind = (a: PlayerAction, kind?: string) => describeAiAction(a, ctx, kind);

    it('SelectEffectTarget: "chooses a target", not "discards … to the Graveyard"', () => {
      expect(sayKind(answer(['p0-7']), 'SelectEffectTarget')).toBe(
        '🤖 AI chọn mục tiêu cho hiệu ứng: «p0-7»',
      );
      expect(sayKind(answer(['p0-7', 'p0-8']), 'SelectEffectTarget')).toBe(
        '🤖 AI chọn mục tiêu cho hiệu ứng: «p0-7», «p0-8»',
      );
    });

    it('SelectEffectTarget with every id redacted by the server (targets in its hand): no card is named', () => {
      expect(sayKind(answer([]), 'SelectEffectTarget')).toBe('🤖 AI chọn mục tiêu cho hiệu ứng');
    });

    it('TriggerActivation with targets: the trigger sentence plus the targets', () => {
      expect(sayKind(answer(['p0-7']), 'TriggerActivation')).toBe(
        '🤖 AI kích hoạt hiệu ứng trigger, mục tiêu: «p0-7»',
      );
    });

    it('DiscardToHandLimit keeps "bỏ … xuống mộ"', () => {
      expect(sayKind(answer(['p1-1']), 'DiscardToHandLimit')).toBe('🤖 AI bỏ «p1-1» xuống mộ');
    });

    it('an unknown or missing kind gets a neutral sentence (no guess from the ids)', () => {
      expect(sayKind(answer(['p1-1']))).toBe('🤖 AI trả lời lựa chọn: «p1-1»');
      expect(sayKind(answer(['p1-1']), 'FutureKind')).toBe('🤖 AI trả lời lựa chọn: «p1-1»');
      expect(sayKind(answer([]))).toBe('🤖 AI trả lời một lựa chọn');
      expect(sayKind(answer([], true))).toBe('🤖 AI không kích hoạt hiệu ứng trigger');
    });
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
