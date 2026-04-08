import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuthorizationService } from '../authorization/authorization.service';
import { Consultation } from '../consultations/consultation.entity';
import { ConsultationsService } from '../consultations/consultations.service';
import { DEFAULT_ANALYTICS_WINDOW_DAYS } from '../common/analytics/analytics-window.constants';
import { EnterpriseObservabilityService } from '../common/observability/enterprise-observability.service';
import type { PostWebrtcMetricsDto } from './dto/post-webrtc-metrics.dto';
import { WebrtcCallMetric } from './entities/webrtc-call-metric.entity';
import { WebrtcCallQualityAlertService } from './webrtc-call-quality-alert.service';
import { WebrtcTurnHealthService } from './webrtc-turn-health.service';

export type CallQualityLabel = 'good' | 'weak' | 'poor' | 'insufficient_data';

export type WebrtcMetricsSummaryRow = {
  recordedAt: string;
  rttMs: number | null;
  packetLossRatio: number | null;
  outboundBitrateBps: number | null;
  qualityPoint: CallQualityLabel;
};

export type WebrtcMetricsSummaryResult = {
  consultationId: string;
  sampleCount: number;
  averages: {
    rttMs: number | null;
    packetLossRatio: number | null;
    outboundBitrateBps: number | null;
  };
  qualityAggregate: CallQualityLabel;
  trends: WebrtcMetricsSummaryRow[];
};

export type WebrtcGlobalSummaryResult = {
  windowDays: number;
  clinicId: string;
  totalMetricSamples: number;
  distinctConsultations: number;
  poorSamplePct: number | null;
  qualityDistribution: {
    good: number;
    weak: number;
    poor: number;
    unknown: number;
  };
  avgRttMs: number | null;
  avgRttByRegion: Record<string, number | null>;
  transportMix: {
    relay: number;
    srflx: number;
    host: number;
    unknown: number;
  };
  alerts: Array<{
    type: string;
    severity: 'warning' | 'critical';
    message: string;
  }>;
  turnHealth: ReturnType<WebrtcTurnHealthService['getSnapshot']>;
  signalingScaleNote: string;
};

@Injectable()
export class WebrtcCallMetricsService {
  constructor(
    @InjectRepository(WebrtcCallMetric)
    private readonly repo: Repository<WebrtcCallMetric>,
    private readonly consultationsService: ConsultationsService,
    private readonly authorizationService: AuthorizationService,
    private readonly alerts: WebrtcCallQualityAlertService,
    private readonly observability: EnterpriseObservabilityService,
    private readonly turnHealth: WebrtcTurnHealthService,
  ) {}

  async record(
    user: AuthenticatedUser,
    dto: PostWebrtcMetricsDto,
  ): Promise<{ ok: true; id: string }> {
    await this.consultationsService.verifySignalingAccess(
      dto.consultationId,
      user,
    );

    const row = this.repo.create({
      consultationId: dto.consultationId,
      userId: user.sub,
      rttMs: dto.rtt ?? null,
      packetsLost: dto.packetsLost ?? null,
      outboundBitrateBps: dto.bitrate ?? null,
      jitterSeconds: dto.jitter ?? null,
      packetLossRatio: dto.packetLossRatio ?? null,
      callId: dto.callId ?? null,
      selectedCandidateType: dto.selectedCandidateType ?? null,
      turnRegion: dto.turnRegion ?? null,
      iceRestartEvents: dto.iceRestartEvents ?? null,
    });

    const saved = await this.repo.save(row);

    this.observability.emit('webrtc_metric_ingested', {
      consultationId: dto.consultationId,
      callId: dto.callId,
      userId: user.sub,
      metricId: saved.id,
    });

    this.alerts.evaluateSample(user.sub, dto);

    return { ok: true, id: saved.id };
  }

