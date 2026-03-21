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

@Injectable()
export class DiagnosisService {
  constructor(
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(Consultation)
    private readonly consultationRepo: Repository<Consultation>,
  ) {}

  async findAll(filters?: DiagnosisFiltersDto) {
    const qb = this.diagnosisRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.consultation', 'consultation')
      .leftJoinAndSelect('d.cie_10_code', 'cie_10_code')
      .leftJoinAndSelect('d.clinical_record', 'clinical_record');

    if (filters?.consultationId) {
      qb.andWhere('d.consultationId = :consultationId', {
        consultationId: filters.consultationId,
      });
    }
    if (filters?.clinicId) {
      qb.andWhere('d.clinicId = :clinicId', { clinicId: filters.clinicId });
    }
    if (filters?.patientId) {
      qb.andWhere('d.patientId = :patientId', { patientId: filters.patientId });
    }
    if (filters?.doctorId) {
      qb.andWhere('d.doctorId = :doctorId', { doctorId: filters.doctorId });
    }

    const [items, total] = await qb
      .orderBy('d.diagnostic_date', 'DESC')
      .skip(filters?.offset ?? 0)
      .take(filters?.limit ?? 20)
      .getManyAndCount();

    return { data: items, total };
  }

  async findOne(id: string) {
    const diagnosis = await this.diagnosisRepo.findOne({
      where: { id },
      relations: ['consultation', 'cie_10_code', 'clinical_record'],
    });
    if (!diagnosis) {
      throw new NotFoundException(`Diagnosis with id ${id} not found`);
    }
    return { data: diagnosis };
  }

  async create(dto: CreateDiagnosisDto) {
    const consultation = await this.consultationRepo.findOne({
      where: { id: dto.consultationId },
    });
    if (!consultation) {
      throw new BadRequestException(
        `Consultation ${dto.consultationId} not found`,
      );
    }

    const existing = await this.diagnosisRepo.findOne({
      where: { consultationId: dto.consultationId },
    });
    if (existing) {
      throw new BadRequestException(
        `Consultation ${dto.consultationId} already has a diagnosis`,
      );
    }

    const diagnosis = this.diagnosisRepo.create({
      consultationId: dto.consultationId,
      clinicalRecordId: dto.clinicalRecordId ?? consultation.clinicalRecordId,
      doctorId: dto.doctorId ?? consultation.doctorId,
      patientId: dto.patientId ?? consultation.patientId,
      clinicId: dto.clinicId ?? consultation.clinicId,
      cie10CodeId: dto.cie10CodeId,
      diagnosis_details: dto.diagnosis_details,
      diagnostic_date: dto.diagnostic_date
        ? new Date(dto.diagnostic_date)
        : new Date(),
    });
    const saved = await this.diagnosisRepo.save(diagnosis);
    return { data: saved };
  }

  async update(id: string, dto: UpdateDiagnosisDto) {
    const diagnosis = await this.diagnosisRepo.findOne({ where: { id } });
    if (!diagnosis) {
      throw new NotFoundException(`Diagnosis with id ${id} not found`);
    }
    Object.assign(diagnosis, dto);
    if (dto.diagnostic_date) {
      diagnosis.diagnostic_date = new Date(dto.diagnostic_date);
    }
    const saved = await this.diagnosisRepo.save(diagnosis);
    return { data: saved };
  }

  async remove(id: string) {
    const diagnosis = await this.diagnosisRepo.findOne({ where: { id } });
    if (!diagnosis) {
      throw new NotFoundException(`Diagnosis with id ${id} not found`);
    }
    await this.diagnosisRepo.remove(diagnosis);
    return { data: diagnosis };
  }
}
