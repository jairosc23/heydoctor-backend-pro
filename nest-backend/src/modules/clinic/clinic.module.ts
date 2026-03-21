import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Clinic,
  ClinicUser,
  Doctor,
  Patient,
  Consultation,
  ClinicalRecord,
} from '../../entities';
import { ClinicService } from './clinic.service';
import { ClinicController, AppointmentsController } from './clinic.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Clinic,
      ClinicUser,
      Doctor,
      Patient,
      Consultation,
      ClinicalRecord,
    ]),
  ],
  controllers: [ClinicController, AppointmentsController],
  providers: [ClinicService],
  exports: [ClinicService],
})
export class ClinicModule {}
