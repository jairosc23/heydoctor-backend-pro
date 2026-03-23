import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AuditService } from './audit/audit.service';
import { AuthorizationService } from './authorization/authorization.service';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(new RequestIdMiddleware().use);

  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  const auditService = app.get(AuditService);
  const authorizationService = app.get(AuthorizationService);
  app.useGlobalInterceptors(
    new AuditInterceptor(auditService, authorizationService),
  );
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN')?.split(',').map((s) => s.trim()) ?? true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number.parseInt(
    config.get<string>('PORT') ?? '3001',
    10,
  );
  await app.listen(port);
}
void bootstrap();
