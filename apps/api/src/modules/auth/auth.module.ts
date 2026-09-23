import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema';
import { AuthController } from './auth.controller';
import { GuestAuthGuard } from './guest-auth.guard';

/**
 * Guest login only for now (`POST /auth/guest`). Account register/login, refresh rotation and guest -> account
 * upgrade come with P7; see docs/design/protocol.md.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [GuestAuthGuard],
  exports: [JwtModule, GuestAuthGuard],
})
export class AuthModule {}
