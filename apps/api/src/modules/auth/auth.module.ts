import { Module } from '@nestjs/common';

/**
 * Skeleton for M3: guest login (issues a JWT for a throwaway User with kind=GUEST),
 * account register/login (email+password, bcrypt), refresh token rotation, and
 * guest -> account upgrade. See docs/design/protocol.md for the planned endpoints.
 */
@Module({})
export class AuthModule {}
