import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ScenarioSchema, type CreateSoloResponse } from '@yugi/shared';
import { z } from 'zod';
import { ZodPipe } from '../../common/pipes/zod-pipe';
import { GuestAuthGuard, GuestId } from '../auth/guest-auth.guard';
import { lookupCard } from '../duels/card-pool';
import { playerIdsFor } from '../duels/duel-access';
import { DuelServiceErrorFilter } from '../duels/duel-error.filter';
import { DuelService } from '../duels/duel.service';
import { scenarioToState } from './scenario-to-state';

const ModeQuery = z
  .object({ mode: z.enum(['solo-debug', 'solo-vs-ai']).default('solo-vs-ai') })
  .strict();

/**
 * DEV ONLY (module is not imported in production, see `dev-modules.ts`). Loads a Sandbox scenario as a duel owned by the
 * caller. Only builds the starting state and hands it to `DuelService`; every later action uses the normal
 * `/duels/:id/...` endpoints, so validation, views, legalActions and the AI are exactly those of a regular duel.
 */
@Controller('dev/sandbox')
@UseGuards(GuestAuthGuard)
@UseFilters(DuelServiceErrorFilter)
export class DevSandboxController {
  constructor(@Inject(DuelService) private readonly duels: DuelService) {}

  @Post('duels')
  @HttpCode(201)
  async load(
    @GuestId() guestId: string,
    @Body(new ZodPipe(ScenarioSchema)) scenario: z.infer<typeof ScenarioSchema>,
    @Query(new ZodPipe(ModeQuery)) query: z.infer<typeof ModeQuery>,
  ): Promise<CreateSoloResponse> {
    const mode = query.mode;
    // Same convention as /duels/solo: the caller is seat 0, the server plays seat 1 in solo-vs-ai.
    const aiSeat = mode === 'solo-vs-ai' ? (1 as const) : undefined;
    const state = scenarioToState(
      scenario,
      { matchId: randomUUID(), playerIds: playerIdsFor(mode, guestId, aiSeat) },
      lookupCard,
    );
    const created = await this.duels.createDuelFromState({
      state,
      seed: scenario.seed,
      mode,
      ownerId: guestId,
      ...(aiSeat !== undefined ? { aiSeat } : {}),
      ...(scenario.script ? { script: scenario.script } : {}),
    });
    return {
      duelId: created.duelId,
      mode,
      viewer: 0,
      ...(aiSeat !== undefined ? { aiSeat } : {}),
      view: created.views[0],
      events: created.eventsByViewer[0],
      legalActions: created.legalActionsByViewer[0],
      ...(created.aiActions ? { aiActions: created.aiActions } : {}),
    };
  }
}
