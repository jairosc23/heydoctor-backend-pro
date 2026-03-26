import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { AuditLog } from '../audit/audit-log.entity';
import { DailyMetric } from './daily-metric.entity';
import type { RollingMetricsDto } from './metrics-rolling.dto';

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

  async getRollingMetrics(
    authUser: AuthenticatedUser,
  ): Promise<RollingMetricsDto> {
    const [row] = await this.dailyMetricsRepository.query(`
      SELECT
        COALESCE(SUM(upgrades_total) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '7 days'), 0)  AS upgrades_7d,
        COALESCE(SUM(upgrades_total) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '30 days'), 0) AS upgrades_30d,
        COALESCE(SUM(upgrades_sales) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '30 days'), 0) AS sales_30d,
        COALESCE(SUM(upgrades_support) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '30 days'), 0) AS support_30d
      FROM daily_metrics
    `);

    const upgrades7d = Number(row?.upgrades_7d ?? 0);
    const upgrades30d = Number(row?.upgrades_30d ?? 0);
    const sales30d = Number(row?.sales_30d ?? 0);
    const support30d = Number(row?.support_30d ?? 0);

    const conversionRate =
      upgrades30d > 0
        ? Math.round((sales30d / upgrades30d) * 10000) / 10000
        : 0;

    const result: RollingMetricsDto = {
      upgrades7d,
      upgrades30d,
      sales30d,
      support30d,
      conversionRate,
    };

    void this.auditService.logSuccess({
      userId: authUser.sub,
      action: 'METRICS_ROLLING_READ',
      resource: 'metrics',
      resourceId: null,
      clinicId: null,
      httpStatus: 200,
      metadata: {
        period: '7d_30d',
      },
    });

    return result;
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
