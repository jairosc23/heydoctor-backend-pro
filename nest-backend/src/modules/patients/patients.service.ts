import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../entities';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientFiltersDto } from '../clinic/dto/patient-filters.dto';
import {
  requireClinicId,
  clampListPagination,
} from '../../common/utils/clinic-scope.util';
import { AuthorizationService } from '../../common/services/authorization.service';
import type { AuthActor } from '../../common/interfaces/auth-actor.interface';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    private readonly authz: AuthorizationService,
  ) {}

  async findAll(
    clinicId: string | undefined | null,
    filters: PatientFiltersDto | undefined,
    actor: AuthActor,
  ): Promise<{ data: Patient[]; total?: number }> {
    const cid = requireClinicId(clinicId);
    await this.authz.resolveDoctorForUser(actor.userId, cid);
    const qb = this.patientRepo
      .createQueryBuilder('p')
      .where('p.clinicId = :clinicId', { clinicId: cid });
    if (filters?.search) {
      qb.andWhere(
        '(p.firstname ILIKE :search OR p.lastname ILIKE :search OR p.identification ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }
    const { limit, offset } = clampListPagination(
      filters?.limit,
      filters?.offset,
    );

    const [items, total] = await qb
      .orderBy('p.lastname', 'ASC')
      .addOrderBy('p.firstname', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return { data: items, total };
  }

  async findOne(
    id: string,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: Patient }> {
    await this.authz.assertOwnership(
      { type: 'patient', patientId: id },
      actor,
    );
    const full = await this.patientRepo.findOne({
      where: { id },
      relations: ['clinic', 'user'],
    });
    if (!full) {
      throw new NotFoundException(`Patient with id ${id} not found`);
    }
    return { data: full };
  }

  async create(
    dto: CreatePatientDto,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: Patient }> {
    const cid = requireClinicId(clinicId);
    await this.authz.resolveDoctorForUser(actor.userId, cid);
    const existing = await this.patientRepo.findOne({
      where: { identification: dto.identification, clinicId: cid },
    });
    if (existing) {
      throw new ConflictException(
        `Patient with identification ${dto.identification} already exists`,
      );
    }
    const patient = this.patientRepo.create({
      ...dto,
      clinicId: cid,
      birth_date: new Date(dto.birth_date),
    });
    const saved = await this.patientRepo.save(patient);
    return { data: saved };
  }

  async update(
    id: string,
    dto: UpdatePatientDto,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: Patient }> {
    const cid = requireClinicId(clinicId);
    await this.authz.assertOwnership({ type: 'patient', patientId: id }, actor);
    const patient = await this.patientRepo.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Patient with id ${id} not found`);
    }
    if (dto.identification && dto.identification !== patient.identification) {
      const existing = await this.patientRepo.findOne({
        where: { identification: dto.identification, clinicId: cid },
      });
      if (existing) {
        throw new ConflictException(
          `Patient with identification ${dto.identification} already exists`,
        );
      }
    }
    Object.assign(patient, dto);
    if (dto.birth_date) {
      patient.birth_date = new Date(dto.birth_date);
    }
    patient.clinicId = cid;
    const saved = await this.patientRepo.save(patient);
    return { data: saved };
  }

  async remove(
    id: string,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: Patient }> {
    const cid = requireClinicId(clinicId);
    await this.authz.assertOwnership({ type: 'patient', patientId: id }, actor);
    const patient = await this.patientRepo.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Patient with id ${id} not found`);
    }
    await this.patientRepo.remove(patient);
    return { data: patient };
  }
}
