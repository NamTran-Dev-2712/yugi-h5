import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { DuelService } from './duel.service';
import { DuelsModule } from './duels.module';

describe('DuelsModule', () => {
  it('resolves DuelService through Nest DI and runs a duel', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [DuelsModule] }).compile();
    const service = moduleRef.get(DuelService);
    const { duelId } = await service.createDuel({
      playerIds: ['a', 'b'],
      deckLists: [Array(10).fill('SMP-001'), Array(10).fill('SMP-002')],
    });
    expect((await service.getView(duelId, 1)).viewerIndex).toBe(1);
  });
});
