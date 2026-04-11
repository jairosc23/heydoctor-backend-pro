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

    /** Columnas DB reales (quoted): @RelationId no es columna mapeada en QueryBuilder. */
    const qb = this.patientsRepository
      .createQueryBuilder('p')
      .where('"p"."clinic_id" = :clinicId', { clinicId })
      .orderBy('"p"."created_at"', 'DESC');

    const search = query?.search?.trim();
    if (search) {
      const escaped = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      qb.andWhere('("p"."name" ILIKE :s OR "p"."email" ILIKE :s)', {
        s: `%${escaped}%`,
      });
    }

    const paginate =
      query !== undefined &&
      (query.page !== undefined ||
        query.limit !== undefined ||
        query.offset !== undefined);

    if (!paginate) {
      let data: Patient[];
      let total: number;
      try {
        [data, total] = await qb.getManyAndCount();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          JSON.stringify({
            msg: 'query_failed',
            context: 'patients.findAll',
            error: message,
          }),
        );
        throw new InternalServerErrorException('Query failed');
      }
      return { data, total, page: 1, limit: total };
    }

    const limit = Math.min(query!.limit ?? 20, 100);
    const page = query!.page ?? 1;
    const offset = query!.offset;
    const skip =
      offset !== undefined && offset >= 0 ? offset : (page - 1) * limit;
    qb.skip(skip).take(limit);

    let data: Patient[];
    let total: number;
    try {
      [data, total] = await qb.getManyAndCount();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        JSON.stringify({
          msg: 'query_failed',
          context: 'patients.findAll.paginated',
          error: message,
        }),
      );
      throw new InternalServerErrorException('Query failed');
    }
    const resolvedPage =
      offset !== undefined && limit > 0
        ? Math.floor(offset / limit) + 1
        : page;

    return { data, total, page: resolvedPage, limit };
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
