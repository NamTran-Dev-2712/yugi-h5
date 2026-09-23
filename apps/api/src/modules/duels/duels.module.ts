import { Module } from '@nestjs/common';
import { InMemoryDuelStore } from './duel-store';
import { DUEL_STORE, DuelService } from './duel.service';

/**
 * Server-authoritative duel loop: `DuelService` wraps @yugi/game-engine applyAction per DuelSession
 * (solo vs AI first, then PvP via the realtime module). The store is in-memory for now; bind `DUEL_STORE`
 * to a DB/Redis implementation later. Controllers arrive in task 2.3.
 */
@Module({
  providers: [{ provide: DUEL_STORE, useClass: InMemoryDuelStore }, DuelService],
  exports: [DuelService],
})
export class DuelsModule {}
