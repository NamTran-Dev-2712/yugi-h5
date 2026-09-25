import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DuelsModule } from '../duels/duels.module';
import { DevSandboxController } from './dev-sandbox.controller';

/** Dev tool (Duel Sandbox). Never registered in production: see `devOnlyModules`. */
@Module({
  imports: [AuthModule, DuelsModule],
  controllers: [DevSandboxController],
})
export class DevSandboxModule {}
