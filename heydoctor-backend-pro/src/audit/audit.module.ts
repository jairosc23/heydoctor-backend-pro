import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), AuthorizationModule],
  providers: [
    {
      provide: AppLoggerService,
      useFactory: () => new AppLoggerService(AuditService.name),
    },
    AuditService,
  ],
  exports: [AuditService],
})
export class AuditModule {}
