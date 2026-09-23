import { randomUUID } from 'node:crypto';
import { Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /** Throwaway identity: stateless (nothing stored), the token `sub` is the guest id. */
  @Post('guest')
  @HttpCode(201)
  async guest(): Promise<{ guestId: string; accessToken: string }> {
    const guestId = randomUUID();
    const accessToken = await this.jwt.signAsync(
      { sub: guestId, kind: 'guest' },
      // `expiresIn` is typed as a template-literal type upstream; the env schema guarantees a duration string.
      { expiresIn: this.config.get('GUEST_TOKEN_TTL', { infer: true }) as never },
    );
    return { guestId, accessToken };
  }
}