  async summarize(
    user: AuthenticatedUser,
    consultationId: string,
  ): Promise<WebrtcMetricsSummaryResult> {
    await this.consultationsService.verifySignalingAccess(
      consultationId,
      user,
    );

    const raw = await this.repo
      .createQueryBuilder('m')
      .select('COUNT(*)', 'cnt')
      .addSelect('AVG(m.rttMs)', 'avgRtt')
      .addSelect('AVG(m.packetLossRatio)', 'avgLoss')
      .addSelect('AVG(m.outboundBitrateBps)', 'avgBitrate')
      .where('m.consultationId = :id', { id: consultationId })
      .getRawOne<{
        cnt: string;
        avgRtt: string | null;
        avgLoss: string | null;
        avgBitrate: string | null;
      }>();

    const sampleCount = raw?.cnt ? Number.parseInt(raw.cnt, 10) : 0;
    const toNum = (v: string | null | undefined): number | null => {
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const avgRtt = toNum(raw?.avgRtt);
    const avgLoss = toNum(raw?.avgLoss);
    const avgBitrate = toNum(raw?.avgBitrate);

    const qualityAggregate =
      sampleCount === 0
        ? 'insufficient_data'
        : classifyAvgQuality(avgLoss, avgRtt, avgBitrate);

    const recent = await this.repo.find({
      where: { consultationId },
      order: { recordedAt: 'DESC' },
      take: 120,
      select: {
        recordedAt: true,
        rttMs: true,
        packetLossRatio: true,
        outboundBitrateBps: true,
      },
    });

    const chronological = [...recent].reverse();
    const trends: WebrtcMetricsSummaryRow[] = chronological.map((row) => ({
      recordedAt: row.recordedAt.toISOString(),
      rttMs: row.rttMs,
      packetLossRatio: row.packetLossRatio,
      outboundBitrateBps: row.outboundBitrateBps,
      qualityPoint: classifyPointQuality(
        row.packetLossRatio,
        row.rttMs,
        row.outboundBitrateBps,
      ),
    }));

    return {
      consultationId,
      sampleCount,
      averages: {
        rttMs: avgRtt,
        packetLossRatio: avgLoss,
        outboundBitrateBps: avgBitrate,
      },
      qualityAggregate,
      trends,
    };
  }

  async globalClinicSummary(
    user: AuthenticatedUser,
    windowDays = DEFAULT_ANALYTICS_WINDOW_DAYS,
  ): Promise<WebrtcGlobalSummaryResult> {
    const { clinicId } = await this.authorizationService.getUserWithClinic(user);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - windowDays);

    const base = this.repo
      .createQueryBuilder('m')
      .innerJoin(Consultation, 'c', 'c.id = m.consultationId')
      .where('c.clinicId = :clinicId', { clinicId })
      .andWhere('m.recordedAt >= :since', { since });

    const totals = await base
      .clone()
      .select('COUNT(*)', 'total')
      .addSelect('COUNT(DISTINCT m.consultationId)', 'consultations')
      .addSelect('AVG(m.rttMs)', 'avgRtt')
      .getRawOne<{
        total: string;
        consultations: string;
        avgRtt: string | null;
      }>();

    const totalMetricSamples = totals?.total
      ? Number.parseInt(totals.total, 10)
      : 0;
    const distinctConsultations = totals?.consultations
      ? Number.parseInt(totals.consultations, 10)
      : 0;
    const avgRttMs =
      totals?.avgRtt != null && totals.avgRtt !== ''
        ? Number(totals.avgRtt)
        : null;

    const poorRow = await base
      .clone()
      .select(
        `SUM(CASE WHEN m.packetLossRatio > 0.1 OR m.rttMs > 420 OR (m.outboundBitrateBps IS NOT NULL AND m.outboundBitrateBps > 0 AND m.outboundBitrateBps < 95000) THEN 1 ELSE 0 END)`,
        'poorCnt',
      )
      .getRawOne<{ poorCnt: string | null }>();

    const poorCnt = poorRow?.poorCnt
      ? Number.parseInt(poorRow.poorCnt, 10)
      : 0;
    const poorSamplePct =
      totalMetricSamples > 0
        ? (poorCnt / totalMetricSamples) * 100
        : null;

    const distRows = await this.repo.manager.query<
      Array<{ q: string; cnt: string }>
    >(
      `
      SELECT quality AS q, COUNT(*)::text AS cnt FROM (
        SELECT CASE
          WHEN m.packet_loss_ratio > 0.1 OR m.rtt_ms > 420
            OR (m.outbound_bitrate_bps IS NOT NULL AND m.outbound_bitrate_bps > 0 AND m.outbound_bitrate_bps < 95000)
            THEN 'poor'
          WHEN m.packet_loss_ratio > 0.035 OR m.rtt_ms > 260 THEN 'weak'
          WHEN m.packet_loss_ratio IS NULL AND m.rtt_ms IS NULL AND m.outbound_bitrate_bps IS NULL THEN 'unknown'
          ELSE 'good'
        END AS quality
        FROM webrtc_call_metrics m
        INNER JOIN consultations c ON c.id = m.consultation_id
        WHERE c.clinic_id = $1 AND m.recorded_at >= $2
      ) t
      GROUP BY quality
    `,
      [clinicId, since.toISOString()],
    );

    const qualityDistribution = {
      good: 0,
      weak: 0,
      poor: 0,
      unknown: 0,
    };
    for (const row of distRows) {
      const k = row.q as keyof typeof qualityDistribution;
      if (k in qualityDistribution) {
        qualityDistribution[k] = Number.parseInt(row.cnt, 10);
      }
    }

    const regionRows = await this.repo.manager.query<
      Array<{ region: string | null; avg: string | null }>
    >(
      `
      SELECT m.turn_region AS region, AVG(m.rtt_ms)::text AS avg
      FROM webrtc_call_metrics m
      INNER JOIN consultations c ON c.id = m.consultation_id
      WHERE c.clinic_id = $1 AND m.recorded_at >= $2 AND m.turn_region IS NOT NULL
      GROUP BY m.turn_region
    `,
      [clinicId, since.toISOString()],
    );

    const avgRttByRegion: Record<string, number | null> = {};
    for (const r of regionRows) {
      if (r.region) {
        avgRttByRegion[r.region] =
          r.avg != null && r.avg !== '' ? Number(r.avg) : null;
      }
    }

    const transportRows = await this.repo.manager.query<
      Array<{ t: string | null; cnt: string }>
    >(
      `
      SELECT COALESCE(m.selected_candidate_type, 'unknown') AS t, COUNT(*)::text AS cnt
      FROM webrtc_call_metrics m
      INNER JOIN consultations c ON c.id = m.consultation_id
      WHERE c.clinic_id = $1 AND m.recorded_at >= $2
      GROUP BY COALESCE(m.selected_candidate_type, 'unknown')
    `,
      [clinicId, since.toISOString()],
    );

    const transportMix = {
      relay: 0,
      srflx: 0,
      host: 0,
      unknown: 0,
    };
    for (const row of transportRows) {
      const n = Number.parseInt(row.cnt, 10);
      const t = row.t ?? 'unknown';
      if (t === 'relay') {
        transportMix.relay += n;
      } else if (t === 'srflx' || t === 'prflx') {
        transportMix.srflx += n;
      } else if (t === 'host') {
        transportMix.host += n;
      } else {
        transportMix.unknown += n;
      }
    }

    const alerts: WebrtcGlobalSummaryResult['alerts'] = [];
    const poorPctThreshold =
      Number(process.env.WEBRTC_GLOBAL_POOR_PCT_ALERT) || 35;
    if (
      poorSamplePct !== null &&
      poorSamplePct > poorPctThreshold &&
      totalMetricSamples >= 10
    ) {
      alerts.push({
        type: 'HIGH_POOR_QUALITY_SHARE',
        severity: poorSamplePct > poorPctThreshold + 15 ? 'critical' : 'warning',
        message: `Poor-quality samples exceed ${poorPctThreshold}% in window`,
      });
    }

    for (const th of this.turnHealth.getSnapshot()) {
      if (!th.ok) {
        alerts.push({
          type: 'TURN_UNREACHABLE',
          severity: 'warning',
          message: `TURN host probe failed: ${th.host}`,
        });
      }
    }

    return {
      windowDays,
      clinicId,
      totalMetricSamples,
      distinctConsultations,
      poorSamplePct,
      qualityDistribution,
      avgRttMs,
      avgRttByRegion,
      transportMix,
      alerts,
      turnHealth: this.turnHealth.getSnapshot(),
      signalingScaleNote:
        'Horizontal scale: attach @socket.io/redis-adapter to the same Redis as sticky sessions; see docs/WEBRTC_SCALING.md',
    };
  }
}

function classifyAvgQuality(
  loss: number | null,
  rtt: number | null,
  bitrate: number | null,
): Exclude<CallQualityLabel, 'insufficient_data'> {
  const l = loss ?? 0;
  const r = rtt ?? 0;
  const lowBr =
    bitrate != null && bitrate > 0 && bitrate < 95_000 ? true : false;
  if (l > 0.1 || r > 420 || lowBr) {
    return 'poor';
  }
  if (l > 0.035 || r > 260) {
    return 'weak';
  }
  return 'good';
}

function classifyPointQuality(
  loss: number | null,
  rtt: number | null,
  bitrate: number | null,
): CallQualityLabel {
  if (loss == null && rtt == null && bitrate == null) {
    return 'insufficient_data';
  }
  return classifyAvgQuality(loss, rtt, bitrate);
}
