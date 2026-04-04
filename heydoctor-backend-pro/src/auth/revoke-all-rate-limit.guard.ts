import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';
import type { Request } from 'express';
import { ENV_CONFIG_TOKEN, type EnvConfig } from '../config/env.config';

/**
 * Rate limit POST /auth/revoke-all por usuario (post JWT).
 * Usa el mismo storage que ThrottlerModule (Redis si está configurado).
 */
@Injectable()
export class RevokeAllRateLimitGuard implements CanActivate {
  private static readonly WINDOW_MS = 60_000;
  private static readonly THROTTLER_NAME = 'revokeAllUser';

  constructor(
    @Inject(ThrottlerStorage)
    private readonly storage: ThrottlerStorage,
    @Inject(ENV_CONFIG_TOKEN)
    private readonly env: EnvConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: { sub: string } }
    >();
    const userId = req.user?.sub;
    const tracker = userId
      ? `revoke-all:user:${userId}`
      : `revoke-all:ip:${String(req.ip ?? 'unknown')}`;

    const limit = this.env.authRevokeAllPerMinute;
    const ttl = RevokeAllRateLimitGuard.WINDOW_MS;
    const { isBlocked } = await this.storage.increment(
      tracker,
      ttl,
      limit,
      ttl,
      RevokeAllRateLimitGuard.THROTTLER_NAME,
    );

    if (isBlocked) {
      throw new ThrottlerException('Too many revoke-all requests');
    }

    return true;
  }
}
