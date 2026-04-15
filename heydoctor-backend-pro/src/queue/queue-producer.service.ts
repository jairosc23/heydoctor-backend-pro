import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import type { Job, JobsOptions, Queue } from 'bullmq';
import { APP_LOGGER } from '../common/logger/logger.tokens';
import { DEFAULT_QUEUE_JOB_OPTIONS, QUEUE_JOB_PRIORITY } from './queue.constants';
import {
  emailQueueJobId,
  pdfQueueJobId,
  webhookQueueJobId,
} from './queue-job-id.patterns';

const mergeOpts = (
  jobId: string,
  opts?: JobsOptions,
): JobsOptions => ({
  ...DEFAULT_QUEUE_JOB_OPTIONS,
  jobId,
  ...opts,
});

/**
 * Encolado con `jobId` determinista para evitar duplicados (BullMQ deduplica por jobId).
 */
@Injectable()
export class QueueProducerService {
  constructor(
    @Inject(APP_LOGGER) private readonly log: LoggerService,
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('pdf') private readonly pdfQueue: Queue,
    @InjectQueue('webhook') private readonly webhookQueue: Queue,
  ) {}

  /**
   * Ante caída de Redis / BullMQ el encolado no debe tumbar la petición HTTP.
   */
  private async safeAdd<T>(
    queueName: string,
    run: () => Promise<T>,
  ): Promise<T | undefined> {
    try {
      return await run();
    } catch (e) {
      this.log.warn(
        JSON.stringify({
          msg: 'queue_enqueue_degraded',
          queue: queueName,
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
      return undefined;
    }
  }

  addEmailJob(
    data: { templateId?: string; to?: string; dedupe?: string },
    opts?: JobsOptions,
  ): Promise<Job | undefined> {
    const templateId = data.templateId ?? 'default';
    const recipientKey = data.to ?? 'unknown';
    const jobId = emailQueueJobId({
      templateId,
      recipientKey,
      dedupeExtra: data.dedupe,
    });
    return this.safeAdd('email', () =>
      this.emailQueue.add('email', data, mergeOpts(jobId, {
        priority: QUEUE_JOB_PRIORITY.email,
        ...opts,
      })),
    );
  }

  addPdfJob(
    data: { resourceId?: string; kind?: string; variant?: string },
    opts?: JobsOptions,
  ): Promise<Job | undefined> {
    const kind = data.kind ?? 'default';
    const resourceId = data.resourceId ?? 'unknown';
    const jobId = pdfQueueJobId({
      kind,
      resourceId,
      variant: data.variant,
    });
    return this.safeAdd('pdf', () =>
      this.pdfQueue.add('pdf', data, mergeOpts(jobId, {
        priority: QUEUE_JOB_PRIORITY.pdf,
        ...opts,
      })),
    );
  }

  addWebhookJob(
    data: { event?: string; targetKey?: string; payloadDigest?: string },
    opts?: JobsOptions,
  ): Promise<Job | undefined> {
    const event = data.event ?? 'default';
    const targetKey = data.targetKey ?? 'default';
    const jobId = webhookQueueJobId({
      event,
      targetKey,
      payloadDigest: data.payloadDigest,
    });
    return this.safeAdd('webhook', () =>
      this.webhookQueue.add('webhook', data, mergeOpts(jobId, {
        priority: QUEUE_JOB_PRIORITY.webhook,
        ...opts,
      })),
    );
  }
}
