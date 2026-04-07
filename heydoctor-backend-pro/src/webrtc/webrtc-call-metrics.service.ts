import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ConsultationsService } from '../consultations/consultations.service';
import type { PostWebrtcMetricsDto } from './dto/post-webrtc-metrics.dto';
import { WebrtcCallMetric } from './entities/webrtc-call-metric.entity';

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

@Injectable()
export class WebrtcCallMetricsService {
  constructor(
    @InjectRepository(WebrtcCallMetric)
    private readonly repo: Repository<WebrtcCallMetric>,
    private readonly consultationsService: ConsultationsService,
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
    });

    const saved = await this.repo.save(row);
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
