import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuthorizationService } from '../authorization/authorization.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { Patient } from './patient.entity';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientsRepository: Repository<Patient>,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async findAll(authUser: AuthenticatedUser): Promise<Patient[]> {
    const { clinicId } =
      await this.authorizationService.getUserWithClinic(authUser);
    return this.patientsRepository.find({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    dto: CreatePatientDto,
    authUser: AuthenticatedUser,
  ): Promise<Patient> {
    const { clinicId } =
      await this.authorizationService.getUserWithClinic(authUser);
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
