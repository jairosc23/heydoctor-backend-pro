import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditLog } from './audit-log.entity';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    AuthorizationModule,
    AuthModule,
  ],
  controllers: [AuditController],
  providers: [
    {
      provide: AppLoggerService,
      useFactory: () => new AppLoggerService(AuditService.name),
    },
    AuditService,
  ],
  exports: [AuditService, AppLoggerService],
})
export class AuditModule {}
