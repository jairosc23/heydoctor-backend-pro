import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clinic } from './clinic.entity';
import { ClinicService } from './clinic.service';

@Module({
  imports: [TypeOrmModule.forFeature([Clinic])],
  providers: [ClinicService],
  exports: [ClinicService, TypeOrmModule],
})
export class ClinicModule {}
