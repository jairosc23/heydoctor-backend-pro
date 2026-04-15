import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import type { Job } from 'bullmq';
import { APP_LOGGER } from '../../common/logger/logger.tokens';
import { QUEUE_WORKER_LIMITER } from '../queue-worker.constants';

/** Cola `email`: envío transaccional (implementación real vía proveedor externo). */
@Injectable()
@Processor('email', {
  concurrency: 2,
  limiter: QUEUE_WORKER_LIMITER.email,
})
export class EmailQueueProcessor extends WorkerHost {
  constructor(@Inject(APP_LOGGER) private readonly log: LoggerService) {
    super();
  }

  async process(job: Job<{ templateId?: string }>): Promise<void> {
    this.log.log('queue_email_job', {
      jobId: String(job.id ?? ''),
      templateId: job.data?.templateId ?? 'unknown',
      attemptsMade: job.attemptsMade,
    });
  }
}
