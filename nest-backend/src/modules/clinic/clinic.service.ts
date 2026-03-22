import { Injectable, NotFoundException } from '@nestjs/common';
import {
  requireClinicId,
  clampListPagination,
} from '../../common/utils/clinic-scope.util';
import { AuthorizationService } from '../../common/services/authorization.service';
import type { AuthActor } from '../../common/interfaces/auth-actor.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Clinic,
  Doctor,
  Patient,
  Consultation,
  ClinicalRecord,
  ClinicUser,
} from '../../entities';
import { PatientFiltersDto } from './dto/patient-filters.dto';
import { AppointmentFiltersDto } from './dto/appointment-filters.dto';

@Injectable()
export class ClinicService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(ClinicUser)
    private readonly clinicUserRepo: Repository<ClinicUser>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Consultation)
    private readonly consultationRepo: Repository<Consultation>,
    @InjectRepository(ClinicalRecord)
    private readonly clinicalRecordRepo: Repository<ClinicalRecord>,
    private readonly authz: AuthorizationService,
  ) {}

  async getClinicForUser(userId: string) {
    const clinicUser = await this.clinicUserRepo.findOne({
      where: { userId },
      relations: ['clinic'],
    });
    if (!clinicUser?.clinic) {
      throw new NotFoundException('Clinic not found for user');
    }
    return clinicUser.clinic;
  }

  async getClinicAndDoctorForUser(userId: string) {
    const clinic = await this.getClinicForUser(userId);
    const doctor = await this.doctorRepo.findOne({
      where: { userId, clinicId: clinic.id },
      relations: ['user'],
    });
    return { clinic, doctor };
  }

  async getPatients(clinicId: string, filters: PatientFiltersDto) {
    const cid = requireClinicId(clinicId);
    const { limit, offset } = clampListPagination(
      filters.limit,
      filters.offset,
    );

    const qb = this.patientRepo
      .createQueryBuilder('p')
      .where('p.clinicId = :clinicId', { clinicId: cid });

    if (filters.search) {
      qb.andWhere(
        '(p.firstname ILIKE :search OR p.lastname ILIKE :search OR p.identification ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const [items, total] = await qb
      .orderBy('p.lastname', 'ASC')
      .addOrderBy('p.firstname', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { data: items, total };
  }

  async getAppointments(
    clinicId: string | undefined | null,
    filters: AppointmentFiltersDto,
    actor: AuthActor,
  ) {
    const cid = requireClinicId(clinicId);
    const doctor = await this.authz.resolveDoctorForUser(actor.userId, cid);

    const qb = this.consultationRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'patient')
      .leftJoinAndSelect('a.doctor', 'doctor')
      .leftJoinAndSelect('doctor.user', 'user')
      .where('a.clinicId = :clinicId', { clinicId: cid })
      .andWhere('a.doctorId = :doctorId', { doctorId: doctor.id });

    if (filters.patientId) {
      await this.authz.assertPatientInClinic(filters.patientId, cid);
      qb.andWhere('a.patientId = :patientId', { patientId: filters.patientId });
    }
    if (filters.status) {
      qb.andWhere('a.status = :status', { status: filters.status });
    }
    if (filters.from) {
      qb.andWhere('a.date >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('a.date <= :to', { to: filters.to });
    }

    const { limit, offset } = clampListPagination(
      filters.limit,
      filters.offset,
    );

    const [items, total] = await qb
      .orderBy('a.date', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { data: items, total };
  }

  async getPatientMedicalRecord(
    patientId: string,
    clinicId: string | undefined | null,
  ) {
    const cid = requireClinicId(clinicId);
    const patient = await this.patientRepo.findOne({
      where: { id: patientId, clinicId: cid },
      relations: ['clinical_record', 'clinical_record.diagnostics', 'clinical_record.treatments', 'clinical_record.doctor', 'clinical_record.doctor.user'],
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const records = await this.clinicalRecordRepo.find({
      where: { patientId, clinicId: cid },
      relations: ['diagnostics', 'treatments', 'doctor', 'doctor.user'],
      order: { consultationDate: 'DESC' },
    });

    return {
      data: {
        patient,
        clinicalRecords: records,
      },
    };
  }
}
