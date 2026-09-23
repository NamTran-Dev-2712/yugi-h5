import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

/**
 * Errors thrown by Express middleware (e.g. body-parser's 413 "too large" or 400 malformed JSON) are not Nest
 * HttpExceptions; they carry an `expose`-able 4xx status that must reach the client instead of becoming a 500.
 */
function toClientError(exception: unknown): { status: number; message: string } | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const e = exception as { status?: unknown; expose?: unknown; message?: unknown };
  if (typeof e.status !== 'number' || e.status < 400 || e.status > 499 || e.expose !== true) {
    return undefined;
  }
  return { status: e.status, message: typeof e.message === 'string' ? e.message : 'Bad request' };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const clientError = isHttpException ? undefined : toClientError(exception);
    const status = isHttpException
      ? exception.getStatus()
      : (clientError?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);
    const body = isHttpException
      ? exception.getResponse()
      : { message: clientError?.message ?? 'Internal server error' };

    if (!isHttpException && !clientError) {
      this.logger.error({ err: exception }, 'Unhandled exception');
    }

    response
      .status(status)
      .json(
        typeof body === 'string'
          ? { statusCode: status, message: body }
          : { statusCode: status, ...body },
      );
  }
}
