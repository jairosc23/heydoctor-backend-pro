import { Module } from '@nestjs/common';
import { DoctorProfilesModule } from '../doctor-profiles/doctor-profiles.module';
import { UsersModule } from '../users/users.module';
import { DoctorsController } from './doctors.controller';
import { DoctorsRegistrationService } from './doctors-registration.service';

@Module({
  imports: [UsersModule, DoctorProfilesModule],
  controllers: [DoctorsController],
  providers: [DoctorsRegistrationService],
})
export class DoctorsModule {}
