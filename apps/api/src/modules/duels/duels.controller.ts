import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Action } from '@yugi/game-engine';
import {
  STARTER_DECK,
  validateDeck,
  type CreateSoloResponse,
  type GetViewResponse,
  type ViewResponse,
} from '@yugi/shared';
import type { z } from 'zod';
import { ZodPipe } from '../../common/pipes/zod-pipe';
import { GuestAuthGuard, GuestId } from '../auth/guest-auth.guard';
import { lookupCard } from './card-pool';
import { assertMayControl, assertMayView, playerIdsFor } from './duel-access';
import { DuelServiceErrorFilter } from './duel-error.filter';
import { DuelService } from './duel.service';
import { ActionBody, CreateSoloBody, ViewerQuery } from './duels.dto';

/** HTTP only: parse, authorize through `duel-access`, call `DuelService`, answer. No game logic here. */
@Controller('duels')
@UseGuards(GuestAuthGuard)
@UseFilters(DuelServiceErrorFilter)
export class DuelsController {
  constructor(@Inject(DuelService) private readonly duels: DuelService) {}

  @Post('solo')
  @HttpCode(201)
  async createSolo(
    @GuestId() guestId: string,
    @Body(new ZodPipe(CreateSoloBody)) body: z.infer<typeof CreateSoloBody>,
  ): Promise<CreateSoloResponse> {
    const single = body.deck ?? STARTER_DECK;
    const decks = body.decks ?? [single, single];
    const errors = decks.flatMap((deck, seat) => {
      const check = validateDeck(deck, lookupCard);
      return check.ok ? [] : check.errors.map((e) => ({ seat, ...e }));
    });
    if (errors.length > 0) {
      throw new BadRequestException({
        code: 'INVALID_DECK',
        message: 'The deck is not valid.',
        errors,
      });
    }
    const mode = body.mode;
    // vs-ai: the caller is seat 0 (first to act), the server plays seat 1. The AI seat is never viewable.
    const aiSeat = mode === 'solo-vs-ai' ? (1 as const) : undefined;
    const viewer = body.viewer ?? 0;
    if (viewer === aiSeat) {
      throw new BadRequestException({
        code: 'INVALID_VIEWER',
        message: 'You cannot view the AI seat.',
      });
    }
    const created = await this.duels.createDuel({
      playerIds: playerIdsFor(mode, guestId, aiSeat),
      deckLists: [decks[0], decks[1]],
      mode,
      ownerId: guestId,
      ...(aiSeat !== undefined ? { aiSeat } : {}),
    });
    return {
      duelId: created.duelId,
      mode,
      viewer,
      ...(aiSeat !== undefined ? { aiSeat } : {}),
      view: created.views[viewer],
      events: created.eventsByViewer[viewer],
      legalActions: created.legalActionsByViewer[viewer],
      ...(created.aiActions ? { aiActions: created.aiActions } : {}),
    };
  }

  @Get(':id')
  async getView(
    @GuestId() guestId: string,
    @Param('id') duelId: string,
    @Query(new ZodPipe(ViewerQuery)) query: z.infer<typeof ViewerQuery>,
  ): Promise<GetViewResponse> {
    assertMayView(await this.duels.getMeta(duelId), guestId, query.viewer);
    return {
      view: await this.duels.getView(duelId, query.viewer),
      legalActions: await this.duels.getLegalActions(duelId, query.viewer),
    };
  }

  @Post(':id/actions')
  @HttpCode(200)
  async submitAction(
    @GuestId() guestId: string,
    @Param('id') duelId: string,
    @Body(new ZodPipe(ActionBody)) body: z.infer<typeof ActionBody>,
  ): Promise<ViewResponse> {
    assertMayControl(await this.duels.getMeta(duelId), guestId, body.playerIndex);
    // Only the envelope is checked here; the engine validates the payload and DuelManager binds it to the seat.
    const result = await this.duels.submitAction(
      duelId,
      body.playerIndex,
      body.action as unknown as Action,
    );
    return {
      view: result.view,
      events: result.events,
      legalActions: result.legalActions,
      aiActions: result.aiActions,
    };
  }
}
