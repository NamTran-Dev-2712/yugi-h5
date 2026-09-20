import { Module } from '@nestjs/common';

/**
 * Skeleton for M3+: DuelService wraps @yugi/game-engine's applyAction as the
 * server-authoritative loop for a DuelSession (solo vs AI first, then PvP via
 * the realtime module). DuelMatch (seed + action log) is the persisted replay record.
 */
@Module({})
export class DuelsModule {}
