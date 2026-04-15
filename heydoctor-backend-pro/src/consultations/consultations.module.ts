import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ConsentModule } from '../consents/consent.module';
import { LoggerModule } from '../common/logger/logger.module';
import {
  TYPEORM_READ_CONNECTION,
  isTypeormReadReplicaConfigured,
} from '../common/database/typeorm-read-replica';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { Consultation } from './consultation.entity';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsService } from './consultations.service';

const readConsultationFeature = isTypeormReadReplicaConfigured()
  ? [TypeOrmModule.forFeature([Consultation], TYPEORM_READ_CONNECTION)]
  : [];

@Module({
  imports: [
    TypeOrmModule.forFeature([Consultation]),
    ...readConsultationFeature,
    AuthModule,
    AuthorizationModule,
    ConsentModule,
    SubscriptionsModule,
    AuditModule,
    AiModule,
    LoggerModule,
  ],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
  exports: [ConsultationsService, TypeOrmModule],
})
export class ConsultationsModule {}
