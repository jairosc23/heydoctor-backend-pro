import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';

/**
 * Purga filas antiguas para no crecer refresh_tokens sin límite.
 * - Expiradas hace ≥24h
 * - Revocadas hace ≥30d
 */
@Injectable()
export class AuthRefreshTokenCleanupService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeStaleRefreshTokens(): Promise<void> {
    const now = Date.now();
    const expiredCutoff = new Date(now - 24 * 60 * 60 * 1000);
    const revokedCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where(
        '(expires_at < :expiredCutoff OR (revoked_at IS NOT NULL AND revoked_at < :revokedCutoff))',
        { expiredCutoff, revokedCutoff },
      )
      .execute();
  }
}
