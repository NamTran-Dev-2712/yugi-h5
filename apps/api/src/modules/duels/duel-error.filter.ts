import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DuelServiceError } from './duel-errors';
import { toDuelHttpError } from './duel-http';

@Catch(DuelServiceError)
export class DuelServiceErrorFilter implements ExceptionFilter<DuelServiceError> {
  catch(exception: DuelServiceError, host: ArgumentsHost): void {
    const { status, body } = toDuelHttpError(exception);
    host.switchToHttp().getResponse<Response>().status(status).json(body);
  }
}
