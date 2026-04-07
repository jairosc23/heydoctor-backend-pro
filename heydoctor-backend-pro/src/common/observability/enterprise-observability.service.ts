import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import { APP_LOGGER } from '../logger/logger.tokens';
import {
  getContextCallId,
  getContextConsultationId,
  getCurrentRequestId,
} from '../request-context.storage';
import { maskEmail, maskUuid } from './log-masking.util';

const JSON_LOG = (): boolean =>
  String(process.env.LOG_FORMAT || '')
    .toLowerCase()
    .trim() === 'json';

/**
 * Enterprise-friendly structured events (JSON line mode or Nest structured context).
 * Never pass SDP, media payloads, or clinical narrative here.
 */
@Injectable()
export class EnterpriseObservabilityService {
  constructor(@Inject(APP_LOGGER) private readonly logger: LoggerService) {}

  /**
   * Emits one logical event with correlation fields auto-filled.
   * In `LOG_FORMAT=json`, writes a single JSON object per line to stdout via Nest Logger.
   */
  emit(
    event: string,
    fields: Record<string, unknown> & {
      userId?: string;
      consultationId?: string;
      callId?: string;
    },
  ): void {
    const requestId = getCurrentRequestId();
    const ctxConsultation = getContextConsultationId();
    const ctxCall = getContextCallId();
    const userId = fields.userId;
    const safe: Record<string, unknown> = {
      ...fields,
      event,
      ts: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
      ...(ctxCall || fields.callId ? { callId: fields.callId ?? ctxCall } : {}),
    };
    delete safe.userId;
    delete safe.consultationId;
    if (userId !== undefined) {
      safe.userIdMasked = maskUuid(String(userId));
    }
    const cid = (fields.consultationId as string | undefined) ?? ctxConsultation;
    if (cid !== undefined) {
      safe.consultationIdMasked = maskUuid(String(cid));
    }
    if (fields.userEmail !== undefined) {
      safe.userEmailMasked = maskEmail(String(fields.userEmail));
      delete safe.userEmail;
    }

    if (JSON_LOG()) {
      this.logger.log(JSON.stringify(safe));
      return;
    }
    this.logger.log(event, safe as Record<string, unknown>);
  }
}
