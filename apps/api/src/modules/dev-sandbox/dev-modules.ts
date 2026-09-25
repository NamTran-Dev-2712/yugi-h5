import type { Type } from '@nestjs/common';
import { DevSandboxModule } from './dev-sandbox.module';

/**
 * Modules that exist only outside production (dev tools). In production the list is empty, so the routes are not
 * registered at all and answer 404. Same test as the logger setup in `app.module.ts` (`NODE_ENV === 'production'`); the
 * module list is static, so `AppModule` passes `process.env.NODE_ENV` (validated by `env.schema.ts`, default
 * "development") instead of asking `ConfigService`.
 */
export function devOnlyModules(nodeEnv: string | undefined): Type<unknown>[] {
  return nodeEnv === 'production' ? [] : [DevSandboxModule];
}
