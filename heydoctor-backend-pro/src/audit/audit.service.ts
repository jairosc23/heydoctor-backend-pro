import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditOutcome } from './audit-outcome.enum';
import type { AuditLogErrorPayload, AuditLogSuccessPayload } from './audit.types';

/** Tunables for in-memory alert heuristics (see handlers below). */
const ALERT_CONFIG = {
  SHORT_WINDOW_MS: 5 * 60 * 1000,
  MAX_403_PER_USER: 5,
  /** Global CONSULTATION_STATUS_CHANGE events allowed in window before warn. */
  MAX_STATUS_CHANGES: 25,
} as const;

/** Warn when crossing strictly above MAX (e.g. 6th 403 when MAX is 5). */
const abuseWarnAt = ALERT_CONFIG.MAX_403_PER_USER + 1;
const statusChangeWarnAt = ALERT_CONFIG.MAX_STATUS_CHANGES + 1;

/** Context passed to alert handlers after a persisted audit row. */
export type AuditAlertLogContext = {
  userId?: string | null;
  httpStatus: number;
  action: string;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  // TODO: Replace in-memory counters with Redis (or similar) for multi-instance environments
  // so thresholds are shared across pods and survive process restarts.
  private readonly user403Timestamps = new Map<string, number[]>();
  private readonly statusChangeTimestamps: number[] = [];

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogsRepository: Repository<AuditLog>,
  ) {}

  async logSuccess(data: AuditLogSuccessPayload): Promise<void> {
    try {
      const row = this.auditLogsRepository.create({
        userId: data.userId ?? null,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId ?? null,
        clinicId: data.clinicId ?? null,
        status: AuditOutcome.SUCCESS,
        httpStatus: data.httpStatus,
        errorMessage: null,
        metadata: data.metadata ?? null,
      });
      await this.auditLogsRepository.save(row);
      const log: AuditAlertLogContext = {
        userId: data.userId,
        httpStatus: data.httpStatus,
        action: data.action,
      };
      this.handle403Alerts(log);
      this.handleStatusChangeAlerts(log);
    } catch (err) {
      this.logger.error('AuditService.logSuccess failed', err);
    }
  }

  async logError(data: AuditLogErrorPayload): Promise<void> {
    try {
      const row = this.auditLogsRepository.create({
        userId: data.userId ?? null,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId ?? null,
        clinicId: data.clinicId ?? null,
        status: AuditOutcome.ERROR,
        httpStatus: data.httpStatus,
        errorMessage: data.errorMessage,
        metadata: data.metadata ?? null,
      });
      await this.auditLogsRepository.save(row);
      const log: AuditAlertLogContext = {
        userId: data.userId,
        httpStatus: data.httpStatus,
        action: data.action,
      };
      this.handle403Alerts(log);
      this.handleStatusChangeAlerts(log);
    } catch (err) {
      this.logger.error('AuditService.logError failed', err);
    }
  }

  private pruneWindow(timestamps: number[]): number[] {
    const cutoff = Date.now() - ALERT_CONFIG.SHORT_WINDOW_MS;
    return timestamps.filter((t) => t >= cutoff);
  }

  /**
   * Tracks HTTP 403 audit events per user in a sliding window.
   * TODO: Swap Map + arrays for Redis INCR + EXPIRE or sorted sets for horizontal scale.
   */
  private handle403Alerts(log: AuditAlertLogContext): void {
    if (log.httpStatus !== 403 || !log.userId) {
      return;
    }

    const list = this.user403Timestamps.get(log.userId) ?? [];
    list.push(Date.now());
    const pruned = this.pruneWindow(list);
    this.user403Timestamps.set(log.userId, pruned);

    if (pruned.length === abuseWarnAt) {
      this.logger.warn(`Potential abuse detected for user ${log.userId}`);
    }
  }

  /**
   * Tracks CONSULTATION_STATUS_CHANGE volume globally in a sliding window.
   * TODO: Use Redis for cluster-wide rate detection; optionally scope by clinicId from log extensions.
   */
  private handleStatusChangeAlerts(log: AuditAlertLogContext): void {
    if (log.action !== 'CONSULTATION_STATUS_CHANGE') {
      return;
    }

    this.statusChangeTimestamps.push(Date.now());
    const pruned = this.pruneWindow(this.statusChangeTimestamps);
    this.statusChangeTimestamps.length = 0;
    this.statusChangeTimestamps.push(...pruned);

    if (pruned.length === statusChangeWarnAt) {
      this.logger.warn('Unusual status changes activity');
    }
  }
}
