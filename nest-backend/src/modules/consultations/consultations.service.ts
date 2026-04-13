import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Consultation } from './consultation.entity';

@Injectable()
export class ConsultationsService {
  constructor(
    @InjectRepository(Consultation)
    private readonly repo: Repository<Consultation>,
  ) {}

  async findAll(clinicId: string, query: any) {
    const qb = this.repo
      .createQueryBuilder('c')
      .innerJoin('c.clinic', 'clinic')
      .leftJoinAndSelect('c.patient', 'patient')
      .where('clinic.id = :clinicId', { clinicId });

    // ✅ filtros seguros
    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    if (query.doctorId) {
      qb.andWhere('c.doctorId = :doctorId', {
        doctorId: query.doctorId,
      });
    }

    if (query.from && query.to) {
      const from = new Date(query.from);
      const to = new Date(query.to);

      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);

        qb.andWhere('c.createdAt BETWEEN :from AND :to', {
          from,
          to,
        });
      }
    }

    if (query.q) {
      const q = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
      qb.andWhere(
        '(patient.firstName ILIKE :q OR patient.lastName ILIKE :q)',
        { q },
      );
    }

    qb.orderBy('c.createdAt', 'DESC');

    // ✅ CLAVE: evitar getCount separado
    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
    };
  }
}
