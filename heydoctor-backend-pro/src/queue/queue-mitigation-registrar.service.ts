import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { MitigationHooksService } from '../common/resilience/mitigation-hooks.service';

/**
 * Registra en {@link MitigationHooksService} la pausa de colas ante alertas/mitigación.
 */
@Injectable()
export class QueueMitigationRegistrarService implements OnModuleInit {
  constructor(
    private readonly mitigationHooks: MitigationHooksService,
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('pdf') private readonly pdfQueue: Queue,
    @InjectQueue('webhook') private readonly webhookQueue: Queue,
  ) {}

  onModuleInit(): void {
    this.mitigationHooks.registerQueuePauseHandler(async () => {
      await Promise.all([
        this.emailQueue.pause(),
        this.pdfQueue.pause(),
        this.webhookQueue.pause(),
      ]);
    });
  }
}
