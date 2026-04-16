import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { Consultation } from '../consultations/consultation.entity';
import { ConsultationStatus } from '../consultations/consultation-status.enum';
import { PaykuPayment, PaykuPaymentStatus } from '../payku/payku-payment.entity';
import type {
  AdminBusinessDashboardDayDto,
  AdminBusinessDashboardDto,
} from './dto/admin-business-dashboard.dto';

const TERMINAL: ConsultationStatus[] = [
  ConsultationStatus.COMPLETED,
  ConsultationStatus.SIGNED,
  ConsultationStatus.LOCKED,
];

const OPEN_FUNNEL: ConsultationStatus[] = [
  ConsultationStatus.DRAFT,
  ConsultationStatus.IN_PROGRESS,
];

@Injectable()
export class AdminBusinessDashboardService {
  constructor(
    @InjectRepository(Consultation)
    private readonly consultationsRepository: Repository<Consultation>,
    @InjectRepository(PaykuPayment)
    private readonly paykuRepository: Repository<PaykuPayment>,
    private readonly auditService: AuditService,
  ) {}

  /** Inicio del día UTC actual y fin exclusivo (mañana 00:00 UTC). */
  private utcTodayRange(): { dayStart: Date; dayEnd: Date } {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    return { dayStart, dayEnd };
  }

  /** Ventana de 7 días completos hasta fin de hoy UTC (inicio = hoy - 6 días 00:00 UTC). */
  private utcLast7DaysRange(): { windowStart: Date; windowEnd: Date } {
    const { dayStart, dayEnd } = this.utcTodayRange();
    const windowStart = new Date(dayStart);
    windowStart.setUTCDate(windowStart.getUTCDate() - 6);
    return { windowStart, windowEnd: dayEnd };
  }

  private formatDayKey(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private enumerateDays(
    windowStart: Date,
    windowEnd: Date,
  ): string[] {
    const keys: string[] = [];
    const cur = new Date(windowStart);
    while (cur < windowEnd) {
      keys.push(this.formatDayKey(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return keys;
  }

  async getDashboard(
    authUser: AuthenticatedUser,
  ): Promise<AdminBusinessDashboardDto> {
    const { dayStart, dayEnd } = this.utcTodayRange();
    const { windowStart, windowEnd } = this.utcLast7DaysRange();

    const [createdToday, completedToday, openFunnelToday, revenueRow] =
      await Promise.all([
        this.consultationsRepository
          .createQueryBuilder('c')
          .where('c.createdAt >= :dayStart AND c.createdAt < :dayEnd', {
            dayStart,
            dayEnd,
          })
          .getCount(),
        this.consultationsRepository
          .createQueryBuilder('c')
          .where('c.updatedAt >= :dayStart AND c.updatedAt < :dayEnd', {
            dayStart,
            dayEnd,
          })
          .andWhere('c.status IN (:...terminal)', { terminal: TERMINAL })
          .getCount(),
        this.consultationsRepository
          .createQueryBuilder('c')
          .where('c.createdAt >= :dayStart AND c.createdAt < :dayEnd', {
            dayStart,
            dayEnd,
          })
          .andWhere('c.status IN (:...open)', { open: OPEN_FUNNEL })
          .getCount(),
        this.paykuRepository
          .createQueryBuilder('p')
          .select('COALESCE(SUM(p.amount), 0)', 'sum')
          .where('p.status = :paid', { paid: PaykuPaymentStatus.PAID })
          .andWhere('p.paidAt IS NOT NULL')
          .andWhere('p.paidAt >= :dayStart AND p.paidAt < :dayEnd', {
            dayStart,
            dayEnd,
          })
          .getRawOne<{ sum: string }>(),
      ]);

    const totalRevenue = Number(revenueRow?.sum ?? 0);

    const abandonmentRate =
      createdToday > 0
        ? Math.round((10000 * openFunnelToday) / createdToday) / 100
        : 0;

    const [consultRows, revenueRows] = await Promise.all([
      this.consultationsRepository
        .createQueryBuilder('c')
        .select(
          `TO_CHAR((c.createdAt AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
          'd',
        )
        .addSelect('COUNT(*)', 'cnt')
        .where('c.createdAt >= :ws AND c.createdAt < :we', {
          ws: windowStart,
          we: windowEnd,
        })
        .groupBy('d')
        .orderBy('d', 'ASC')
        .getRawMany<{ d: string; cnt: string }>(),
      this.paykuRepository
        .createQueryBuilder('p')
        .select(
          `TO_CHAR((p.paidAt AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
          'd',
        )
        .addSelect('COALESCE(SUM(p.amount), 0)', 'amt')
        .where('p.status = :paid', { paid: PaykuPaymentStatus.PAID })
        .andWhere('p.paidAt IS NOT NULL')
        .andWhere('p.paidAt >= :ws AND p.paidAt < :we', {
          ws: windowStart,
          we: windowEnd,
        })
        .groupBy('d')
        .orderBy('d', 'ASC')
        .getRawMany<{ d: string; amt: string }>(),
    ]);

    const cMap = new Map<string, number>();
    for (const r of consultRows) {
      cMap.set(r.d, Number(r.cnt));
    }
    const rMap = new Map<string, number>();
    for (const r of revenueRows) {
      rMap.set(r.d, Number(r.amt));
    }

    const dayKeys = this.enumerateDays(windowStart, windowEnd);
    const byDay: AdminBusinessDashboardDayDto[] = dayKeys.map((date) => ({
      date,
      consultations: cMap.get(date) ?? 0,
      revenue: rMap.get(date) ?? 0,
    }));

    const result: AdminBusinessDashboardDto = {
      asOf: new Date().toISOString(),
      consultationsCreated: createdToday,
      consultationsCompleted: completedToday,
      totalRevenue,
      currency: 'CLP',
      abandonmentRate,
      byDay,
    };

    void this.auditService.logSuccess({
      userId: authUser.sub,
      action: 'ADMIN_BUSINESS_DASHBOARD_READ',
      resource: 'admin_metrics',
      resourceId: null,
      clinicId: null,
      httpStatus: 200,
      metadata: {
        consultationsCreated: createdToday,
        consultationsCompleted: completedToday,
      },
    });

    return result;
  }
}
