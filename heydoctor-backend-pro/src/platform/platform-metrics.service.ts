import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consultation } from '../consultations/consultation.entity';
import { WebrtcCallMetric } from '../webrtc/entities/webrtc-call-metric.entity';
import { WebrtcTurnHealthService } from '../webrtc/webrtc-turn-health.service';

export type PlatformGlobalMetricsResult = {
  windowDays: number;
  generatedAt: string;
  totals: {
    totalConsultations: number;
    activeCallsApprox: number;
    activeRecordingSessions: number;
    totalMetricSamples: number;
    averageQualityLabel: 'good' | 'weak' | 'poor' | 'unknown' | 'insufficient_data';
    poorCallSamplePct: number | null;
    avgRttMs: number | null;
    turnUsage: {
      relayPct: number | null;
      directPct: number | null;
      samplesRelay: number;
      samplesDirect: number;
    };
  };
  alerts: Array<{
    type: string;
    severity: 'warning' | 'critical';
    message: string;
  }>;
  byClinic: Array<{
    clinicId: string;
    clinicName: string;
    consultationsInWindow: number;
    totalConsultations: number;
    metricSamples: number;
    poorSamplePct: number | null;
    avgRttMs: number | null;
    averageQualityLabel: 'good' | 'weak' | 'poor' | 'unknown' | 'insufficient_data';
    relayPct: number | null;
    directPct: number | null;
  }>;
  turnHealth: ReturnType<WebrtcTurnHealthService['getSnapshot']>;
};

@Injectable()
export class PlatformMetricsService {
  constructor(
    @InjectRepository(Consultation)
    private readonly consultations: Repository<Consultation>,
    @InjectRepository(WebrtcCallMetric)
    private readonly metrics: Repository<WebrtcCallMetric>,
    private readonly turnHealth: WebrtcTurnHealthService,
  ) {}

