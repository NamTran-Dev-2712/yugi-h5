import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SAMPLE_CARDS, type CardDefinition } from '@yugi/shared';

@ApiTags('cards')
@Controller('cards')
export class CardsController {
  @Get()
  @ApiOperation({ summary: 'List all card definitions (placeholder set until M2 content lands)' })
  list(): CardDefinition[] {
    return SAMPLE_CARDS;
  }
}
