import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { DEFAULT_QUEUE_JOB_OPTIONS } from './queue.constants';
import { QueueDlqBridgeService } from './queue-dlq-bridge.service';
import { QueueProducerService } from './queue-producer.service';
import {
  EmailDlqLogProcessor,
  PdfDlqLogProcessor,
  WebhookDlqLogProcessor,
} from './processors/dlq-log.processor';
import { EmailQueueProcessor } from './processors/email-queue.processor';
import { PdfQueueProcessor } from './processors/pdf-queue.processor';
import { WebhookQueueProcessor } from './processors/webhook-queue.processor';

function redisConnectionUrl(): string | undefined {
  return process.env.REDIS_URL?.trim() || undefined;
}

/**
 * BullMQ sobre `REDIS_URL` (Railway Redis, Upstash, etc.).
 * Sin Redis no registra colas ni workers (API sigue arrancando).
 */
@Module({})
export class QueueModule {
  static forRoot(): DynamicModule {
    const url = redisConnectionUrl();
    if (!url) {
      return {
        module: QueueModule,
        imports: [],
        providers: [],
        exports: [],
      };
    }
    return {
      module: QueueModule,
      imports: [
        BullModule.forRoot({
          connection: {
            url,
            maxRetriesPerRequest: null,
          },
        }),
        BullModule.registerQueue(
          { name: 'email', defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS },
          { name: 'pdf', defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS },
          { name: 'webhook', defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS },
          { name: 'email-dlq' },
          { name: 'pdf-dlq' },
          { name: 'webhook-dlq' },
        ),
      ],
      providers: [
        EmailQueueProcessor,
        PdfQueueProcessor,
        WebhookQueueProcessor,
        EmailDlqLogProcessor,
        PdfDlqLogProcessor,
        WebhookDlqLogProcessor,
        QueueDlqBridgeService,
        QueueProducerService,
      ],
      exports: [BullModule, QueueProducerService],
    };
  }
}
