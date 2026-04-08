import {
  Inject,
  Injectable,
  UnauthorizedException,
  type LoggerService,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Brackets, IsNull, MoreThan, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { AuditOutcome } from '../audit/audit-outcome.enum';
import {
  Subscription,
  SubscriptionPlan,
} from '../subscriptions/subscription.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { APP_LOGGER } from '../common/logger/logger.tokens';
import {
  maskOptionalUuid,
  maskUuid,
} from '../common/observability/log-masking.util';
import { ENV_CONFIG_TOKEN, type EnvConfig } from '../config/env.config';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.interface';
import {
  computeDeviceHash,
  formatDeviceLabel,
  maskIpForSessionList,
} from './device-fingerprint.util';
import { jwtTtlToMs } from './jwt-ttl.util';

const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Metadata extracted from the HTTP request by the controller. */
export type RequestContext = {
  ip: string | null;
  userAgent: string | null;
};

export type AuthUserView = {
  id: string;
  email: string;
  role: UserRole;
};

export type MeResponse = {
  id: string;
  email: string;
  role: UserRole;
  clinicId: string;
  plan: SubscriptionPlan;
};

export type ActiveSessionView = {
  sessionId: string;
  device: string;
  ip: string;
  createdAt: string;
  lastUsedAt: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_LOGGER)
    private readonly logger: LoggerService,
    @Inject(ENV_CONFIG_TOKEN)
    private readonly env: EnvConfig,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  // ── Public Auth flows ─────────────────────────────────────────

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(
      dto.email,
      dto.password,
      UserRole.DOCTOR,
    );
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto, ctx: RequestContext) {
    const user = await this.usersService.validateCredentials(
      dto.email,
      dto.password,
    );
    if (!user) {
      await this.logSecurityEvent('LOGIN_FAILED', null, ctx, {
        reason: 'invalid_credentials',
      });
      this.logger.warn('User login failed', {
        reason: 'invalid_credentials',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.logSecurityEvent(
      'LOGIN_SUCCESS',
      user.id,
      ctx,
      undefined,
      user.clinicId,
    );
    this.logger.log('User login success', {
      userId: maskUuid(user.id),
      clinicId: maskUuid(user.clinicId),
    });
    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: User) {
    const publicUser = this.toPublicUser(user);
    const payload: JwtPayload = {
      sub: publicUser.id,
      email: publicUser.email,
      role: publicUser.role,
    };
    const access_token = await this.jwtService.signAsync(payload);
    return { access_token, user: publicUser };
  }

  // ── Refresh Token Management (rotación en cada uso) ───────────

  async createRefreshToken(
    userId: string,
    ctx: RequestContext,
    clinicId?: string | null,
  ): Promise<string> {
    await this.enforceSessionLimit(userId);

    let resolvedClinicId = clinicId ?? null;
    if (!resolvedClinicId) {
      const u = await this.usersService.findById(userId);
      resolvedClinicId = u?.clinicId ?? null;
    }

    const raw = generateRawToken();
    const tokenHash = hashToken(raw);
    const refreshMs = jwtTtlToMs(this.env.jwtRefreshTtl, DEFAULT_REFRESH_MS);
    const expiresAt = new Date(Date.now() + refreshMs);

    const rawUa = ctx.userAgent;
    const entity = this.refreshTokenRepository.create({
      tokenHash,
      userId,
      clinicId: resolvedClinicId,
      expiresAt,
      ipAddress: ctx.ip,
      userAgent: rawUa ? rawUa.slice(0, 512) : null,
      userAgentNormalized: formatDeviceLabel(rawUa),
      deviceHash: computeDeviceHash(rawUa),
    });
    await this.refreshTokenRepository.save(entity);

    return raw;
  }

  async validateAndRotateRefreshToken(
    rawToken: string,
    ctx: RequestContext,
  ): Promise<{ accessToken: string; newRefreshToken: string }> {
    const tokenHash = hashToken(rawToken);

    const stored = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      await this.revokeAllUserTokens(stored.userId);
      this.logger.error('SECURITY_ALERT', {
        type: 'TOKEN_REUSE_DETECTED',
        userId: stored.userId,
        clinicId: stored.clinicId ?? null,
      });
      await this.logSecurityEvent(
        'TOKEN_REUSE_DETECTED',
        stored.userId,
        ctx,
        {
          sessionId: stored.id,
          originalRevokedAt: stored.revokedAt.toISOString(),
          severity: 'critical',
        },
        stored.clinicId,
      );
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    stored.revokedAt = new Date();
    stored.lastUsedAt = new Date();
    await this.refreshTokenRepository.save(stored);

    const user = await this.usersService.findById(stored.userId);
    if (!user || user.isActive === false) {
      throw new UnauthorizedException('User not found');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    const newRefreshToken = await this.createRefreshToken(user.id, ctx, user.clinicId);

    await this.logSecurityEvent(
      'TOKEN_REFRESH',
      user.id,
      ctx,
      { previousSessionId: stored.id },
      user.clinicId,
    );

    return { accessToken, newRefreshToken };
  }

  async performLogout(
    rawToken: string | undefined,
    ctx: RequestContext,
  ): Promise<void> {
    if (!rawToken) {
      return;
    }
    const tokenHash = hashToken(rawToken);
    const stored = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });
    if (!stored) {
      return;
    }
    if (!stored.revokedAt) {
      stored.revokedAt = new Date();
      await this.refreshTokenRepository.save(stored);
      await this.logSecurityEvent(
        'LOGOUT',
        stored.userId,
        ctx,
        { sessionId: stored.id },
        stored.clinicId,
      );
    }
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const stored = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });
    if (stored && !stored.revokedAt) {
      stored.revokedAt = new Date();
      await this.refreshTokenRepository.save(stored);
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /**
   * Revoca todos los refresh activos del usuario en su clínica (+ filas legacy sin clinic_id).
   */
  async revokeAllSessionsForCurrentUser(
    userId: string,
    ctx: RequestContext,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || user.isActive === false) {
      throw new UnauthorizedException();
    }

    await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where('clinic_id = :clinicId', {
            clinicId: user.clinicId,
          }).orWhere('clinic_id IS NULL');
        }),
      )
      .execute();

    await this.logSecurityEvent(
      'LOGOUT',
      userId,
      ctx,
      { scope: 'ALL_SESSIONS' },
      user.clinicId,
    );
  }

  async listActiveSessions(userId: string): Promise<ActiveSessionView[]> {
    const user = await this.usersService.findById(userId);
    if (!user || user.isActive === false) {
      throw new UnauthorizedException();
    }

    const rows = await this.refreshTokenRepository
      .createQueryBuilder('rt')
      .where('rt.user_id = :userId', { userId })
      .andWhere('rt.revoked_at IS NULL')
      .andWhere('rt.expires_at > :now', { now: new Date() })
      .andWhere(
        new Brackets((qb) => {
          qb.where('rt.clinic_id = :clinicId', {
            clinicId: user.clinicId,
          }).orWhere('rt.clinic_id IS NULL');
        }),
      )
      .orderBy('rt.last_used_at', 'DESC', 'NULLS LAST')
      .addOrderBy('rt.created_at', 'DESC')
      .getMany();

    return rows.map((r) => ({
      sessionId: r.id,
      device:
        r.userAgentNormalized?.trim() || formatDeviceLabel(r.userAgent),
      ip: maskIpForSessionList(r.ipAddress),
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    }));
  }

  // ── Session limit enforcement ─────────────────────────────────

  /**
   * Mantiene como máximo N sesiones activas por usuario: revoca las más antiguas
   * (created_at ASC) sin bloquear login ni refresh.
   */
  private async enforceSessionLimit(userId: string): Promise<void> {
    const limit = this.env.authMaxActiveRefreshSessions;

    const activeCount = await this.refreshTokenRepository.count({
      where: {
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (activeCount < limit) {
      return;
    }

    const toRevokeCount = activeCount - limit + 1;
    const oldest = await this.refreshTokenRepository.find({
      where: {
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'ASC' },
      take: toRevokeCount,
    });

    const now = new Date();
    for (const row of oldest) {
      row.revokedAt = now;
    }
    await this.refreshTokenRepository.save(oldest);
  }

  // ── Security audit logging (sin PII en metadata) ───────────

  private async logSecurityEvent(
    action: string,
    userId: string | null,
    ctx: RequestContext,
    extra?: Record<string, unknown>,
    clinicId?: string | null,
  ): Promise<void> {
    try {
      const row = this.auditLogRepository.create({
        userId,
        clinicId: clinicId ?? null,
        action,
        resource: 'auth',
        status:
          action.includes('FAIL') || action.includes('REUSE')
            ? AuditOutcome.ERROR
            : AuditOutcome.SUCCESS,
        httpStatus: action.includes('FAIL') ? 401 : 200,
        metadata: {
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          ...extra,
        },
      });
      await this.auditLogRepository.save(row);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        'Unexpected error in AuthService.logSecurityEvent',
        error,
        {
          action,
          userId: userId != null ? maskOptionalUuid(userId) : undefined,
        },
      );
    }
  }

  // ── /auth/me ──────────────────────────────────────────────────

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.usersService.findById(userId);
    if (!user || user.isActive === false) {
      throw new UnauthorizedException();
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { userId },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId,
      plan: subscription?.plan ?? SubscriptionPlan.FREE,
    };
  }

  private toPublicUser(user: User): AuthUserView {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
