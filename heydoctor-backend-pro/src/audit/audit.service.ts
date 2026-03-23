import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditOutcome } from './audit-outcome.enum';
import type { AuditLogErrorPayload, AuditLogSuccessPayload } from './audit.types';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

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
    } catch (err) {
      this.logger.error('AuditService.logError failed', err);
    }
  }
}
