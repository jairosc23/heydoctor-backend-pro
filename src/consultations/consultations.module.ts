import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { Consultation } from './consultation.entity';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsService } from './consultations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consultation]),
    AuthModule,
    AuthorizationModule,
    AuditModule,
    AiModule,
  ],
  controllers: [ConsultationsController],
  providers: [
    {
      provide: AppLoggerService,
      useFactory: () => new AppLoggerService(ConsultationsService.name),
    },
    ConsultationsService,
  ],
  exports: [ConsultationsService, TypeOrmModule],
})
export class ConsultationsModule {}
