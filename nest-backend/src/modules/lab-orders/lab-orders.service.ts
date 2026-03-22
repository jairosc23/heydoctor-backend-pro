import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabOrder } from '../../entities';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { LabOrderFiltersDto } from './dto/lab-order-filters.dto';
import {
  requireClinicId,
  clampListPagination,
} from '../../common/utils/clinic-scope.util';
import { AuthorizationService } from '../../common/services/authorization.service';
import type { AuthActor } from '../../common/interfaces/auth-actor.interface';

@Injectable()
export class LabOrdersService {
  constructor(
    @InjectRepository(LabOrder)
    private readonly labOrderRepo: Repository<LabOrder>,
    private readonly authz: AuthorizationService,
  ) {}

  async findAll(
    clinicId: string | undefined | null,
    filters: LabOrderFiltersDto | undefined,
    actor: AuthActor,
  ): Promise<{ data: LabOrder[]; total: number }> {
    const cid = requireClinicId(clinicId);
    const doctor = await this.authz.resolveDoctorForUser(actor.userId, cid);
    const qb = this.labOrderRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.patient', 'patient')
      .leftJoinAndSelect('l.doctor', 'doctor')
      .leftJoinAndSelect('l.clinic', 'clinic')
      .leftJoinAndSelect('l.consultation', 'consultation')
      .leftJoinAndSelect('l.diagnosis', 'diagnosis')
      .where('l.clinicId = :clinicId', { clinicId: cid })
      .andWhere('l.doctorId = :doctorId', { doctorId: doctor.id });

    if (filters?.patientId) {
      await this.authz.assertPatientInClinic(filters.patientId, cid);
      qb.andWhere('l.patientId = :patientId', {
        patientId: filters.patientId,
      });
    }
    if (filters?.consultationId) {
      qb.andWhere('l.consultationId = :consultationId', {
        consultationId: filters.consultationId,
      });
    }
    if (filters?.diagnosisId) {
      qb.andWhere('l.diagnosisId = :diagnosisId', {
        diagnosisId: filters.diagnosisId,
      });
    }

    const { limit, offset } = clampListPagination(
      filters?.limit,
      filters?.offset,
    );

    const [items, total] = await qb
      .orderBy('l.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { data: items, total };
  }

  async findOne(
    id: string,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: LabOrder }> {
    const order = await this.labOrderRepo.findOne({
      where: { id },
      relations: [
        'patient',
        'doctor',
        'clinic',
        'consultation',
        'diagnosis',
      ],
    });
    if (!order) {
      throw new NotFoundException(`Lab order with id ${id} not found`);
    }
    await this.authz.assertOwnership(
      { type: 'lab_order', entity: order },
      actor,
    );
    return { data: order };
  }

  async create(dto: CreateLabOrderDto, actor: AuthActor) {
    const cid = requireClinicId(actor.clinicId);
    const doctor = await this.authz.resolveDoctorForUser(actor.userId, cid);
    await this.authz.assertPatientInClinic(dto.patientId, cid);

    const order = this.labOrderRepo.create({
      clinicId: cid,
      doctorId: doctor.id,
      patientId: dto.patientId,
      consultationId: dto.consultationId ?? null,
      diagnosisId: dto.diagnosisId ?? null,
      lab_tests: dto.lab_tests ?? [],
      status: (dto.status ?? 'pending') as LabOrder['status'],
      priority: (dto.priority ?? 'routine') as LabOrder['priority'],
      diagnosis_code: dto.diagnosis_code ?? null,
      notes: dto.notes ?? null,
    });
    const saved = await this.labOrderRepo.save(order);
    return { data: saved };
  }

  async update(
    id: string,
    dto: UpdateLabOrderDto,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: LabOrder }> {
    const cid = requireClinicId(clinicId);
    const order = await this.labOrderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Lab order with id ${id} not found`);
    }
    await this.authz.assertOwnership(
      { type: 'lab_order', entity: order },
      actor,
    );

    if (dto.patientId) {
      await this.authz.assertPatientInClinic(dto.patientId, cid);
    }
    if (dto.doctorId) {
      throw new BadRequestException('Cannot reassign ordering doctor via API');
    }

    Object.assign(order, dto);
    order.clinicId = cid;
    const saved = await this.labOrderRepo.save(order);
    return { data: saved };
  }

  async remove(
    id: string,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: LabOrder }> {
    const order = await this.labOrderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Lab order with id ${id} not found`);
    }
    await this.authz.assertOwnership(
      { type: 'lab_order', entity: order },
      actor,
    );
    await this.labOrderRepo.remove(order);
    return { data: order };
  }

  async getByPatient(
    patientId: string,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ) {
    const cid = requireClinicId(clinicId);
    await this.authz.resolveDoctorForUser(actor.userId, cid);
    await this.authz.assertPatientInClinic(patientId, cid);

    const orders = await this.labOrderRepo.find({
      where: { patientId, clinicId: cid },
      relations: ['consultation', 'diagnosis'],
      order: { createdAt: 'DESC' },
    });
    return { data: orders };
  }

  async suggestTests(query: string, actor: AuthActor) {
    await this.authz.resolveDoctorForUser(actor.userId, actor.clinicId);
    const commonTests = [
      'Hemograma completo',
      'Glucosa en ayunas',
      'Perfil lipídico',
      'Creatinina',
      'Urea',
      'TSH',
      'T4 libre',
      'PCR',
      'Ferritina',
      'Vitamina D',
      'HbA1c',
      'Orina completa',
      'Coprocultivo',
    ];

    if (!query || query.length < 2) {
      return { data: commonTests.slice(0, 10) };
    }

    const q = query.toLowerCase();
    const filtered = commonTests.filter((t) => t.toLowerCase().includes(q));
    return { data: filtered.length > 0 ? filtered : commonTests.slice(0, 5) };
  }
}
