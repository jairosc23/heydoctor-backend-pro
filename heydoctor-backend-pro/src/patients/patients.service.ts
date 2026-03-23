import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UsersService } from '../users/users.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { Patient } from './patient.entity';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientsRepository: Repository<Patient>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Resolves the tenant clinic from the authenticated user (DB source of truth).
   * Never trust client-supplied clinic id.
   */
  private async resolveClinicId(authUser: AuthenticatedUser): Promise<string> {
    const user = await this.usersService.findById(authUser.sub);
    if (!user?.clinicId) {
      throw new ForbiddenException('User has no clinic assigned');
    }
    return user.clinicId;
  }

  async findAll(authUser: AuthenticatedUser): Promise<Patient[]> {
    const clinicId = await this.resolveClinicId(authUser);
    return this.patientsRepository.find({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    dto: CreatePatientDto,
    authUser: AuthenticatedUser,
  ): Promise<Patient> {
    const clinicId = await this.resolveClinicId(authUser);
    const email = dto.email.trim().toLowerCase();

    const existing = await this.patientsRepository.findOne({
      where: { clinicId, email },
    });
    if (existing) {
      throw new ConflictException('A patient with this email already exists');
    }

    const entity = this.patientsRepository.create({
      name: dto.name.trim(),
      email,
      clinic: { id: clinicId },
    });
    return this.patientsRepository.save(entity);
  }
}
