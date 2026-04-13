import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consultation, Patient } from '../../entities';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';
import { ConsultationFiltersDto } from './dto/consultation-filters.dto';
import {
  requireClinicId,
  clampListPagination,
} from '../../common/utils/clinic-scope.util';
import { AuthorizationService } from '../../common/services/authorization.service';
import type { AuthActor } from '../../common/interfaces/auth-actor.interface';

@Injectable()
export class ConsultationsService {
  constructor(
    @InjectRepository(Consultation)
    private readonly consultationRepo: Repository<Consultation>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    private readonly authz: AuthorizationService,
  ) {}

  async findAll(
    clinicId: string | undefined | null,
    filters: ConsultationFiltersDto | undefined,
    actor: AuthActor,
  ): Promise<{ data: Consultation[]; total: number }> {
    const cid = requireClinicId(clinicId);
    const doctor = await this.authz.resolveDoctorForUser(actor.userId, cid);

    const qb = this.consultationRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.patient', 'patient')
      .leftJoinAndSelect('c.doctor', 'doctor')
      .leftJoinAndSelect('c.clinic', 'clinic')
      .leftJoinAndSelect('c.clinical_record', 'clinical_record')
      .leftJoinAndSelect('c.diagnostic', 'diagnostic')
      // ✅ FIX RELACIONES (NO usar c.clinicId)
      .where('clinic.id = :clinicId', { clinicId: cid })
      .andWhere('doctor.id = :doctorId', { doctorId: doctor.id });

    // ✅ FILTROS SEGUROS

    if (filters?.patientId) {
      qb.andWhere('patient.id = :patientId', {
        patientId: filters.patientId,
      });
    }

    if (filters?.status) {
      qb.andWhere('LOWER(c.status) = LOWER(:status)', {
        status: filters.status,
      });
    }

    if (filters?.from) {
      qb.andWhere('c.date >= :from', {
        from: new Date(filters.from),
      });
    }

    if (filters?.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);

      qb.andWhere('c.date <= :to', {
        to: end,
      });
    }

    const { limit, offset } = clampListPagination(
      filters?.limit,
      filters?.offset,
    );

    const [items, total] = await qb
      .orderBy('c.date', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { data: items, total };
  }

  async findOne(
    id: string,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: Consultation }> {
    const cid = requireClinicId(clinicId);

    const consultation = await this.consultationRepo.findOne({
      where: { id },
      relations: [
        'patient',
        'doctor',
        'clinic',
        'clinical_record',
        'diagnostic',
        'diagnostic.cie_10_code',
        'lab_orders',
        'lab_orders.diagnosis',
        'prescriptions',
        'prescriptions.diagnosis',
      ],
    });

    if (!consultation) {
      throw new NotFoundException(`Consultation with id ${id} not found`);
    }

    await this.authz.assertOwnership(
      { type: 'consultation', entity: consultation },
      actor,
    );

    return { data: consultation };
  }

  async create(
    dto: CreateConsultationDto,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: Consultation }> {
    const cid = requireClinicId(clinicId);
    const doctor = await this.authz.resolveDoctorForUser(actor.userId, cid);

    await this.authz.assertPatientInClinic(dto.patientId, cid);

    const consultation = this.consultationRepo.create({
      patientId: dto.patientId,
      doctorId: doctor.id,
      clinicId: cid,
      clinicalRecordId: dto.clinicalRecordId ?? null,
      date: new Date(dto.date),
      duration: dto.duration ?? 45,
      status: dto.status ?? 'scheduled',
      confirmed: dto.confirmed ?? false,
      appointment_reason: dto.appointment_reason ?? null,
      notes: dto.notes ?? null,
      files: dto.files ?? null,
      active: dto.active ?? true,
    });

    const saved = await this.consultationRepo.save(consultation);

    return { data: saved };
  }

  async update(
    id: string,
    dto: UpdateConsultationDto,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: Consultation }> {
    const cid = requireClinicId(clinicId);

    const consultation = await this.consultationRepo.findOne({ where: { id } });

    if (!consultation) {
      throw new NotFoundException(`Consultation with id ${id} not found`);
    }

    await this.authz.assertOwnership(
      { type: 'consultation', entity: consultation },
      actor,
    );

    if (consultation.status === 'locked') {
      throw new ForbiddenException(
        'Consultation is locked and cannot be modified',
      );
    }

    if (dto.patientId) {
      await this.authz.assertPatientInClinic(dto.patientId, cid);
    }

    Object.assign(consultation, dto);
    consultation.clinicId = cid;

    if (dto.date) {
      consultation.date = new Date(dto.date);
    }

    const saved = await this.consultationRepo.save(consultation);

    return { data: saved };
  }

  async remove(
    id: string,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: Consultation }> {
    const cid = requireClinicId(clinicId);

    const consultation = await this.consultationRepo.findOne({ where: { id } });

    if (!consultation) {
      throw new NotFoundException(`Consultation with id ${id} not found`);
    }

    await this.authz.assertOwnership(
      { type: 'consultation', entity: consultation },
      actor,
    );

    if (consultation.status === 'locked') {
      throw new ForbiddenException(
        'Consultation is locked and cannot be deleted',
      );
    }

    await this.consultationRepo.remove(consultation);

    return { data: consultation };
  }
}
