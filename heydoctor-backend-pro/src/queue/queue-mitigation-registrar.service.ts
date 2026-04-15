import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, OnModuleInit, type LoggerService } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { APP_LOGGER } from '../common/logger/logger.tokens';
import { MitigationHooksService } from '../common/resilience/mitigation-hooks.service';
import { pauseQueuesAndWaitForActive } from './queue-graceful-pause.util';

/**
 * Registra en {@link MitigationHooksService} la pausa de colas ante alertas/mitigación.
 */
@Injectable()
export class QueueMitigationRegistrarService implements OnModuleInit {
  constructor(
    private readonly mitigationHooks: MitigationHooksService,
    @Inject(APP_LOGGER) private readonly log: LoggerService,
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('pdf') private readonly pdfQueue: Queue,
    @InjectQueue('webhook') private readonly webhookQueue: Queue,
  ) {}

  onModuleInit(): void {
    this.mitigationHooks.registerQueuePauseHandler(async () => {
      await pauseQueuesAndWaitForActive(
        [this.emailQueue, this.pdfQueue, this.webhookQueue],
        this.log,
        'mitigation.alert_pause',
      );
    });
  }
}
