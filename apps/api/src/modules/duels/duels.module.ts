import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DuelsController } from './duels.controller';
import { InMemoryDuelStore } from './duel-store';
import { DUEL_STORE, DuelService } from './duel.service';

/**
 * Server-authoritative duel loop: `DuelService` wraps @yugi/game-engine applyAction per DuelSession, exposed over
 * HTTP by `DuelsController` (solo-debug for now; solo vs AI, then PvP via the realtime module, later). The store
 * is in-memory; bind `DUEL_STORE` to a DB/Redis implementation later.
 */
@Module({
  imports: [AuthModule],
  controllers: [DuelsController],
  providers: [{ provide: DUEL_STORE, useClass: InMemoryDuelStore }, DuelService],
  exports: [DuelService],
})
export class DuelsModule {}
