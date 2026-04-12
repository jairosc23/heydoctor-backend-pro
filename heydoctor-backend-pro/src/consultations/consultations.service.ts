import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  type LoggerService,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { APP_LOGGER } from '../common/logger/logger.tokens';
import { maskUuid } from '../common/observability/log-masking.util';
import { getCurrentRequestId } from '../common/request-context.storage';
import { AuthorizationService } from '../authorization/authorization.service';
import type { ConsultationsListQueryDto } from './dto/consultations-list-query.dto';
import type { PaginatedResult } from '../common/types/paginated-result.type';
import { ConsentService } from '../consents/consent.service';
import { ENV_CONFIG_TOKEN, type EnvConfig } from '../config/env.config';
import {
  diagnosisHasLeadingCie10Prefix,
  diagnosisHasValidLeadingCie10IfPresent,
} from '../common/validation/cie10-diagnosis.util';
import { UserRole } from '../users/user-role.enum';
import { Consultation } from './consultation.entity';
import { ConsultationStatus } from './consultation-status.enum';
import { logConsultationStatusChange } from './consultation-status-audit.helper';
import {
  assertClinicalStatusTransition,
  assertRoleForTransition,
} from './consultation-status.transitions';
import type { ConsultationAiSnapshot } from './consultation-ai-snapshot.type';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { SignConsultationDto } from './dto/sign-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';

function normalizeSignature(signature: string): string {
  const value = signature.trim();
  const marker = 'base64,';
  const idx = value.indexOf(marker);
  const base64 = idx >= 0 ? value.slice(idx + marker.length).trim() : value;
  if (!base64) {
    throw new BadRequestException('signature is empty');
  }
  return base64;
}

/** Alineado con PostgreSQL `consultations_status_enum` (migración inicial). */
const CONSULTATION_STATUS_VALUES = new Set<string>(
  Object.values(ConsultationStatus),
);

