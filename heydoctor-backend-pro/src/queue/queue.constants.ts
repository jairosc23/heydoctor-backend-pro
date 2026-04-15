import type { DefaultJobOptions } from 'bullmq';

export const QUEUE_NAMES = {
  email: 'email',
  pdf: 'pdf',
  webhook: 'webhook',
  emailDlq: 'email-dlq',
  pdfDlq: 'pdf-dlq',
  webhookDlq: 'webhook-dlq',
} as const;

export const DEFAULT_QUEUE_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: false,
};

/** BullMQ: mayor número = mayor prioridad en la cola. */
export const QUEUE_JOB_PRIORITY = {
  pdf: 15,
  email: 8,
  webhook: 2,
} as const;
