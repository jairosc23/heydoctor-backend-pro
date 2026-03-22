import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diagnosis, Consultation } from '../../entities';
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';
import { DiagnosisFiltersDto } from './dto/diagnosis-filters.dto';
import {
  requireClinicId,
  clampListPagination,
} from '../../common/utils/clinic-scope.util';
import { AuthorizationService } from '../../common/services/authorization.service';
import type { AuthActor } from '../../common/interfaces/auth-actor.interface';

@Injectable()
export class DiagnosisService {
  constructor(
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(Consultation)
    private readonly consultationRepo: Repository<Consultation>,
    private readonly authz: AuthorizationService,
  ) {}

  async findAll(
    clinicId: string | undefined | null,
    filters: DiagnosisFiltersDto | undefined,
    actor: AuthActor,
  ) {
    const cid = requireClinicId(clinicId);
    const doctor = await this.authz.resolveDoctorForUser(actor.userId, cid);
    const qb = this.diagnosisRepo
      .createQueryBuilder('d')
      .innerJoinAndSelect('d.consultation', 'consultation')
      .leftJoinAndSelect('d.cie_10_code', 'cie_10_code')
      .leftJoinAndSelect('d.clinical_record', 'clinical_record')
      .where('d.clinicId = :clinicId', { clinicId: cid })
      .andWhere('consultation.doctorId = :doctorId', { doctorId: doctor.id });

    if (filters?.consultationId) {
      qb.andWhere('d.consultationId = :consultationId', {
        consultationId: filters.consultationId,
      });
    }
    if (filters?.patientId) {
      await this.authz.assertPatientInClinic(filters.patientId, cid);
      qb.andWhere('d.patientId = :patientId', { patientId: filters.patientId });
    }

    const { limit, offset } = clampListPagination(
      filters?.limit,
      filters?.offset,
    );

    const [items, total] = await qb
      .orderBy('d.diagnostic_date', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { data: items, total };
  }

  async findOne(
    id: string,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ) {
    const cid = requireClinicId(clinicId);
    const diagnosis = await this.diagnosisRepo.findOne({
      where: { id },
      relations: ['consultation', 'cie_10_code', 'clinical_record'],
    });
    if (!diagnosis) {
      throw new NotFoundException(`Diagnosis with id ${id} not found`);
    }
    await this.authz.assertOwnership({ type: 'diagnosis', entity: diagnosis }, actor);
    return { data: diagnosis };
  }

  async create(
    dto: CreateDiagnosisDto,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ) {
    const cid = requireClinicId(clinicId);
    const consultation = await this.consultationRepo.findOne({
      where: { id: dto.consultationId },
    });
    if (!consultation) {
      throw new BadRequestException(
        `Consultation ${dto.consultationId} not found`,
      );
    }
    await this.authz.assertOwnership(
      { type: 'consultation', entity: consultation },
      actor,
    );

    const existing = await this.diagnosisRepo.findOne({
      where: { consultationId: dto.consultationId },
    });
    if (existing) {
      throw new BadRequestException(
        `Consultation ${dto.consultationId} already has a diagnosis`,
      );
    }

    const doctor = await this.authz.resolveDoctorForUser(actor.userId, cid);
    const diagnosis = this.diagnosisRepo.create({
      consultationId: dto.consultationId,
      clinicalRecordId:
        dto.clinicalRecordId ?? consultation.clinicalRecordId ?? null,
      doctorId: dto.doctorId ?? doctor.id,
      patientId: dto.patientId ?? consultation.patientId,
      clinicId: cid,
      cie10CodeId: dto.cie10CodeId ?? null,
      diagnosis_details: dto.diagnosis_details ?? null,
      diagnostic_date: dto.diagnostic_date
        ? new Date(dto.diagnostic_date)
        : new Date(),
    });
    const saved = await this.diagnosisRepo.save(diagnosis);
    return { data: saved };
  }

  async update(
    id: string,
    dto: UpdateDiagnosisDto,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ) {
    const cid = requireClinicId(clinicId);
    const diagnosis = await this.diagnosisRepo.findOne({ where: { id } });
    if (!diagnosis) {
      throw new NotFoundException(`Diagnosis with id ${id} not found`);
    }
    await this.authz.assertOwnership({ type: 'diagnosis', entity: diagnosis }, actor);

    if (dto.consultationId && dto.consultationId !== diagnosis.consultationId) {
      const consultation = await this.consultationRepo.findOne({
        where: { id: dto.consultationId },
      });
      if (!consultation) {
        throw new BadRequestException(
          `Consultation ${dto.consultationId} not found`,
        );
      }
      await this.authz.assertOwnership(
        { type: 'consultation', entity: consultation },
        actor,
      );
    }

    Object.assign(diagnosis, dto);
    diagnosis.clinicId = cid;
    if (dto.diagnostic_date) {
      diagnosis.diagnostic_date = new Date(dto.diagnostic_date);
    }
    const saved = await this.diagnosisRepo.save(diagnosis);
    return { data: saved };
  }

  async remove(
    id: string,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ) {
    const cid = requireClinicId(clinicId);
    const diagnosis = await this.diagnosisRepo.findOne({ where: { id } });
    if (!diagnosis) {
      throw new NotFoundException(`Diagnosis with id ${id} not found`);
    }
    await this.authz.assertOwnership({ type: 'diagnosis', entity: diagnosis }, actor);
    await this.diagnosisRepo.remove(diagnosis);
    return { data: diagnosis };
  }
}