  async getGlobalMetrics(
    windowDays: number,
  ): Promise<PlatformGlobalMetricsResult> {
    const days = Math.min(90, Math.max(1, windowDays));
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    const sinceIso = since.toISOString();

    const totalConsultations = await this.consultations.count();

    const activeMetricsRow = await this.metrics.manager.query<
      Array<{ c: string }>
    >(
      `
      SELECT COUNT(DISTINCT COALESCE(m.call_id::text, m.consultation_id::text))::text AS c
      FROM webrtc_call_metrics m
      WHERE m.recorded_at >= NOW() - INTERVAL '10 minutes'
    `,
    );
    const activeCallsApprox = activeMetricsRow[0]?.c
      ? Number.parseInt(activeMetricsRow[0].c, 10)
      : 0;

    const activeRecRow = await this.metrics.manager.query<
      Array<{ c: string }>
    >(
      `
      SELECT COUNT(*)::text AS c FROM recording_sessions WHERE status = 'active'
    `,
    );
    const activeRecordingSessions = activeRecRow[0]?.c
      ? Number.parseInt(activeRecRow[0].c, 10)
      : 0;

    const totalsRow = await this.metrics.manager.query<
      Array<{
        samples: string;
        avg_rtt: string | null;
        poor_cnt: string | null;
      }>
    >(
      `
      SELECT
        COUNT(*)::text AS samples,
        AVG(m.rtt_ms)::text AS avg_rtt,
        SUM(CASE
          WHEN m.packet_loss_ratio > 0.1 OR m.rtt_ms > 420
            OR (m.outbound_bitrate_bps IS NOT NULL AND m.outbound_bitrate_bps > 0 AND m.outbound_bitrate_bps < 95000)
          THEN 1 ELSE 0 END)::text AS poor_cnt
      FROM webrtc_call_metrics m
      INNER JOIN consultations c ON c.id = m.consultation_id
      WHERE m.recorded_at >= $1
    `,
      [sinceIso],
    );

    const totalMetricSamples = totalsRow[0]?.samples
      ? Number.parseInt(totalsRow[0].samples, 10)
      : 0;
    const poorCnt = totalsRow[0]?.poor_cnt
      ? Number.parseInt(totalsRow[0].poor_cnt, 10)
      : 0;
    const poorCallSamplePct =
      totalMetricSamples > 0 ? (poorCnt / totalMetricSamples) * 100 : null;
    const avgRttMs =
      totalsRow[0]?.avg_rtt != null && totalsRow[0].avg_rtt !== ''
        ? Number(totalsRow[0].avg_rtt)
        : null;

    const distRow = await this.metrics.manager.query<
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
        WHERE m.recorded_at >= $1
      ) t
      GROUP BY quality
    `,
      [sinceIso],
    );

    const dist: Record<string, number> = {
      good: 0,
      weak: 0,
      poor: 0,
      unknown: 0,
    };
    for (const r of distRow) {
      if (r.q in dist) {
        dist[r.q] = Number.parseInt(r.cnt, 10);
      }
    }

    const averageQualityLabel = pickDominantQuality(dist);

    const transportRow = await this.metrics.manager.query<
      Array<{ t: string | null; cnt: string }>
    >(
      `
      SELECT COALESCE(m.selected_candidate_type, 'unknown') AS t, COUNT(*)::text AS cnt
      FROM webrtc_call_metrics m
      INNER JOIN consultations c ON c.id = m.consultation_id
      WHERE m.recorded_at >= $1
      GROUP BY COALESCE(m.selected_candidate_type, 'unknown')
    `,
      [sinceIso],
    );

    let relay = 0;
    let direct = 0;
    for (const row of transportRow) {
      const n = Number.parseInt(row.cnt, 10);
      const t = row.t ?? 'unknown';
      if (t === 'relay') relay += n;
      else if (t === 'host' || t === 'srflx' || t === 'prflx') direct += n;
    }
    const turnTotal = relay + direct;
    const relayPct =
      turnTotal > 0 ? (relay / turnTotal) * 100 : null;
    const directPct =
      turnTotal > 0 ? (direct / turnTotal) * 100 : null;

    const clinicRows = await this.metrics.manager.query<
      Array<{
        clinic_id: string;
        clinic_name: string;
        consultations_in_window: string;
        total_consultations: string;
        metric_samples: string;
        avg_rtt: string | null;
        poor_cnt: string | null;
        relay: string;
        direct: string;
      }>
    >(
      `
      WITH clinic_base AS (
        SELECT cl.id AS clinic_id, cl.name AS clinic_name,
          (SELECT COUNT(*) FROM consultations x WHERE x.clinic_id = cl.id AND x.created_at >= $1) AS consultations_in_window,
          (SELECT COUNT(*) FROM consultations x WHERE x.clinic_id = cl.id) AS total_consultations
        FROM clinics cl
      ),
      m_agg AS (
        SELECT c.clinic_id,
          COUNT(m.id)::text AS metric_samples,
          AVG(m.rtt_ms)::text AS avg_rtt,
          SUM(CASE
            WHEN m.packet_loss_ratio > 0.1 OR m.rtt_ms > 420
              OR (m.outbound_bitrate_bps IS NOT NULL AND m.outbound_bitrate_bps > 0 AND m.outbound_bitrate_bps < 95000)
            THEN 1 ELSE 0 END)::text AS poor_cnt,
          SUM(CASE WHEN m.selected_candidate_type = 'relay' THEN 1 ELSE 0 END)::text AS relay,
          SUM(CASE WHEN m.selected_candidate_type IN ('host','srflx','prflx') THEN 1 ELSE 0 END)::text AS direct
        FROM webrtc_call_metrics m
        INNER JOIN consultations c ON c.id = m.consultation_id
        WHERE m.recorded_at >= $1
        GROUP BY c.clinic_id
      )
      SELECT
        b.clinic_id,
        b.clinic_name,
        b.consultations_in_window::text,
        b.total_consultations::text,
        COALESCE(m.metric_samples, '0') AS metric_samples,
        m.avg_rtt,
        COALESCE(m.poor_cnt, '0') AS poor_cnt,
        COALESCE(m.relay, '0') AS relay,
        COALESCE(m.direct, '0') AS direct
      FROM clinic_base b
      LEFT JOIN m_agg m ON m.clinic_id = b.clinic_id
      ORDER BY b.clinic_name ASC
    `,
      [sinceIso],
    );

    const byClinic = clinicRows.map((row) => {
      const metricSamples = Number.parseInt(row.metric_samples, 10);
      const poorC = Number.parseInt(row.poor_cnt ?? '0', 10);
      const poorSamplePct =
        metricSamples > 0 ? (poorC / metricSamples) * 100 : null;
      const rN = Number.parseInt(row.relay ?? '0', 10);
      const dN = Number.parseInt(row.direct ?? '0', 10);
      const tN = rN + dN;
      return {
        clinicId: row.clinic_id,
        clinicName: row.clinic_name,
        consultationsInWindow: Number.parseInt(
          row.consultations_in_window,
          10,
        ),
        totalConsultations: Number.parseInt(row.total_consultations, 10),
        metricSamples,
        poorSamplePct,
        avgRttMs:
          row.avg_rtt != null && row.avg_rtt !== '' ? Number(row.avg_rtt) : null,
        averageQualityLabel:
          'insufficient_data' as PlatformGlobalMetricsResult['totals']['averageQualityLabel'],
        relayPct: tN > 0 ? (rN / tN) * 100 : null,
        directPct: tN > 0 ? (dN / tN) * 100 : null,
      };
    });

    for (const bc of byClinic) {
      if (bc.metricSamples === 0) {
        bc.averageQualityLabel = 'insufficient_data';
        continue;
      }
      const subDist = await this.metrics.manager.query<
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
          WHERE m.recorded_at >= $1 AND c.clinic_id = $2
        ) t
        GROUP BY quality
      `,
        [sinceIso, bc.clinicId],
      );
      const dloc: Record<string, number> = {
        good: 0,
        weak: 0,
        poor: 0,
        unknown: 0,
      };
      for (const r of subDist) {
        if (r.q in dloc) {
          dloc[r.q] = Number.parseInt(r.cnt, 10);
        }
      }
      bc.averageQualityLabel = pickDominantQuality(dloc);
    }

    const alerts: PlatformGlobalMetricsResult['alerts'] = [];
    const poorPctThreshold =
      Number(process.env.WEBRTC_GLOBAL_POOR_PCT_ALERT) || 35;
    if (
      poorCallSamplePct !== null &&
      poorCallSamplePct > poorPctThreshold &&
      totalMetricSamples >= 10
    ) {
      alerts.push({
        type: 'HIGH_GLOBAL_POOR_QUALITY_SHARE',
        severity:
          poorCallSamplePct > poorPctThreshold + 15 ? 'critical' : 'warning',
        message: `Poor-quality metric samples exceed ${poorPctThreshold}% globally in window`,
      });
    }

    for (const c of byClinic) {
      if (
        c.poorSamplePct !== null &&
        c.metricSamples >= 8 &&
        c.poorSamplePct > poorPctThreshold
      ) {
        alerts.push({
          type: 'CLINIC_POOR_QUALITY_SPIKE',
          severity: c.poorSamplePct > poorPctThreshold + 20 ? 'critical' : 'warning',
          message: `Clinic ${c.clinicName} poor sample rate ${c.poorSamplePct.toFixed(1)}%`,
        });
      }
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
      windowDays: days,
      generatedAt: new Date().toISOString(),
      totals: {
        totalConsultations,
        activeCallsApprox,
        activeRecordingSessions,
        totalMetricSamples,
        averageQualityLabel,
        poorCallSamplePct,
        avgRttMs,
        turnUsage: {
          relayPct,
          directPct,
          samplesRelay: relay,
          samplesDirect: direct,
        },
      },
      alerts,
      byClinic,
      turnHealth: this.turnHealth.getSnapshot(),
    };
  }
}

function pickDominantQuality(dist: Record<string, number>): PlatformGlobalMetricsResult['totals']['averageQualityLabel'] {
  const order = ['poor', 'weak', 'unknown', 'good'] as const;
  let best: (typeof order)[number] = 'good';
  let max = -1;
  for (const k of order) {
    const v = dist[k] ?? 0;
    if (v > max) {
      max = v;
      best = k;
    }
  }
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return 'insufficient_data';
  }
  return best;
}
