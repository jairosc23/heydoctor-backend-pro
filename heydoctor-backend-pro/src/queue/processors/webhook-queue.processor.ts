import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import type { Job } from 'bullmq';
import { APP_LOGGER } from '../../common/logger/logger.tokens';
import { QUEUE_WORKER_LIMITER } from '../queue-worker.constants';

/** Cola `webhook`: entregas salientes a integraciones (sin URL ni cuerpo en logs). */
@Injectable()
@Processor('webhook', {
  concurrency: 3,
  limiter: QUEUE_WORKER_LIMITER.webhook,
})
export class WebhookQueueProcessor extends WorkerHost {
  constructor(@Inject(APP_LOGGER) private readonly log: LoggerService) {
    super();
  }

  async process(
    job: Job<{ event?: string; targetKey?: string }>,
  ): Promise<void> {
    this.log.log('queue_webhook_job', {
      jobId: String(job.id ?? ''),
      event: job.data?.event ?? 'unknown',
      targetKey: job.data?.targetKey ?? 'default',
      attemptsMade: job.attemptsMade,
    });
  }
}
