import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import * as client from 'prom-client';
import { PrometheusService } from '../common/observability/prometheus.service';

const TICK_MS = 10_000;

/**
 * Expone contadores BullMQ (email / pdf / webhook) como gauge Prometheus.
 */
@Injectable()
export class QueueMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly gauge: client.Gauge;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('pdf') private readonly pdfQueue: Queue,
    @InjectQueue('webhook') private readonly webhookQueue: Queue,
    private readonly prometheus: PrometheusService,
  ) {
    this.gauge = new client.Gauge({
      name: 'bullmq_queue_jobs',
      help: 'Jobs in BullMQ by queue name and state',
      labelNames: ['queue', 'state'],
      registers: [this.prometheus.register],
    });
  }

  onModuleInit(): void {
    const tick = (): void => {
      void this.refresh();
    };
    tick();
    this.timer = setInterval(tick, TICK_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async refresh(): Promise<void> {
    const pairs: Array<[string, Queue]> = [
      ['email', this.emailQueue],
      ['pdf', this.pdfQueue],
      ['webhook', this.webhookQueue],
    ];
    for (const [name, q] of pairs) {
      try {
        const c = await q.getJobCounts('waiting', 'active', 'failed');
        this.gauge.set({ queue: name, state: 'waiting' }, c.waiting ?? 0);
        this.gauge.set({ queue: name, state: 'active' }, c.active ?? 0);
        this.gauge.set({ queue: name, state: 'failed' }, c.failed ?? 0);
      } catch {
        /* Redis caído o cola no lista */
      }
    }
  }
}
