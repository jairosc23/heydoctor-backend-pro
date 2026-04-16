import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuditService } from '../audit/audit.service';
import { Consultation } from '../consultations/consultation.entity';
import { ConsultationStatus } from '../consultations/consultation-status.enum';
import { PaykuPayment, PaykuPaymentStatus } from '../payku/payku-payment.entity';
import { User } from '../users/user.entity';
import type {
  AdminBusinessDashboardDayDto,
  AdminBusinessDashboardDto,
  DoctorPerformanceRowDto,
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

const TERMINAL_SQL = TERMINAL.map((s) => `'${s}'`).join(', ');

@Injectable()
export class AdminBusinessDashboardService {
  constructor(
    @InjectRepository(Consultation)
    private readonly consultationsRepository: Repository<Consultation>,
    @InjectRepository(PaykuPayment)
    private readonly paykuRepository: Repository<PaykuPayment>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly analyticsService: AnalyticsService,
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

  /** Inicio de ventana 30 días hasta dayEnd (exclusivo). */
  private utcLast30DaysStart(dayEnd: Date): Date {
    const t = new Date(dayEnd);
    t.setUTCDate(t.getUTCDate() - 30);
    return t;
  }

  private formatDayKey(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private enumerateDays(windowStart: Date, windowEnd: Date): string[] {
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
    const thirtyStart = this.utcLast30DaysStart(dayEnd);

    const [
      createdToday,
      completedToday,
      openFunnelToday,
      revenueRow,
      paidDistinctRow,
      repeatUsersRow,
      avgMinutesRow,
      doctorsWithRevenueRow,
      consultRows,
      revenueRows,
      doctorRevRows,
      uniqueVisitSessions,
    ] = await Promise.all([
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
      this.paykuRepository
        .createQueryBuilder('p')
        .select('COUNT(DISTINCT p.consultationId)', 'cnt')
        .where('p.status = :paid', { paid: PaykuPaymentStatus.PAID })
        .andWhere('p.consultationId IS NOT NULL')
        .andWhere('p.paidAt >= :dayStart AND p.paidAt < :dayEnd', {
          dayStart,
          dayEnd,
        })
        .getRawOne<{ cnt: string }>(),
      this.consultationsRepository.query(
        `
        SELECT COUNT(*)::int AS c FROM (
          SELECT patient_id
          FROM consultations
          WHERE created_at >= $1 AND created_at < $2
          GROUP BY patient_id
          HAVING COUNT(*) >= 2
        ) t
        `,
        [thirtyStart, dayEnd],
      ) as Promise<Array<{ c: number }>>,
      this.consultationsRepository.query(
        `
        SELECT AVG(EXTRACT(EPOCH FROM (c.updated_at - c.created_at)) / 60.0) AS avg_m
        FROM consultations c
        WHERE c.status IN (${TERMINAL_SQL})
          AND c.updated_at >= $1 AND c.updated_at < $2
        `,
        [dayStart, dayEnd],
      ) as Promise<Array<{ avg_m: string | null }>>,
      this.paykuRepository.query(
        `
        SELECT COUNT(DISTINCT c.doctor_id)::int AS cnt
        FROM payku_payments p
        INNER JOIN consultations c ON c.id = p.consultation_id
        WHERE p.status = 'paid'
          AND p.paid_at >= $1 AND p.paid_at < $2
        `,
        [dayStart, dayEnd],
      ) as Promise<Array<{ cnt: number }>>,
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
      this.paykuRepository.query(
        `
        SELECT c.doctor_id::text AS "doctorId",
               COALESCE(SUM(p.amount), 0)::bigint AS revenue,
               COUNT(DISTINCT p.consultation_id)::int AS "consCount"
        FROM payku_payments p
        INNER JOIN consultations c ON c.id = p.consultation_id
        WHERE p.status = 'paid'
          AND p.paid_at >= $1 AND p.paid_at < $2
        GROUP BY c.doctor_id
        ORDER BY revenue DESC
        LIMIT 25
        `,
        [dayStart, dayEnd],
      ) as Promise<
        Array<{ doctorId: string; revenue: string; consCount: number }>
      >,
      this.analyticsService.countUniquePageViewSessions(dayStart, dayEnd),
    ]);

    const totalRevenue = Number(revenueRow?.sum ?? 0);
    const paidConsultationsToday = Number(paidDistinctRow?.cnt ?? 0);
    const repeatUsers = Number(repeatUsersRow[0]?.c ?? 0);
    const doctorCnt = Number(doctorsWithRevenueRow[0]?.cnt ?? 0);
    const revenuePerDoctor =
      doctorCnt > 0 ? Math.round(totalRevenue / doctorCnt) : 0;

    const avgRaw = avgMinutesRow[0]?.avg_m;
    const avgConsultationTimeMinutes =
      avgRaw != null && avgRaw !== ''
        ? Math.round(Number(avgRaw) * 100) / 100
        : null;

    const abandonmentRate =
      createdToday > 0
        ? Math.round((10000 * openFunnelToday) / createdToday) / 100
        : 0;

    const conversionRate =
      createdToday > 0
        ? Math.round((10000 * paidConsultationsToday) / createdToday) / 100
        : 0;

    const doctorIds = doctorRevRows.map((r) => r.doctorId);
    const users =
      doctorIds.length > 0
        ? await this.usersRepository.find({
            where: { id: In(doctorIds) },
            select: ['id', 'name', 'email'],
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const doctorPerformance: DoctorPerformanceRowDto[] = doctorRevRows.map(
      (r) => {
        const u = userMap.get(r.doctorId);
        const displayName =
          (u?.name && u.name.trim()) ||
          u?.email ||
          `Médico ${r.doctorId.slice(0, 8)}…`;
        return {
          doctorId: r.doctorId,
          displayName,
          consultationsWithRevenue: r.consCount,
          revenue: Number(r.revenue),
        };
      },
    );

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
      conversionRate,
      repeatUsers,
      avgConsultationTimeMinutes,
      revenuePerDoctor,
      funnel: {
        visits: uniqueVisitSessions,
        visitsSource:
          'analytics_events: page_view — sesiones únicas (SDK heydoctor-frontend, hoy UTC)',
        created: createdToday,
        paid: paidConsultationsToday,
        completed: completedToday,
      },
      doctorPerformance,
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
        conversionRate,
      },
    });

    return result;
  }
}
