import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as Sentry from '@sentry/node';
import helmet from 'helmet';
import { logExpressRouteStackIfEnabled } from './common/bootstrap/log-express-routes';
import { validateAndLogEnv } from './config/env-startup-check';
import { EnvConfig, ENV_CONFIG_TOKEN } from './config/env.config';
import { AppModule } from './app.module';
import type { Request, Response } from 'express';

const bootstrapLogger = new Logger('Bootstrap');

const sentryDsn = process.env.SENTRY_DSN?.trim();
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.15 : 1.0,
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const server = app.getHttpAdapter().getInstance();

  // Healthcheck ultra rápido para Railway (Express; no controllers / guards / ORM en la petición)
  server.get('/_health', (_req: Request, res: Response) => {
    res.status(200).send('ok');
  });

  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.useWebSocketAdapter(new IoAdapter(app));

  /**
   * Prefijo global antes de guards: rutas y Throttler alineados con `/api/...`
   * (p. ej. `POST /api/auth/login` desde AuthModule / AuthController).
   */
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
      { path: 'healthz', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
      /** Links mágicos para pacientes (sin `/api` en SMS/email). */
      { path: 'appointments/confirm/(.*)', method: RequestMethod.GET },
      { path: 'appointments/cancel/(.*)', method: RequestMethod.GET },
    ],
  });

  /**
   * Throttler global (AppModule) + bucket login por email; JwtAuthGuard solo en rutas protegidas.
   */
  app.useGlobalGuards(app.get(ThrottlerGuard));

  const envConfig = app.get<EnvConfig>(ENV_CONFIG_TOKEN);
  const missingVars = validateAndLogEnv(envConfig);
  if (missingVars.length > 0 && envConfig.isProduction) {
    throw new Error(
      `Missing required env vars in production: ${missingVars.join(', ')}`,
    );
  }

  // Producción: origen de producción en Vercel + CORS_ORIGIN (p. ej. previews *.vercel.app).
  const productionFrontendOrigins = ['https://heydoctor-frontend.vercel.app'];
  const localDevOrigins = ['http://localhost:3000'];
  const corsOrigins = envConfig.isProduction
    ? [
        ...productionFrontendOrigins,
        ...envConfig.corsOrigin.filter(
          (o) => !productionFrontendOrigins.includes(o),
        ),
      ]
    : envConfig.corsOrigin.length > 0
      ? envConfig.corsOrigin
      : localDevOrigins;

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-CSRF-Token',
      'X-Request-Id',
      'X-Region',
      'X-HeyDoctor-Consultation-Id',
      'X-HeyDoctor-Call-Id',
    ],
    exposedHeaders: ['X-Request-Id', 'X-HeyDoctor-Region-Sticky'],
  });

  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    if (envConfig.isProduction) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT;

  if (!port) {
    throw new Error('PORT is not defined. Railway requires PORT env variable.');
  }

  await app.listen(port, '0.0.0.0');

  bootstrapLogger.log('Migrations should be applied');
  bootstrapLogger.log(
    `Listening 0.0.0.0:${port} — AuthModule: POST /api/auth/login (JwtAuthGuard no es global; login es público)`,
  );
  logExpressRouteStackIfEnabled(app);
}

bootstrap().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  if (process.env.NODE_ENV === 'production') {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        message: 'Fatal startup error',
        detail: msg,
        stack,
      }),
    );
  } else {
    console.error('[HeyDoctor] Fatal startup error', err);
  }
  process.exit(1);
});
