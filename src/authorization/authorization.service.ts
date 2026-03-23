import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Patient } from '../patients/patient.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(Patient)
    private readonly patientsRepository: Repository<Patient>,
  ) {}

  /**
   * Ensures the authenticated user (loaded from DB via sub) belongs to `clinicId`.
   * Never trusts JWT for clinic membership.
   */
  async assertUserInClinic(
    authUser: AuthenticatedUser,
    clinicId: string,
  ): Promise<void> {
    const user = await this.usersService.findById(authUser.sub);
    if (!user?.clinicId) {
      throw new ForbiddenException('User has no clinic assigned');
    }
    if (user.clinicId !== clinicId) {
      throw new ForbiddenException('Access denied for this clinic');
    }
  }

  /**
   * Ensures the patient exists and belongs to the same clinic as the authenticated user.
   */
  async assertPatientInClinic(
    authUser: AuthenticatedUser,
    patientId: string,
  ): Promise<Patient> {
    const user = await this.usersService.findById(authUser.sub);
    if (!user?.clinicId) {
      throw new ForbiddenException('User has no clinic assigned');
    }

    const patient = await this.patientsRepository.findOne({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    if (patient.clinicId !== user.clinicId) {
      throw new ForbiddenException('Access denied for this patient');
    }

    await this.assertPatientOwnership(authUser, patient);
    return patient;
  }

  /**
   * Placeholder for future per-resource ownership (e.g. assigned doctor).
   */
  async assertPatientOwnership(
    _authUser: AuthenticatedUser,
    _patient: Patient,
  ): Promise<boolean> {
    return true;
  }
}
