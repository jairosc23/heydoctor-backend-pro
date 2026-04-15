import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import {
  TYPEORM_READ_CONNECTION,
  isTypeormReadReplicaConfigured,
} from '../common/database/typeorm-read-replica';
import { Patient } from './patient.entity';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

const readPatientFeature = isTypeormReadReplicaConfigured()
  ? [TypeOrmModule.forFeature([Patient], TYPEORM_READ_CONNECTION)]
  : [];

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient]),
    ...readPatientFeature,
    AuthModule,
    AuthorizationModule,
    AuditModule,
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService, TypeOrmModule],
})
export class PatientsModule {}
