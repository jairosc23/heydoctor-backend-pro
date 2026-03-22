import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription, Medication } from '../../entities';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionFiltersDto } from './dto/prescription-filters.dto';
import {
  requireClinicId,
  clampListPagination,
} from '../../common/utils/clinic-scope.util';
import { AuthorizationService } from '../../common/services/authorization.service';
import type { AuthActor } from '../../common/interfaces/auth-actor.interface';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(Medication)
    private readonly medicationRepo: Repository<Medication>,
    private readonly authz: AuthorizationService,
  ) {}

  async findAll(
    clinicId: string | undefined | null,
    filters: PrescriptionFiltersDto | undefined,
    actor: AuthActor,
  ): Promise<{ data: Prescription[]; total: number }> {
    const cid = requireClinicId(clinicId);
    const doctor = await this.authz.resolveDoctorForUser(actor.userId, cid);
    const qb = this.prescriptionRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.patient', 'patient')
      .leftJoinAndSelect('p.doctor', 'doctor')
      .leftJoinAndSelect('p.clinic', 'clinic')
      .leftJoinAndSelect('p.consultation', 'consultation')
      .leftJoinAndSelect('p.diagnosis', 'diagnosis')
      .where('p.clinicId = :clinicId', { clinicId: cid })
      .andWhere('p.doctorId = :doctorId', { doctorId: doctor.id });

    if (filters?.patientId) {
      await this.authz.assertPatientInClinic(filters.patientId, cid);
      qb.andWhere('p.patientId = :patientId', {
        patientId: filters.patientId,
      });
    }
    if (filters?.consultationId) {
      qb.andWhere('p.consultationId = :consultationId', {
        consultationId: filters.consultationId,
      });
    }
    if (filters?.diagnosisId) {
      qb.andWhere('p.diagnosisId = :diagnosisId', {
        diagnosisId: filters.diagnosisId,
      });
    }

    const { limit, offset } = clampListPagination(
      filters?.limit,
      filters?.offset,
    );

    const [items, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { data: items, total };
  }

  async findOne(
    id: string,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: Prescription }> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id },
      relations: [
        'patient',
        'doctor',
        'clinic',
        'consultation',
        'diagnosis',
      ],
    });
    if (!prescription) {
      throw new NotFoundException(`Prescription with id ${id} not found`);
    }
    await this.authz.assertOwnership(
      { type: 'prescription', entity: prescription },
      actor,
    );
    return { data: prescription };
  }

  async create(dto: CreatePrescriptionDto, actor: AuthActor) {
    const cid = requireClinicId(actor.clinicId);
    const doctor = await this.authz.resolveDoctorForUser(actor.userId, cid);
    await this.authz.assertPatientInClinic(dto.patientId, cid);

    const prescription = this.prescriptionRepo.create({
      clinicId: cid,
      doctorId: doctor.id,
      patientId: dto.patientId,
      consultationId: dto.consultationId ?? null,
      diagnosisId: dto.diagnosisId ?? null,
      medications: dto.medications ?? [],
      dosage: dto.dosage ?? null,
      instructions: dto.instructions ?? null,
      notes: dto.notes ?? null,
    });
    const saved = await this.prescriptionRepo.save(prescription);
    return { data: saved };
  }

  async update(
    id: string,
    dto: UpdatePrescriptionDto,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: Prescription }> {
    const cid = requireClinicId(clinicId);
    const prescription = await this.prescriptionRepo.findOne({ where: { id } });
    if (!prescription) {
      throw new NotFoundException(`Prescription with id ${id} not found`);
    }
    await this.authz.assertOwnership(
      { type: 'prescription', entity: prescription },
      actor,
    );

    if (dto.patientId) {
      await this.authz.assertPatientInClinic(dto.patientId, cid);
    }
    if (dto.doctorId) {
      throw new BadRequestException('Cannot reassign prescribing doctor via API');
    }

    Object.assign(prescription, dto);
    prescription.clinicId = cid;
    const saved = await this.prescriptionRepo.save(prescription);
    return { data: saved };
  }

  async remove(
    id: string,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: Prescription }> {
    const prescription = await this.prescriptionRepo.findOne({ where: { id } });
    if (!prescription) {
      throw new NotFoundException(`Prescription with id ${id} not found`);
    }
    await this.authz.assertOwnership(
      { type: 'prescription', entity: prescription },
      actor,
    );
    await this.prescriptionRepo.remove(prescription);
    return { data: prescription };
  }

  async getByPatient(
    patientId: string,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ) {
    const cid = requireClinicId(clinicId);
    await this.authz.resolveDoctorForUser(actor.userId, cid);
    await this.authz.assertPatientInClinic(patientId, cid);

    const prescriptions = await this.prescriptionRepo.find({
      where: { patientId, clinicId: cid },
      relations: ['consultation', 'diagnosis'],
      order: { createdAt: 'DESC' },
    });
    return { data: prescriptions };
  }

  async suggestMedications(query: string, actor: AuthActor) {
    await this.authz.resolveDoctorForUser(actor.userId, actor.clinicId);
    if (!query || query.length < 2) {
      const meds = await this.medicationRepo.find({ take: 15 });
      return { data: meds.map((m) => m.name) };
    }

    const medications = await this.medicationRepo
      .createQueryBuilder('m')
      .where('m.name ILIKE :q OR m.genericName ILIKE :q', {
        q: `%${query}%`,
      })
      .take(20)
      .getMany();

    return { data: medications.map((m) => m.name) };
  }
}
