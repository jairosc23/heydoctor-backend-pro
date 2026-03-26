import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditLog } from '../audit/audit-log.entity';
import { DailyMetric } from './daily-metric.entity';

type DailyMetricsTotals = {
  upgradesTotal: number;
  upgradesSales: number;
  upgradesSupport: number;
  downgradesRefund: number;
};

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogsRepository: Repository<AuditLog>,
    @InjectRepository(DailyMetric)
    private readonly dailyMetricsRepository: Repository<DailyMetric>,
    private readonly auditService: AuditService,
  ) {}

  private toDateKey(input: Date): string {
    return input.toISOString().slice(0, 10);
  }

  async generateDailyMetrics(date: Date): Promise<DailyMetric> {
    const dateKey = this.toDateKey(date);

    const [row] = await this.auditLogsRepository.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE metadata->>'to' = 'pro') AS upgrades_total,
        COUNT(*) FILTER (WHERE metadata->>'reasonCode' = 'sales') AS upgrades_sales,
        COUNT(*) FILTER (WHERE metadata->>'reasonCode' = 'support') AS upgrades_support,
        COUNT(*) FILTER (WHERE metadata->>'reasonCode' = 'refund') AS downgrades_refund
      FROM audit_logs
      WHERE action = 'SUBSCRIPTION_PLAN_CHANGED'
        AND DATE(created_at) = DATE($1)
      `,
      [dateKey],
    );

    const totals: DailyMetricsTotals = {
      upgradesTotal: Number(row?.upgrades_total ?? 0),
      upgradesSales: Number(row?.upgrades_sales ?? 0),
      upgradesSupport: Number(row?.upgrades_support ?? 0),
      downgradesRefund: Number(row?.downgrades_refund ?? 0),
    };

    await this.dailyMetricsRepository.upsert(
      {
        date: dateKey,
        upgradesTotal: totals.upgradesTotal,
        upgradesSales: totals.upgradesSales,
        upgradesSupport: totals.upgradesSupport,
        downgradesRefund: totals.downgradesRefund,
      },
      ['date'],
    );

    const saved = await this.dailyMetricsRepository.findOneOrFail({
      where: { date: dateKey },
    });

    void this.auditService.logSuccess({
      userId: null,
      action: 'DAILY_METRICS_GENERATED',
      resource: 'metrics',
      resourceId: saved.id,
      clinicId: null,
      httpStatus: 200,
      metadata: {
        date: dateKey,
        totals,
      },
    });

    return saved;
  }

  @Cron('0 1 * * *')
  async runDailyMetricsJob(): Promise<void> {
    // Best-effort background job: errors are logged and swallowed.
    try {
      await this.generateDailyMetrics(new Date());
    } catch (error) {
      this.logger.error('Daily metrics job failed', error);
    }
  }
}
