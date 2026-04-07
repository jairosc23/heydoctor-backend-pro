import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  type LoggerService,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuthorizationService } from '../authorization/authorization.service';
import { APP_LOGGER } from '../common/logger/logger.tokens';
import { maskUuid } from '../common/observability/log-masking.util';
import { ConsultationsService } from '../consultations/consultations.service';
import type {
  WebrtcRecordingStartDto,
  WebrtcRecordingStopDto,
} from './dto/webrtc-recording.dto';
import { RecordingAccessAudit } from './entities/recording-access-audit.entity';
import type { RecordingSessionStatus } from './entities/recording-session.entity';
import { RecordingSession } from './entities/recording-session.entity';

/**
 * Session metadata + audit trail only — no media persistence yet.
 * storagePath / encryptionKeyId are compliance-oriented placeholders for S3 + KMS.
 */
@Injectable()
export class WebrtcRecordingStubService {
  constructor(
    private readonly consultationsService: ConsultationsService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
    @InjectRepository(RecordingSession)
    private readonly sessions: Repository<RecordingSession>,
    @InjectRepository(RecordingAccessAudit)
    private readonly accessAudits: Repository<RecordingAccessAudit>,
    @Inject(APP_LOGGER) private readonly logger: LoggerService,
  ) {}

  async start(
    user: AuthenticatedUser,
    dto: WebrtcRecordingStartDto,
  ): Promise<{
    ok: true;
    accepted: true;
    mode: 'stub';
    recordingId: string;
    consultationId: string;
    userId: string;
    consentRequired: boolean;
    userConsentAsserted: boolean;
    storagePath: string | null;
    encryptionKeyId: string | null;
    startedAt: string;
  }> {
    await this.consultationsService.verifySignalingAccess(
      dto.consultationId,
      user,
    );
    const consentRequired = dto.consentRequired !== false;
    if (consentRequired && !dto.userConsent) {
      throw new BadRequestException(
        'Recording requires explicit user consent when consentRequired is true',
      );
    }

    const { clinicId } = await this.authorizationService.getUserWithClinic(user);

    const encryptionKeyId =
      process.env.RECORDING_ENCRYPTION_KEY_ID?.trim() || 'stub:kms:v1';
    const recordingId = randomUUID();
    const storagePath = `recordings/clinic/${clinicId}/sessions/${recordingId}/pending`;

    const session = this.sessions.create({
      id: recordingId,
      consultationId: dto.consultationId,
      startedByUserId: user.sub,
      status: 'active' as RecordingSessionStatus,
      consentAsserted: dto.userConsent,
      consentRequired,
      encryptionKeyRef: null,
      encryptionKeyId,
      storagePath,
      storageProvider: 's3_compatible_stub',
      endedAt: null,
    });
    const saved = await this.sessions.save(session);

    await this.accessAudits.save(
      this.accessAudits.create({
        recordingSessionId: saved.id,
        actorUserId: user.sub,
        action: 'RECORDING_START',
      }),
    );

    void this.auditService.logSuccess({
      userId: user.sub,
      action: 'WEBRTC_RECORDING_START',
      resource: 'recording_session',
      resourceId: saved.id,
      clinicId,
      httpStatus: 202,
      metadata: {
        mode: 'stub',
        consentRequired,
      },
    });

    this.logger.log('recording/start (stub)', {
      recordingId: saved.id,
      consultationId: maskUuid(dto.consultationId),
      userId: maskUuid(user.sub),
      consentRequired,
    });

    return {
      ok: true,
      accepted: true,
      mode: 'stub',
      recordingId: saved.id,
      consultationId: dto.consultationId,
      userId: user.sub,
      consentRequired,
      userConsentAsserted: dto.userConsent,
      storagePath: saved.storagePath,
      encryptionKeyId: saved.encryptionKeyId,
      startedAt: saved.createdAt.toISOString(),
    };
  }

  async stop(
    user: AuthenticatedUser,
    dto: WebrtcRecordingStopDto,
  ): Promise<{
    ok: true;
    accepted: true;
    mode: 'stub';
    recordingId: string;
    consultationId: string;
    userId: string;
    consentRequired: boolean;
    userConsentAsserted: boolean;
    endedAt: string;
  }> {
    await this.consultationsService.verifySignalingAccess(
      dto.consultationId,
      user,
    );
    const consentRequired = dto.consentRequired !== false;
    if (consentRequired && !dto.userConsent) {
      throw new BadRequestException(
        'Recording stop requires explicit user consent when consentRequired is true',
      );
    }

    const { clinicId } = await this.authorizationService.getUserWithClinic(user);

    const active = await this.sessions.findOne({
      where: {
        consultationId: dto.consultationId,
        startedByUserId: user.sub,
        status: 'active',
      },
      order: { createdAt: 'DESC' },
    });
    if (!active) {
      throw new NotFoundException('No active recording session for this user');
    }

    const endedAt = new Date();
    active.status = 'finalized';
    active.endedAt = endedAt;
    await this.sessions.save(active);

    await this.accessAudits.save(
      this.accessAudits.create({
        recordingSessionId: active.id,
        actorUserId: user.sub,
        action: 'RECORDING_STOP',
      }),
    );

    void this.auditService.logSuccess({
      userId: user.sub,
      action: 'WEBRTC_RECORDING_STOP',
      resource: 'recording_session',
      resourceId: active.id,
      clinicId,
      httpStatus: 202,
      metadata: { mode: 'stub' },
    });

    this.logger.log('recording/stop (stub)', {
      recordingId: active.id,
      consultationId: maskUuid(dto.consultationId),
    });

    return {
      ok: true,
      accepted: true,
      mode: 'stub',
      recordingId: active.id,
      consultationId: dto.consultationId,
      userId: user.sub,
      consentRequired,
      userConsentAsserted: dto.userConsent,
      endedAt: endedAt.toISOString(),
    };
  }

  async getStatus(
    user: AuthenticatedUser,
    consultationId: string,
  ): Promise<{
    active: boolean;
    recording: {
      recordingId: string;
      consultationId: string;
      status: RecordingSessionStatus;
      startedByUserId: string;
      consentRequired: boolean;
      userConsentAsserted: boolean;
      storagePath: string | null;
      encryptionKeyId: string | null;
      startedAt: string;
      endedAt: string | null;
    } | null;
  }> {
    await this.consultationsService.verifySignalingAccess(
      consultationId,
      user,
    );

    const active = await this.sessions.findOne({
      where: { consultationId, status: 'active' },
      order: { createdAt: 'DESC' },
    });

    if (!active) {
      return { active: false, recording: null };
    }

    return {
      active: true,
      recording: {
        recordingId: active.id,
        consultationId: active.consultationId,
        status: active.status,
        startedByUserId: active.startedByUserId,
        consentRequired: active.consentRequired,
        userConsentAsserted: active.consentAsserted,
        storagePath: active.storagePath,
        encryptionKeyId: active.encryptionKeyId,
        startedAt: active.createdAt.toISOString(),
        endedAt: active.endedAt ? active.endedAt.toISOString() : null,
      },
    };
  }
}
