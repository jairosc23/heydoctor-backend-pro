import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import type { Job } from 'bullmq';
import { APP_LOGGER } from '../../common/logger/logger.tokens';

/** Consume DLQ solo para registrar (evita jobs “huérfanos” acumulados). */
@Injectable()
@Processor('email-dlq', { concurrency: 1 })
export class EmailDlqLogProcessor extends WorkerHost {
  constructor(@Inject(APP_LOGGER) private readonly log: LoggerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.log.log(
      JSON.stringify({
        msg: 'dlq_email',
        jobId: String(job.id ?? ''),
        sourceQueue: (job.data as { sourceQueue?: string })?.sourceQueue,
      }),
    );
  }
}

@Injectable()
@Processor('pdf-dlq', { concurrency: 1 })
export class PdfDlqLogProcessor extends WorkerHost {
  constructor(@Inject(APP_LOGGER) private readonly log: LoggerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.log.log(
      JSON.stringify({
        msg: 'dlq_pdf',
        jobId: String(job.id ?? ''),
        sourceQueue: (job.data as { sourceQueue?: string })?.sourceQueue,
      }),
    );
  }
}

@Injectable()
@Processor('webhook-dlq', { concurrency: 1 })
export class WebhookDlqLogProcessor extends WorkerHost {
  constructor(@Inject(APP_LOGGER) private readonly log: LoggerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.log.log(
      JSON.stringify({
        msg: 'dlq_webhook',
        jobId: String(job.id ?? ''),
        sourceQueue: (job.data as { sourceQueue?: string })?.sourceQueue,
      }),
    );
  }
}
