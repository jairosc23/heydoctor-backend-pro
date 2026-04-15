import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  type LoggerService,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { QueryFailedError, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  bumpClinicListCacheVersion,
  entityListCacheKey,
  type EntityListCacheEnvelope,
  getClinicListCacheVersion,
  isCacheEnvelope,
  LIST_CACHE_FRESH_MS,
  LIST_CACHE_HARD_TTL_MS,
  entityListCacheHardStoreTtlMs,
  revivePatientsListFromCache,
  scheduleEntityListSwrRefresh,
} from '../common/cache/entity-list-cache.helper';
import { assertValidCursor, encodeListCursor } from '../common/pagination/cursor-pagination.util';
import type { PaginatedResult } from '../common/types/paginated-result.type';
import { APP_LOGGER } from '../common/logger/logger.tokens';
import { maskUuid } from '../common/observability/log-masking.util';
import type { PatientsListQueryDto } from './dto/patients-list-query.dto';
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
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findAll(
    authUser: AuthenticatedUser,
    query?: PatientsListQueryDto,
  ): Promise<PaginatedResult<Patient>> {
    const { clinicId } =
      await this.authorizationService.getUserWithClinic(authUser);

    const runDb = (): Promise<PaginatedResult<Patient>> =>
      this.loadPatientsList(clinicId, query);

    try {
      const ver = await getClinicListCacheVersion(
        this.cache,
        'patients',
        clinicId,
      );
      const cacheKey = entityListCacheKey('pat', clinicId, ver, query ?? {});
      const raw = await this.cache.get<
        EntityListCacheEnvelope<Patient> | PaginatedResult<Patient>
      >(cacheKey);

      if (isCacheEnvelope<Patient>(raw)) {
        const age = Date.now() - raw.storedAt;
        if (age < LIST_CACHE_HARD_TTL_MS) {
          revivePatientsListFromCache(raw.payload);
          if (age >= LIST_CACHE_FRESH_MS) {
            scheduleEntityListSwrRefresh(cacheKey, async () => {
              try {
                const fresh = await runDb();
                await this.cache.set(
                  cacheKey,
                  { storedAt: Date.now(), payload: fresh },
                  entityListCacheHardStoreTtlMs(),
                );
              } catch {
                /* noop */
              }
            });
          }
          return raw.payload;
        }
      } else if (
        raw &&
        typeof raw === 'object' &&
        'data' in raw &&
        Array.isArray((raw as PaginatedResult<Patient>).data)
      ) {
        const legacy = raw as PaginatedResult<Patient>;
        revivePatientsListFromCache(legacy);
        return legacy;
      }
    } catch {
      /* sin caché */
    }

    const result = await runDb();
    try {
      const ver = await getClinicListCacheVersion(
        this.cache,
        'patients',
        clinicId,
      );
      const cacheKey = entityListCacheKey('pat', clinicId, ver, query ?? {});
      await this.cache.set(
        cacheKey,
        { storedAt: Date.now(), payload: result },
        entityListCacheHardStoreTtlMs(),
      );
    } catch {
      /* noop */
    }
    return result;
  }

  private async loadPatientsList(
    clinicId: string,
    query?: PatientsListQueryDto,
  ): Promise<PaginatedResult<Patient>> {
    const qb = this.patientsRepository
      .createQueryBuilder('p')
      .innerJoin('p.clinic', 'clinic')
      .where('clinic.id = :clinicId', { clinicId })
      .orderBy('p.createdAt', 'DESC')
      .addOrderBy('p.id', 'DESC');

    const rawSearch = query?.search;
    const search = typeof rawSearch === 'string' ? rawSearch.trim() : '';
    if (search !== '') {
      const escaped = search
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      qb.andWhere(
        `(COALESCE(p.name, '') ILIKE :q OR COALESCE(p.email, '') ILIKE :q)`,
        { q: `%${escaped}%` },
      );
    }

    const useCursor = Boolean(query?.cursor?.trim());
    const paginate =
      !useCursor &&
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

    try {
      if (useCursor) {
        const c = assertValidCursor(query!.cursor);
        const cAt = new Date(c.t);
        qb.andWhere('(p.createdAt, p.id) < (:cAt, :cId)', {
          cAt,
          cId: c.id,
        });
        const pageSize = Math.min(query!.limit ?? 20, 100);
        qb.take(pageSize + 1);
        const rows = await qb.getMany();
        const hasMore = rows.length > pageSize;
        const data = hasMore ? rows.slice(0, pageSize) : rows;
        const last = data[data.length - 1];
        const nextCursor =
          hasMore && last
            ? encodeListCursor(last.createdAt, last.id)
            : null;
        return {
          data,
          total: -1,
          page: 1,
          limit: pageSize,
          nextCursor,
          hasMore,
        };
      }

      const total = await qb.clone().getCount();

      if (paginate && skip !== undefined && limit !== undefined) {
        qb.skip(skip).take(limit);
      }
      const data = await qb.getMany();

      if (!paginate) {
        return { data, total, page: 1, limit: total };
      }

      const resolvedPage =
        offset !== undefined && limit !== undefined && limit > 0
          ? Math.floor(offset / limit) + 1
          : page;

      return { data, total, page: resolvedPage, limit: limit ?? 20 };
    } catch (error) {
      const pgDetail =
        error instanceof QueryFailedError
          ? String(
              (error as QueryFailedError & { driverError?: { message?: string } })
                .driverError?.message ?? error.message,
            )
          : error instanceof Error
            ? error.message
            : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        JSON.stringify({
          msg: 'query_failed',
          context: useCursor
            ? 'patients.findAll.cursor'
            : paginate
              ? 'patients.findAll.paginated'
              : 'patients.findAll',
          error: pgDetail,
        }),
        stack,
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
      clinicId,
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

    try {
      await bumpClinicListCacheVersion(this.cache, 'patients', clinicId);
    } catch {
      /* noop */
    }

    this.logger.log('Patient created', {
      patientId: maskUuid(saved.id),
      clinicId: maskUuid(clinicId),
      actorUserId: maskUuid(authUser.sub),
    });

    return saved;
  }
}
