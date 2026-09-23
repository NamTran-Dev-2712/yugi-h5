import type { NestExpressApplication } from '@nestjs/platform-express';

export const JSON_BODY_LIMIT = '100kb';

/** HTTP setup shared by `main.ts` and the e2e tests. The app must be created with `{ bodyParser: false }`. */
export function configureApp(app: NestExpressApplication, corsOrigin: string): void {
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.enableCors({
    origin: corsOrigin
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o !== ''),
    credentials: true,
  });
}
