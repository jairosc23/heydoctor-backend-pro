import { Body, Controller, Post } from '@nestjs/common';
import { RegisterDoctorDto } from './dto/register-doctor.dto';
import { DoctorsRegistrationService } from './doctors-registration.service';

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly registration: DoctorsRegistrationService) {}

  /** Self-serve onboarding (no auth): creates clinic, doctor user, and public profile shell. */
  @Post('register')
  register(@Body() dto: RegisterDoctorDto) {
    return this.registration.register(dto);
  }
}
