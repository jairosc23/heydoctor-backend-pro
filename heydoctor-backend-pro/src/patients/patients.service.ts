import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  type LoggerService,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import type { PatientsListQueryDto } from './dto/patients-list-query.dto';
import type { PaginatedResult } from '../common/types/paginated-result.type';
import { APP_LOGGER } from '../common/logger/logger.tokens';
import { maskUuid } from '../common/observability/log-masking.util';
import { CreatePatientDto } from './dto/create-patient.dto';
import { Patient } from './patient.entity';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientsRepository: Repository<Patient>,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
    @Inject(APP_LOGGER)
    private readonly logger: LoggerService,
  ) {}

  async findAll(
    authUser: AuthenticatedUser,
    query?: PatientsListQueryDto,
  ): Promise<PaginatedResult<Patient>> {
    const { clinicId } =
      await this.authorizationService.getUserWithClinic(authUser);

    /** Propiedades de entidad (TypeORM → columnas snake_case del mapping). */
    const qb = this.patientsRepository
      .createQueryBuilder('p')
      .where('p.clinicId = :clinicId', { clinicId })
      .orderBy('p.createdAt', 'DESC');

    const rawSearch = query?.search;
    const search = typeof rawSearch === 'string' ? rawSearch.trim() : '';
    if (search !== '') {
      const escaped = search
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      qb.andWhere(
        '(COALESCE(p.name, \'\') ILIKE :s OR COALESCE(p.email, \'\') ILIKE :s)',
        { s: `%${escaped}%` },
      );
    }

    const paginate =
      query !== undefined &&
      (query.page !== undefined ||
        query.limit !== undefined ||
        query.offset !== undefined);

    const limit = paginate ? Math.min(query!.limit ?? 20, 100) : undefined;
    const page = paginate ? (query!.page ?? 1) : 1;
    const offset = paginate ? query!.offset : undefined;
    const skip =
      paginate && offset !== undefined && offset >= 0
        ? offset
        : paginate && limit !== undefined
          ? (page - 1) * limit
          : undefined;

    const runQuery = async (): Promise<[Patient[], number]> => {
      const total = await qb.clone().getCount();
      if (total === 0) {
        return [[], 0];
      }
      const dataQb = qb.clone();
      if (paginate && skip !== undefined && limit !== undefined) {
        dataQb.skip(skip).take(limit);
      }
      const data = await dataQb.getMany();
      return [data, total];
    };

    try {
      const [data, total] = await runQuery();

      if (!paginate) {
        return { data, total, page: 1, limit: total };
      }

      const resolvedPage =
        offset !== undefined && limit !== undefined && limit > 0
          ? Math.floor(offset / limit) + 1
          : page;

      return { data, total, page: resolvedPage, limit: limit ?? 20 };
    } catch (error) {
      console.error('QUERY FAILED:', error);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        JSON.stringify({
          msg: 'query_failed',
          context: paginate ? 'patients.findAll.paginated' : 'patients.findAll',
          error: message,
        }),
      );
      throw new InternalServerErrorException('Query failed');
    }
  }

  async findOne(id: string, authUser: AuthenticatedUser): Promise<Patient> {
    return this.authorizationService.assertPatientInClinic(authUser, id);
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
      this.logger.warn('Business rule violation', {
        reason: 'patient email already exists in clinic',
        clinicId: maskUuid(clinicId),
        patientId: maskUuid(existing.id),
      });
      throw new ConflictException('A patient with this email already exists');
    }

    const entity = this.patientsRepository.create({
      name: dto.name.trim(),
      email,
      clinic: { id: clinicId },
    });
    const saved = await this.patientsRepository.save(entity);

    void this.auditService.logSuccess({
      userId: authUser.sub,
      action: 'PATIENT_CREATED',
      resource: 'patient',
      resourceId: saved.id,
      clinicId,
      httpStatus: 201,
      metadata: { email: saved.email },
    });

    this.logger.log('Patient created', {
      patientId: maskUuid(saved.id),
      clinicId: maskUuid(clinicId),
      actorUserId: maskUuid(authUser.sub),
    });

    return saved;
  }
}
