import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Optional,
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
  LIST_CACHE_HARD_TTL_MS,
  entityListCacheHardStoreTtlMs,
  revivePatientsListFromCache,
} from '../common/cache/entity-list-cache.helper';
import { ChaosRuntimeService } from '../common/chaos/chaos-runtime.service';
import { ReadReplicaCircuitService } from '../common/database/read-replica-circuit.service';
import { TYPEORM_READ_CONNECTION } from '../common/database/typeorm-read-replica';
import { withReadReplicaFallback } from '../common/database/read-replica-fallback.util';
import { SwrListRefreshLockService } from '../common/cache/swr-list-refresh-lock.service';
import { HttpLoadTrackerService } from '../common/observability/http-load-tracker.service';
import { assertValidCursor, encodeListCursor } from '../common/pagination/cursor-pagination.util';
import type { PaginatedResult } from '../common/types/paginated-result.type';
import { APP_LOGGER } from '../common/logger/logger.tokens';
import {
  maskEmail,
  maskUuid,
} from '../common/observability/log-masking.util';
import type { PatientsListQueryDto } from './dto/patients-list-query.dto';
import { CreatePatientDto } from './dto/create-patient.dto';
import { Patient } from './patient.entity';

/** Postgres driver error a veces sin `instanceof QueryFailedError` tras bundling. */
function pgErrorFromUnknown(err: unknown): { code?: string; detail?: string } {
  if (!err || typeof err !== 'object') {
    return {};
  }
  const e = err as Record<string, unknown>;
  const de = e.driverError;
  if (de && typeof de === 'object') {
    const d = de as Record<string, unknown>;
    return {
      code: typeof d.code === 'string' ? d.code : undefined,
      detail: typeof d.detail === 'string' ? d.detail : undefined,
    };
  }
  const code = e.code;
  return {
    code: typeof code === 'string' ? code : undefined,
    detail: typeof e.detail === 'string' ? e.detail : undefined,
  };
}

