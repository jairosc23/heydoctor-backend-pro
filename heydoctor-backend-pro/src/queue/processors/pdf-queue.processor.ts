import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import type { Job } from 'bullmq';
import { APP_LOGGER } from '../../common/logger/logger.tokens';
import { maskOptionalUuid } from '../../common/observability/log-masking.util';
import { QUEUE_WORKER_LIMITER } from '../queue-worker.constants';

/** Cola `pdf`: generación asíncrona de documentos (p. ej. legal PDF). */
@Injectable()
@Processor('pdf', {
  concurrency: 2,
  limiter: QUEUE_WORKER_LIMITER.pdf,
})
export class PdfQueueProcessor extends WorkerHost {
  constructor(@Inject(APP_LOGGER) private readonly log: LoggerService) {
    super();
  }

  async process(
    job: Job<{ resourceId?: string; kind?: string }>,
  ): Promise<void> {
    this.log.log('queue_pdf_job', {
      jobId: String(job.id ?? ''),
      kind: job.data?.kind ?? 'unknown',
      resourceId: maskOptionalUuid(job.data?.resourceId),
      attemptsMade: job.attemptsMade,
    });
  }
}
