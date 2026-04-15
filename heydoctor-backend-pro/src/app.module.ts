import { createHash } from 'crypto';
import { join } from 'path';
import {
  ExecutionContext,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import type { Request } from 'express';
import cookieParser from 'cookie-parser';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { AppController } from './app.controller';
import { AppCacheModule } from './cache/cache.module';
import { AiModule } from './ai/ai.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuditModule } from './audit/audit.module';
import { LoggerModule } from './common/logger/logger.module';
import { AuthModule } from './auth/auth.module';
import { JwtUserCacheModule } from './auth/jwt-user-cache.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { ComplianceModule } from './compliance/compliance.module';
import { EnvConfigModule } from './config/env-config.module';
import { ConsentModule } from './consents/consent.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { LegalPdfModule } from './legal-pdf/legal-pdf.module';
import { LegalModule } from './legal/legal.module';
import { MetricsModule } from './metrics/metrics.module';
import { PaykuModule } from './payku/payku.module';
import { PatientsModule } from './patients/patients.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';
import { DoctorApplicationsModule } from './doctor-applications/doctor-applications.module';
import { DoctorProfilesModule } from './doctor-profiles/doctor-profiles.module';
import { GdprModule } from './gdpr/gdpr.module';
import { HealthApiController, HealthController } from './health/health.controller';
import { DoctorsModule } from './doctors/doctors.module';
import { PaymentsModule } from './payments/payments.module';
import { PlatformModule } from './platform/platform.module';
import { WebrtcModule } from './webrtc/webrtc.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { UserRequestContextInterceptor } from './common/interceptors/user-request-context.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestMetricsMiddleware } from './common/middleware/request-metrics.middleware';
import { DatabaseRoutingModule } from './common/database/database-routing.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { CsrfMiddleware } from './common/security/csrf.middleware';
import { CsrfModule } from './common/security/csrf.module';
import { QueueModule } from './queue/queue.module';
import { TYPEORM_READ_CONNECTION } from './common/database/typeorm-read-replica';
import { LoadSheddingMiddleware } from './common/middleware/load-shedding.middleware';
import { RegionModule } from './common/region/region.module';
import { CostAwareThrottlerGuard } from './common/throttler/cost-aware-throttler.guard';
import { throttlerTrackerIpAndOptionalUser } from './common/throttler/throttler-tracker.util';

const dbUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const readReplicaUrl = process.env.DATABASE_READ_REPLICA_URL?.trim();

const typeOrmShared = {
  type: 'postgres' as const,
  ssl: { rejectUnauthorized: false },
  autoLoadEntities: true,
  synchronize: false,
  logging: process.env.NODE_ENV === 'production' ? false : true,
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    LoggerModule,
    ObservabilityModule,
    DatabaseRoutingModule,
    RegionModule,
    CsrfModule,
    AppCacheModule,
    QueueModule.forRoot(),
    JwtUserCacheModule,
    TypeOrmModule.forRoot({
      ...typeOrmShared,
      url: dbUrl,
      migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
      migrationsRun: true,
    }),
    ...(readReplicaUrl
      ? [
          TypeOrmModule.forRoot({
            ...typeOrmShared,
            name: TYPEORM_READ_CONNECTION,
            url: readReplicaUrl,
          }),
        ]
      : []),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL?.trim();
        return {
          throttlers: [
            {
              name: 'burst',
              ttl: 5_000,
              limit: 20,
            },
            {
              name: 'sustain',
              ttl: 60_000,
              limit: 100,
            },
            {
              name: 'loginEmail',
              ttl: 15 * 60_000,
              limit: 5,
              skipIf: (context: ExecutionContext) => {
                const req = context.switchToHttp().getRequest<Request>();
                if (req.method !== 'POST') {
                  return true;
                }
                const path =
                  req.originalUrl?.split('?')[0] ?? req.url ?? '';
                return !path.includes('/auth/login');
              },
              getTracker: (
                req: Record<string, unknown>,
              ): Promise<string> | string => {
                const r = req as unknown as Request;
                const email = (r.body as { email?: string } | undefined)
                  ?.email;
                if (typeof email === 'string' && email.trim()) {
                  return Promise.resolve(
                    `login-email:${email.toLowerCase().trim()}`,
                  );
                }
                return Promise.resolve(
                  `login-email:ip:${String(r.ip ?? 'unknown')}`,
                );
              },
            },
            {
              name: 'loginIp',
              ttl: 15 * 60_000,
              limit: 25,
              skipIf: (context: ExecutionContext) => {
                const req = context.switchToHttp().getRequest<Request>();
                if (req.method !== 'POST') {
                  return true;
                }
                const path = req.originalUrl?.split('?')[0] ?? req.url ?? '';
                return !path.includes('/auth/login');
              },
              getTracker: (req: Record<string, unknown>) => {
                const r = req as unknown as Request;
                return `login-ip:${String(r.ip ?? 'unknown')}`;
              },
            },
            {
              name: 'magicLink',
              ttl: 60 * 60_000,
              limit: 12,
              skipIf: (context: ExecutionContext) => {
                const req = context.switchToHttp().getRequest<Request>();
                if (req.method !== 'POST') {
                  return true;
                }
                const path = req.originalUrl?.split('?')[0] ?? req.url ?? '';
                return !path.includes('/auth/magic-link');
              },
              getTracker: (req: Record<string, unknown>) => {
                const r = req as unknown as Request;
                const raw = (r.body as { token?: string } | undefined)?.token;
                if (typeof raw === 'string' && raw.trim().length > 0) {
                  const h = createHash('sha256').update(raw.trim()).digest('hex');
                  return `magic-link-token:${h.slice(0, 40)}`;
                }
                return `magic-link-ip:${String(r.ip ?? 'unknown')}`;
              },
            },
            {
              name: 'webrtc',
              ttl: 60_000,
              limit: 90,
              skipIf: (context: ExecutionContext) => {
                const req = context.switchToHttp().getRequest<Request>();
                const path = req.originalUrl?.split('?')[0] ?? req.url ?? '';
                return !path.includes('/webrtc');
              },
              getTracker: (req: Record<string, unknown>) => {
                const r = req as unknown as Request;
                return `webrtc:${String(r.ip ?? 'unknown')}`;
              },
            },
          ],
          ...(redisUrl
            ? { storage: new ThrottlerStorageRedisService(redisUrl) }
            : {}),
          getTracker: (req) => throttlerTrackerIpAndOptionalUser(req),
        };
      },
    }),
    UsersModule,
    AuthorizationModule,
    AuthModule,
    AuditModule,
    PatientsModule,
    AppointmentsModule,
    EnvConfigModule,
    ComplianceModule,
    ConsentModule,
    ConsultationsModule,
    LegalPdfModule,
    LegalModule,
    MetricsModule,
    PaykuModule,
    SubscriptionsModule,
    AiModule,
    DoctorApplicationsModule,
    DoctorProfilesModule,
    GdprModule,
    WebrtcModule,
    PlatformModule,
    DoctorsModule,
    PaymentsModule,
  ],
  controllers: [AppController, HealthController, HealthApiController],
  providers: [
    { provide: ThrottlerGuard, useClass: CostAwareThrottlerGuard },
    RequestIdMiddleware,
    RequestMetricsMiddleware,
    LoadSheddingMiddleware,
    { provide: APP_INTERCEPTOR, useClass: UserRequestContextInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        RequestIdMiddleware,
        RequestMetricsMiddleware,
        LoadSheddingMiddleware,
        cookieParser(),
        CsrfMiddleware,
      )
      .forRoutes('*');
  }
}