function isQueryFailedError(err: unknown): boolean {
  return err instanceof QueryFailedError ||
    (err instanceof Error && err.name === 'QueryFailedError');
}

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientsRepository: Repository<Patient>,
    @Optional()
    @InjectRepository(Patient, TYPEORM_READ_CONNECTION)
    private readonly patientsReadRepository: Repository<Patient> | undefined,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
    @Inject(APP_LOGGER)
    private readonly logger: LoggerService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly swrListRefreshLock: SwrListRefreshLockService,
    private readonly httpLoadTracker: HttpLoadTrackerService,
    private readonly readReplicaCircuit: ReadReplicaCircuitService,
    private readonly chaosRuntime: ChaosRuntimeService,
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
      if (this.chaosRuntime.shouldSimulate('redis')) {
        this.chaosRuntime.logRuntime('redis', { path: 'patients.findAll' });
        throw new Error('chaos_runtime redis simulated failure');
      }
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
          if (age >= this.httpLoadTracker.getEntityListFreshMs()) {
            this.swrListRefreshLock.scheduleRefresh(cacheKey, async () => {
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
    if (this.chaosRuntime.shouldSimulate('replica')) {
      this.chaosRuntime.logRuntime('replica', { context: 'patients.list' });
      return this.executeLoadPatientsList(
        this.patientsRepository,
        clinicId,
        query,
      );
    }
    return withReadReplicaFallback(
      this.patientsReadRepository,
      this.patientsRepository,
      (repo) => this.executeLoadPatientsList(repo, clinicId, query),
      this.logger,
      'patients.list',
      this.readReplicaCircuit,
    );
  }

  private async executeLoadPatientsList(
    repo: Repository<Patient>,
    clinicId: string,
    query?: PatientsListQueryDto,
  ): Promise<PaginatedResult<Patient>> {
    const qb = repo
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

  /** Nombre para almacenar: `name` o first + last (trim, sin exigir ambos apellidos). */
  private resolvePatientDisplayName(dto: CreatePatientDto): string {
    const direct = dto.name?.trim() ?? '';
    if (direct !== '') {
      return direct;
    }
    const fn = dto.firstName?.trim() ?? '';
    const ln = dto.lastName?.trim() ?? '';
    return [fn, ln].filter((p) => p !== '').join(' ').trim();
  }

  async create(
    dto: CreatePatientDto,
    authUser: AuthenticatedUser,
  ): Promise<Patient> {
    console.error('PATIENT_CREATE_PAYLOAD', {
      name: dto.name,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: maskEmail((dto.email ?? '').trim() || ''),
    });

    try {
      return await this.executeCreatePatient(dto, authUser);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('PATIENT_CREATE_UNEXPECTED', error);
      this.logger.error(
        JSON.stringify({
          msg: 'patient_create_unexpected',
          name: error instanceof Error ? error.name : typeof error,
          pg: pgErrorFromUnknown(error),
        }),
        error instanceof Error ? error.stack : undefined,
      );
      const pg = pgErrorFromUnknown(error);
      if (pg.code === '23505') {
        throw new ConflictException(
          'A patient with this email already exists',
        );
      }
      if (pg.code === '23503') {
        throw new BadRequestException('Invalid patient data');
      }
      if (isQueryFailedError(error)) {
        const qe = error as QueryFailedError;
        const driver = qe.driverError as { code?: string } | undefined;
        if (driver?.code === '23505') {
          throw new ConflictException(
            'A patient with this email already exists',
          );
        }
        if (driver?.code === '23503') {
          throw new BadRequestException('Invalid patient data');
        }
        throw new BadRequestException('Invalid patient data');
      }
      if (error instanceof TypeError) {
        throw new BadRequestException('Invalid patient data');
      }
      throw new BadRequestException(
        'No se pudo crear el paciente. Revisa los datos o inténtalo más tarde.',
      );
    }
  }

  private async executeCreatePatient(
    dto: CreatePatientDto,
    authUser: AuthenticatedUser,
  ): Promise<Patient> {
    let clinicId: string;
    try {
      ({ clinicId } = await this.authorizationService.getUserWithClinic(
        authUser,
      ));
    } catch (error) {
      console.error('PATIENT_CREATE_ERROR', error);
      throw error;
    }

    const displayName = this.resolvePatientDisplayName(dto);
    if (!displayName) {
      console.error('PATIENT_CREATE_ERROR', new Error('empty_display_name'));
      throw new BadRequestException('Invalid patient data');
    }

    const emailRaw = dto.email?.trim() ?? '';
    if (!emailRaw) {
      throw new BadRequestException('Invalid patient data');
    }
    const email = emailRaw.toLowerCase();

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
      name: displayName,
      email,
      clinicId,
    });

    let saved: Patient;
    try {
      saved = await this.patientsRepository.save(entity);
    } catch (error) {
      console.error('PATIENT_CREATE_ERROR', error);
      if (isQueryFailedError(error)) {
        const driverError = (error as QueryFailedError).driverError as
          | { code?: string; detail?: string }
          | undefined;
        const code = driverError?.code ?? pgErrorFromUnknown(error).code;
        if (code === '23505') {
          throw new ConflictException(
            'A patient with this email already exists',
          );
        }
        if (code === '23503') {
          throw new BadRequestException('Invalid patient data');
        }
        this.logger.error(
          JSON.stringify({
            msg: 'patient_create_query_failed',
            code,
            detail: driverError?.detail,
          }),
          error instanceof Error ? error.stack : undefined,
        );
      } else {
        this.logger.error(
          JSON.stringify({
            msg: 'patient_create_failed',
            pg: pgErrorFromUnknown(error),
          }),
          error instanceof Error ? error.stack : undefined,
        );
      }
      throw new BadRequestException('Invalid patient data');
    }

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
