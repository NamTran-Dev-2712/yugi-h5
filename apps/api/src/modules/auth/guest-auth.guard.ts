import {
  createParamDecorator,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export type GuestRequest = Request & { guestId?: string };

/** Requires `Authorization: Bearer <guest JWT>`; on success `req.guestId` is the token `sub`. */
@Injectable()
export class GuestAuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<GuestRequest>();
    const header = req.headers.authorization;
    const [scheme, token] = typeof header === 'string' ? header.split(' ') : [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token.');
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown; kind?: unknown }>(token);
      if (typeof payload.sub !== 'string' || payload.sub === '' || payload.kind !== 'guest') {
        throw new Error('not a guest token');
      }
      req.guestId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}

/** The authenticated guest id (only valid on routes behind `GuestAuthGuard`). */
export const GuestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const guestId = ctx.switchToHttp().getRequest<GuestRequest>().guestId;
  if (!guestId) throw new UnauthorizedException('Missing bearer token.');
  return guestId;
});
