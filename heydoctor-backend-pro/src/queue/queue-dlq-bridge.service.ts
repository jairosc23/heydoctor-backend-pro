import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  type LoggerService,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { QueueEvents } from 'bullmq';
import { APP_LOGGER } from '../common/logger/logger.tokens';

/**
 * Tras agotar reintentos, copia el job a la cola `*-dlq` para inspección / alertas.
 */
@Injectable()
export class QueueDlqBridgeService implements OnModuleInit, OnModuleDestroy {
  private events: QueueEvents[] = [];

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('email-dlq') private readonly emailDlq: Queue,
    @InjectQueue('pdf') private readonly pdfQueue: Queue,
    @InjectQueue('pdf-dlq') private readonly pdfDlq: Queue,
    @InjectQueue('webhook') private readonly webhookQueue: Queue,
    @InjectQueue('webhook-dlq') private readonly webhookDlq: Queue,
    @Inject(APP_LOGGER) private readonly log: LoggerService,
  ) {}

  onModuleInit(): void {
    const url = process.env.REDIS_URL?.trim();
    if (!url) return;
    const connection = { url, maxRetriesPerRequest: null as null };

    const pairs: Array<{ name: string; main: Queue; dlq: Queue }> = [
      { name: 'email', main: this.emailQueue, dlq: this.emailDlq },
      { name: 'pdf', main: this.pdfQueue, dlq: this.pdfDlq },
      { name: 'webhook', main: this.webhookQueue, dlq: this.webhookDlq },
    ];

    for (const { name, main, dlq } of pairs) {
      const qe = new QueueEvents(name, { connection });
      qe.on('failed', ({ jobId }) => {
        void (async () => {
          try {
            const job = await main.getJob(jobId);
            if (!job) return;
            const rawAttempts = job.opts.attempts;
            const attempts =
              typeof rawAttempts === 'number' && rawAttempts >= 1
                ? rawAttempts
                : 1;
            // Solo DLQ cuando se agotaron los intentos configurados (evita copias en fallos intermedios).
            if (job.attemptsMade < attempts) return;
            await dlq.add(
              'dead',
              {
                sourceQueue: name,
                originalJobId: job.id,
                data: job.data,
                failedReason: job.failedReason,
              },
              {
                jobId: `dlq:${name}:${String(jobId)}`,
                removeOnComplete: 500,
                attempts: 1,
              },
            );
            this.log.log(
              JSON.stringify({
                msg: 'queue_job_moved_to_dlq',
                sourceQueue: name,
                originalJobId: String(job.id ?? ''),
              }),
            );
          } catch (e) {
            this.log.error(
              JSON.stringify({
                msg: 'queue_dlq_bridge_error',
                detail: e instanceof Error ? e.message : String(e),
              }),
              e instanceof Error ? e.stack : undefined,
            );
          }
        })();
      });
      void qe.waitUntilReady().catch(() => undefined);
      this.events.push(qe);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      this.events.map((e) =>
        e.close().catch(() => undefined),
      ),
    );
  }
}
