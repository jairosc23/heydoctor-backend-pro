import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { TelemedicineConsent } from '../consents/consent.entity';
import { Consultation } from '../consultations/consultation.entity';
import { Patient } from '../patients/patient.entity';
import { User } from '../users/user.entity';
import { GdprController } from './gdpr.controller';
import { GdprDeletionRequest } from './gdpr-deletion-request.entity';
import { GdprService } from './gdpr.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Patient,
      Consultation,
      TelemedicineConsent,
      RefreshToken,
      GdprDeletionRequest,
    ]),
    AuthModule,
    AuditModule,
  ],
  controllers: [GdprController],
  providers: [GdprService],
})
export class GdprModule {}