function isConsultationStatusValue(value: unknown): value is ConsultationStatus {
  return typeof value === 'string' && CONSULTATION_STATUS_VALUES.has(value);
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

@Injectable()
export class ConsultationsService {
  constructor(
    @InjectRepository(Consultation)
    private readonly consultationsRepository: Repository<Consultation>,
    private readonly authorizationService: AuthorizationService,
    private readonly consentService: ConsentService,
    private readonly auditService: AuditService,
    private readonly aiService: AiService,
    @Inject(APP_LOGGER)
    private readonly logger: LoggerService,
    @Inject(ENV_CONFIG_TOKEN)
    private readonly env: EnvConfig,
  ) {}

  /** Scoped lookup for billing / integrations (no auth side-effects). */
  async findByIdForClinic(
    id: string,
    clinicId: string,
  ): Promise<Consultation | null> {
    return this.consultationsRepository.findOne({
      where: { id, clinicId },
    });
  }

  async create(
    dto: CreateConsultationDto,
    authUser: AuthenticatedUser,
  ): Promise<Consultation> {
    const { clinicId } =
      await this.authorizationService.getUserWithClinic(authUser);
    await this.authorizationService.assertPatientInClinic(
      authUser,
      dto.patientId,
    );

    const consent = await this.consentService.getLatestConsent(authUser.sub);
    if (!consent) {
      throw new ForbiddenException(
        'Consent required before consultation',
      );
    }

    const entity = this.consultationsRepository.create({
      patient: { id: dto.patientId },
      clinic: { id: clinicId },
      consent: { id: consent.id },
      consentVersion: consent.version,
      consentGivenAt: consent.consentGivenAt,
      consentIp: consent.ip,
      consentUserAgent: consent.userAgent,
      doctorId: authUser.sub,
      chiefComplaint: dto.chiefComplaint.trim(),
      status: ConsultationStatus.DRAFT,
    });
    const saved = await this.consultationsRepository.save(entity);

    void this.auditService.logSuccess({
      userId: authUser.sub,
      action: 'CONSULTATION_CREATED',
      resource: 'consultation',
      resourceId: saved.id,
      clinicId,
      httpStatus: 201,
      metadata: {
        consentId: consent.id,
      },
    });

    this.logger.log('Consultation created', {
      consultationId: maskUuid(saved.id),
      patientId: maskUuid(dto.patientId),
      doctorId: maskUuid(authUser.sub),
      clinicId: maskUuid(clinicId),
    });

    return saved;
  }

  async findAll(
    authUser: AuthenticatedUser,
    query?: ConsultationsListQueryDto,
  ): Promise<PaginatedResult<Consultation>> {
    const { clinicId } =
      await this.authorizationService.getUserWithClinic(authUser);

    const rawConsultSearch = query?.search;
    const consultSearch =
      typeof rawConsultSearch === 'string' ? rawConsultSearch.trim() : '';
    /** Join a patient solo si hace falta filtrar por nombre/email (evita getManyAndCount+join con 0 filas). */
    const needsPatientJoin = consultSearch !== '';

    /**
     * Filtro por clínica vía relación (no `c.clinicId` en QB). Mismo patrón para `patient.id`.
     */
    const qb = this.consultationsRepository
      .createQueryBuilder('c')
      .leftJoin('c.clinic', 'clinic')
      .where('clinic.id = :clinicId', { clinicId })
      .orderBy('c.created_at', 'DESC');

    if (needsPatientJoin) {
      qb.leftJoinAndSelect('c.patient', 'patient');
    } else if (query?.patientId) {
      qb.innerJoin('c.patient', 'patient');
    }

    if (query?.patientId) {
      qb.andWhere('patient.id = :patientId', {
        patientId: query.patientId,
      });
    }
    const statusFilter = query?.status as ConsultationStatus | string | undefined;
    if (statusFilter !== undefined && statusFilter !== null) {
      if (isConsultationStatusValue(statusFilter)) {
        qb.andWhere('c.status = :status', { status: statusFilter });
      } else if (String(statusFilter).trim() !== '') {
        this.logger.warn(
          JSON.stringify({
            msg: 'consultations.findAll.invalid_status_ignored',
            status: statusFilter,
            allowed: [...CONSULTATION_STATUS_VALUES],
          }),
        );
      }
    }
    if (query?.doctorId) {
      qb.andWhere('c.doctor_id = :doctorId', { doctorId: query.doctorId });
    }
    if (query?.from) {
      const from = new Date(query.from);
      if (isValidDate(from)) {
        qb.andWhere('c.created_at >= :from', { from });
      }
    }
    if (query?.to) {
      const end = new Date(query.to);
      if (isValidDate(end)) {
        end.setUTCHours(23, 59, 59, 999);
        qb.andWhere('c.created_at <= :to', { to: end });
      }
    }
    if (needsPatientJoin) {
      const escaped = consultSearch
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      qb.andWhere(
        '(COALESCE(patient.name, \'\') ILIKE :q OR COALESCE(patient.email, \'\') ILIKE :q)',
        { q: `%${escaped}%` },
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

    const runQuery = async (): Promise<[Consultation[], number]> => {
      const total = await qb.clone().getCount();
      if (total === 0) {
        return [[], 0];
      }
      const dataQb = qb.clone();
      if (paginate && skip !== undefined && limit !== undefined) {
        dataQb.skip(skip).take(limit);
      }
      let data = await dataQb.getMany();
      if (!needsPatientJoin && data.length > 0) {
        const ids = data.map((c) => c.id);
        const loaded = await this.consultationsRepository.find({
          where: { id: In(ids) },
          relations: { patient: true },
        });
        const byId = new Map(loaded.map((c) => [c.id, c]));
        data = ids
          .map((id) => byId.get(id))
          .filter((c): c is Consultation => c !== undefined);
      }
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
          context: paginate ? 'consultations.findAll.paginated' : 'consultations.findAll',
          error: message,
        }),
      );
      throw new InternalServerErrorException('Query failed');
    }
  }

  async findOne(
    id: string,
    authUser: AuthenticatedUser,
  ): Promise<Consultation> {
    const { clinicId, user } =
      await this.authorizationService.getUserWithClinic(authUser);
    const consultation = await this.consultationsRepository.findOne({
      where: { id, clinicId },
      relations: { patient: true },
    });
    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }
    await this.authorizationService.assertUserInClinic(
      authUser,
      consultation.clinicId,
      user,
    );
    return consultation;
  }

  /**
   * Same access as {@link findOne}: user’s clinic must own the consultation.
   * Used by WebRTC signaling so only authorized staff join the room.
   */
  async verifySignalingAccess(
    id: string,
    authUser: AuthenticatedUser,
  ): Promise<void> {
    await this.findOne(id, authUser);
  }

  async getConsultationAi(
    id: string,
    authUser: AuthenticatedUser,
  ): Promise<ConsultationAiSnapshot> {
    const { clinicId, user } =
      await this.authorizationService.getUserWithClinic(authUser);
    const row = await this.consultationsRepository.findOne({
      where: { id, clinicId },
      select: {
        id: true,
        aiSummary: true,
        aiSuggestedDiagnosis: true,
        aiImprovedNotes: true,
        aiGeneratedAt: true,
        clinicId: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Consultation not found');
    }
    await this.authorizationService.assertUserInClinic(
      authUser,
      row.clinicId,
      user,
    );
    return {
      summary: row.aiSummary ?? null,
      suggestedDiagnosis: row.aiSuggestedDiagnosis ?? null,
      improvedNotes: row.aiImprovedNotes ?? null,
      generatedAt: row.aiGeneratedAt ?? null,
    };
  }

  async startCall(
    id: string,
    authUser: AuthenticatedUser,
  ): Promise<{ ok: true; consultationId: string }> {
    const { clinicId, user } =
      await this.authorizationService.getUserWithClinic(authUser);

    const consent = await this.consentService.getLatestConsent(authUser.sub);
    if (!consent) {
      throw new ForbiddenException('CONSENT_REQUIRED');
    }

    const consultation = await this.consultationsRepository.findOne({
      where: { id, clinicId },
    });
    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }
    await this.authorizationService.assertUserInClinic(
      authUser,
      consultation.clinicId,
      user,
    );

    if (
      consultation.status !== ConsultationStatus.IN_PROGRESS &&
      consultation.status !== ConsultationStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Consultation must be in progress or draft to start a call',
      );
    }

    if (consultation.status === ConsultationStatus.DRAFT) {
      consultation.status = ConsultationStatus.IN_PROGRESS;
      await this.consultationsRepository.save(consultation);
    }

    void this.auditService.logSuccess({
      userId: authUser.sub,
      action: 'CONSULTATION_CALL_STARTED',
      resource: 'consultation',
      resourceId: id,
      clinicId,
      httpStatus: 200,
    });

    return { ok: true, consultationId: id };
  }

  async sign(
    id: string,
    dto: SignConsultationDto,
    authUser: AuthenticatedUser,
  ): Promise<Consultation> {
    const { clinicId, user } =
      await this.authorizationService.getUserWithClinic(authUser);
    const consultation = await this.consultationsRepository.findOne({
      where: { id, clinicId },
    });
    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }
    await this.authorizationService.assertUserInClinic(
      authUser,
      consultation.clinicId,
      user,
    );

    if (authUser.role !== UserRole.DOCTOR) {
      throw new ForbiddenException('Only doctor can sign first');
    }
    if (consultation.doctorId !== authUser.sub) {
      throw new ForbiddenException('Only assigned doctor can sign consultation');
    }
    if (consultation.doctorSignature) {
      throw new ForbiddenException('Doctor signature already set');
    }
    if (consultation.signedAt) {
      throw new ForbiddenException('Consultation is already signed');
    }

    if (
      consultation.status !== ConsultationStatus.COMPLETED &&
      consultation.status !== ConsultationStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        `Cannot sign consultation in "${consultation.status}" status`,
      );
    }

    this.assertDiagnosisAllowedForClosing(consultation.diagnosis);

    const previousStatus = consultation.status;
    consultation.doctorSignature = normalizeSignature(dto.signature);
    consultation.signedAt = new Date();
    consultation.status = ConsultationStatus.SIGNED;

    const saved = await this.consultationsRepository.save(consultation);

    logConsultationStatusChange({
      auditService: this.auditService,
      logger: this.logger,
      authUser,
      previousStatus,
      nextStatus: ConsultationStatus.SIGNED,
      consultationId: saved.id,
      clinicId: saved.clinicId ?? consultation.clinicId,
      doctorId: saved.doctorId,
      patientId: saved.patientId,
      requestId: getCurrentRequestId(),
    });

    void this.auditService.logSuccess({
      userId: authUser.sub,
      action: 'CONSULTATION_SIGNED',
      resource: 'consultation',
      resourceId: saved.id,
      clinicId: saved.clinicId,
      httpStatus: 201,
      metadata: {
        signerRole: authUser.role,
        signerType: 'doctor',
        signedAt: saved.signedAt?.toISOString() ?? null,
      },
    });

    return saved;
  }

  async update(
    id: string,
    dto: UpdateConsultationDto,
    authUser: AuthenticatedUser,
  ): Promise<Consultation> {
    const { clinicId, user } =
      await this.authorizationService.getUserWithClinic(authUser);
    const consultation = await this.consultationsRepository.findOne({
      where: { id, clinicId },
    });
    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }
    await this.authorizationService.assertUserInClinic(
      authUser,
      consultation.clinicId,
      user,
    );

    if (consultation.status === ConsultationStatus.LOCKED) {
      throw new ForbiddenException('Consultation is locked and cannot be modified');
    }

    const previousStatus =
      dto.status !== undefined ? consultation.status : undefined;

    if (dto.status !== undefined) {
      assertClinicalStatusTransition(consultation.status, dto.status);
      assertRoleForTransition(
        authUser.role,
        consultation.status,
        dto.status,
      );
    }

    if (
      dto.status !== undefined &&
      dto.status !== consultation.status &&
      (dto.status === ConsultationStatus.COMPLETED ||
        dto.status === ConsultationStatus.SIGNED ||
        dto.status === ConsultationStatus.LOCKED)
    ) {
      const nextDiagnosis =
        dto.diagnosis !== undefined
          ? dto.diagnosis
          : (consultation.diagnosis ?? '');
      this.assertDiagnosisAllowedForClosing(nextDiagnosis);
    }

    const prevChiefComplaint = consultation.chiefComplaint;
    const prevSymptoms = consultation.symptoms;
    const prevNotes = consultation.notes;
    const prevDiagnosis = consultation.diagnosis;
    const prevTreatmentPlan = consultation.treatmentPlan;

    if (dto.chiefComplaint !== undefined) {
      consultation.chiefComplaint = dto.chiefComplaint.trim();
    }
    if (dto.symptoms !== undefined) {
      consultation.symptoms = dto.symptoms.trim() || null;
    }
    if (dto.diagnosis !== undefined) {
      consultation.diagnosis = dto.diagnosis;
    }
    if (dto.treatmentPlan !== undefined) {
      consultation.treatmentPlan = dto.treatmentPlan;
    }
    if (dto.notes !== undefined) {
      consultation.notes = dto.notes;
    }
    if (dto.status !== undefined) {
      consultation.status = dto.status;
    }

    const saved = await this.consultationsRepository.save(consultation);

    const clinicalDocumentationChanged =
      saved.chiefComplaint !== prevChiefComplaint ||
      saved.symptoms !== prevSymptoms ||
      saved.notes !== prevNotes ||
      saved.diagnosis !== prevDiagnosis ||
      saved.treatmentPlan !== prevTreatmentPlan;

    if (clinicalDocumentationChanged) {
      this.runAiClinicalSummaryInBackground(saved, authUser);

      void this.auditService.logSuccess({
        userId: authUser.sub,
        action: 'CONSULTATION_UPDATED',
        resource: 'consultation',
        resourceId: saved.id,
        clinicId: saved.clinicId ?? clinicId,
        httpStatus: 200,
        metadata: {
          fieldsChanged: [
            saved.chiefComplaint !== prevChiefComplaint
              ? 'chiefComplaint'
              : null,
            saved.symptoms !== prevSymptoms ? 'symptoms' : null,
            saved.notes !== prevNotes ? 'notes' : null,
            saved.diagnosis !== prevDiagnosis ? 'diagnosis' : null,
            saved.treatmentPlan !== prevTreatmentPlan ? 'treatmentPlan' : null,
          ].filter(Boolean),
        },
      });
    }

    if (
      dto.status !== undefined &&
      previousStatus !== undefined &&
      dto.status !== previousStatus
    ) {
      logConsultationStatusChange({
        auditService: this.auditService,
        logger: this.logger,
        authUser,
        previousStatus,
        nextStatus: dto.status,
        consultationId: saved.id,
        clinicId: saved.clinicId ?? consultation.clinicId,
        doctorId: saved.doctorId,
        patientId: saved.patientId,
        requestId: getCurrentRequestId(),
      });
    }

    return saved;
  }

  private assertDiagnosisAllowedForClosing(
    diagnosis: string | null | undefined,
  ): void {
    const d = (diagnosis ?? '').trim();
    if (!d) {
      throw new BadRequestException(
        'Diagnosis is required before completing, signing or locking the consultation',
      );
    }
    if (!diagnosisHasValidLeadingCie10IfPresent(d)) {
      throw new BadRequestException(
        'Diagnosis begins with an invalid CIE-10/ICD-10 code prefix',
      );
    }
    if (
      this.env.requireCie10PrefixForCompletion &&
      !diagnosisHasLeadingCie10Prefix(d)
    ) {
      throw new BadRequestException(
        'A CIE-10/ICD-10 code at the start of the diagnosis is required in this environment',
      );
    }
  }

  /**
   * Non-blocking AI assist: failures are swallowed so PATCH latency and success are unchanged.
   */
  private runAiClinicalSummaryInBackground(
    consultation: Consultation,
    authUser: AuthenticatedUser,
  ): void {
    void (async () => {
      try {
        const result = await this.aiService.generateClinicalSummary(
          {
            chiefComplaint: consultation.chiefComplaint ?? '',
            symptoms: consultation.symptoms ?? '',
            notes: consultation.notes ?? '',
            diagnosis: consultation.diagnosis ?? '',
            treatmentPlan: consultation.treatmentPlan ?? '',
          },
          authUser,
        );
        await this.consultationsRepository.update(
          { id: consultation.id },
          {
            aiSummary: result.summary,
            aiSuggestedDiagnosis: result.suggestedDiagnosis,
            aiImprovedNotes: result.improvedNotes,
            aiGeneratedAt: new Date(),
          },
        );
        this.logger.log('AI summary generated', {
          consultationId: maskUuid(consultation.id),
          patientId: maskUuid(consultation.patientId),
          clinicId: maskUuid(consultation.clinicId),
        });
      } catch (err) {
        this.logger.error(
          'AI summary skipped or failed',
          err instanceof Error ? err : new Error(String(err)),
          {
            consultationId: maskUuid(consultation.id),
            patientId: maskUuid(consultation.patientId),
            clinicId: maskUuid(consultation.clinicId),
          },
        );
      }
    })();
  }

  async remove(id: string, authUser: AuthenticatedUser): Promise<void> {
    const { clinicId, user } =
      await this.authorizationService.getUserWithClinic(authUser);
    const consultation = await this.consultationsRepository.findOne({
      where: { id, clinicId },
    });
    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }
    await this.authorizationService.assertUserInClinic(
      authUser,
      consultation.clinicId,
      user,
    );

    if (consultation.status === ConsultationStatus.LOCKED) {
      throw new ForbiddenException('Consultation is locked and cannot be deleted');
    }

    const snapshot = { ...consultation };

    await this.consultationsRepository.remove(consultation);

    const capturedAt = new Date().toISOString();

    void this.auditService.logSuccess({
      userId: authUser.sub,
      action: 'CONSULTATION_DELETE',
      resource: 'consultation',
      resourceId: snapshot.id,
      clinicId: snapshot.clinicId,
      httpStatus: 200,
      metadata: {
        type: 'delete',
        deletedSnapshot: {
          ...snapshot,
          _meta: {
            capturedAt,
            capturedBy: authUser.sub,
          },
        },
      },
    });
  }
}
