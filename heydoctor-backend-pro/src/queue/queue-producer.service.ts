import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';
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
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('pdf') private readonly pdfQueue: Queue,
    @InjectQueue('webhook') private readonly webhookQueue: Queue,
  ) {}

  addEmailJob(
    data: { templateId?: string; to?: string; dedupe?: string },
    opts?: JobsOptions,
  ) {
    const templateId = data.templateId ?? 'default';
    const recipientKey = data.to ?? 'unknown';
    const jobId = emailQueueJobId({
      templateId,
      recipientKey,
      dedupeExtra: data.dedupe,
    });
    return this.emailQueue.add('email', data, mergeOpts(jobId, {
      priority: QUEUE_JOB_PRIORITY.email,
      ...opts,
    }));
  }

  addPdfJob(
    data: { resourceId?: string; kind?: string; variant?: string },
    opts?: JobsOptions,
  ) {
    const kind = data.kind ?? 'default';
    const resourceId = data.resourceId ?? 'unknown';
    const jobId = pdfQueueJobId({
      kind,
      resourceId,
      variant: data.variant,
    });
    return this.pdfQueue.add('pdf', data, mergeOpts(jobId, {
      priority: QUEUE_JOB_PRIORITY.pdf,
      ...opts,
    }));
  }

  addWebhookJob(
    data: { event?: string; targetKey?: string; payloadDigest?: string },
    opts?: JobsOptions,
  ) {
    const event = data.event ?? 'default';
    const targetKey = data.targetKey ?? 'default';
    const jobId = webhookQueueJobId({
      event,
      targetKey,
      payloadDigest: data.payloadDigest,
    });
    return this.webhookQueue.add('webhook', data, mergeOpts(jobId, {
      priority: QUEUE_JOB_PRIORITY.webhook,
      ...opts,
    }));
  }
}
