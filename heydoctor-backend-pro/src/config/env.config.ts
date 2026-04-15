import { ConfigService } from '@nestjs/config';

/**
 * Typed, centralized environment configuration.
 * Single source of truth for all env vars used across the app.
 *
 * Categories:
 * - CORE: DB, port, node_env
 * - AUTH: JWT secret
 * - CORS: allowed origins
 * - PAYKU: payment provider
 * - AI: OpenAI integration
 * - COMPLIANCE: HIPAA mode
 * - URLS: frontend/backend public URLs
 */
export class EnvConfig {
  // ── CORE ──
  readonly nodeEnv: string;
  readonly port: number;
  readonly databaseUrl: string;

  // ── AUTH ──
  readonly jwtSecret: string;
  /** TTL access JWT (p. ej. `15m`); ver `jwt-ttl.util.ts`. */
  readonly jwtAccessTtl: string;
  /** TTL refresh cookie + fila `refresh_tokens` (p. ej. `7d`). */
  readonly jwtRefreshTtl: string;
  /** Máximo de sesiones refresh activas por usuario (login/refresh); se revocan las más antiguas. */
  readonly authMaxActiveRefreshSessions: number;
  /** Límite de POST /auth/revoke-all por usuario por minuto (ventana fija 60s). */
  readonly authRevokeAllPerMinute: number;

  // ── CORS ──
  readonly corsOrigin: string[];

  /**
   * Redis opcional: caché Keyv (`AppCacheModule`), Throttler distribuido, BullMQ (`QueueModule`).
   * Compatible con Railway Redis y Upstash (`rediss://`).
   */
  readonly redisUrl: string | null;

  // ── PAYKU ──
  readonly paykuApiUrl: string | null;
  readonly paykuApiKey: string | null;
  readonly paykuWebhookSecret: string | null;
  readonly paykuWebhookBearer: string | null;
  readonly paykuWebhookAllowUnsafeLocal: boolean;
  readonly consultationPaymentAmountClp: number;
  readonly paymentPendingExpireMinutes: number;

  // ── AI ──
  readonly openaiApiKey: string | null;
  readonly openaiModel: string;

  // ── COMPLIANCE ──
  readonly hipaaMode: boolean;
  /**
   * Si es true, al pasar a completado/firmado/bloqueado se exige que el diagnóstico
   * empiece por un prefijo con forma CIE-10 (no sustituye catálogo oficial).
   */
  readonly requireCie10PrefixForCompletion: boolean;

  // ── URLS ──
  readonly frontendUrl: string;
  readonly backendPublicUrl: string;

  constructor(config: ConfigService) {
    this.nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
    this.port = Number.parseInt(config.get<string>('PORT') ?? '3001', 10);

    const dbUrl =
      config.get<string>('DATABASE_PUBLIC_URL') ??
      config.get<string>('DATABASE_URL') ??
      '';
    this.databaseUrl = dbUrl;

    this.jwtSecret = config.get<string>('JWT_SECRET') ?? '';
    this.jwtAccessTtl =
      config.get<string>('JWT_ACCESS_TTL')?.trim() || '15m';
    this.jwtRefreshTtl =
      config.get<string>('JWT_REFRESH_TTL')?.trim() || '7d';

    const maxSessionsRaw = Number(
      config.get<string>('AUTH_MAX_ACTIVE_REFRESH_SESSIONS') ?? '8',
    );
    let maxSessions = Number.isFinite(maxSessionsRaw)
      ? Math.floor(maxSessionsRaw)
      : 8;
    maxSessions = Math.min(20, Math.max(5, maxSessions));
    this.authMaxActiveRefreshSessions = maxSessions;

    const revokeAllRaw = Number(
      config.get<string>('AUTH_REVOKE_ALL_PER_MINUTE') ?? '5',
    );
    let revokeAll = Number.isFinite(revokeAllRaw)
      ? Math.floor(revokeAllRaw)
      : 5;
    revokeAll = Math.min(10, Math.max(3, revokeAll));
    this.authRevokeAllPerMinute = revokeAll;

    this.corsOrigin = (config.get<string>('CORS_ORIGIN') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const redisUrlRaw = config.get<string>('REDIS_URL')?.trim();
    this.redisUrl = redisUrlRaw && redisUrlRaw.length > 0 ? redisUrlRaw : null;

    this.paykuApiUrl = config.get<string>('PAYKU_API_URL') ?? null;
    this.paykuApiKey = config.get<string>('PAYKU_API_KEY') ?? null;
    this.paykuWebhookSecret =
      config.get<string>('PAYKU_WEBHOOK_SECRET') ?? null;
    this.paykuWebhookBearer =
      config.get<string>('PAYKU_WEBHOOK_BEARER') ?? null;
    this.paykuWebhookAllowUnsafeLocal =
      config.get<string>('PAYKU_WEBHOOK_ALLOW_UNSAFE_LOCAL') === 'true';
    this.consultationPaymentAmountClp = Number(
      config.get<string>('CONSULTATION_PAYMENT_AMOUNT_CLP') ?? '15000',
    );
    this.paymentPendingExpireMinutes = Number(
      config.get<string>('PAYMENT_PENDING_EXPIRE_MINUTES') ?? '1440',
    );

    this.openaiApiKey = config.get<string>('OPENAI_API_KEY') ?? null;
    this.openaiModel =
      config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';

    this.hipaaMode =
      config.get<string>('HIPAA_MODE')?.toLowerCase() === 'true';

    this.requireCie10PrefixForCompletion =
      config.get<string>('REQUIRE_CIE10_PREFIX_FOR_COMPLETION') === 'true';

    this.frontendUrl =
      config.get<string>('FRONTEND_URL') ?? 'https://heydoctor.vercel.app';
    this.backendPublicUrl =
      config.get<string>('BACKEND_PUBLIC_URL') ??
      'https://heydoctor-backend-pro-production.up.railway.app';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}

export const ENV_CONFIG_TOKEN = 'ENV_CONFIG';
