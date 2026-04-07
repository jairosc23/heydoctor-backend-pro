import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnterpriseObservabilityService } from '../common/observability/enterprise-observability.service';
import { maskUuid } from '../common/observability/log-masking.util';
import type { PostWebrtcMetricsDto } from './dto/post-webrtc-metrics.dto';

export type CallQualityAlertSeverity = 'warning' | 'critical';

/**
 * Log-based alerts for degradations (no external paging yet).
 * Thresholds tunable via env for enterprise rollout.
 */
@Injectable()
export class WebrtcCallQualityAlertService {
  constructor(
    private readonly config: ConfigService,
    private readonly obs: EnterpriseObservabilityService,
  ) {}

  evaluateSample(
    userId: string,
    dto: PostWebrtcMetricsDto,
  ): void {
    const lossT =
      Number(this.config.get('WEBRTC_ALERT_PACKET_LOSS_RATIO')) || 0.12;
    const rttT = Number(this.config.get('WEBRTC_ALERT_RTT_MS')) || 550;
    const iceT = Math.max(
      1,
      Number(this.config.get('WEBRTC_ALERT_ICE_RESTARTS')) || 3,
    );

    const metrics: Record<string, unknown> = {
      packetLossRatio: dto.packetLossRatio,
      rttMs: dto.rtt,
      iceRestartEvents: dto.iceRestartEvents,
    };

    let severity: CallQualityAlertSeverity | null = null;
    let reason = '';

    if (
      dto.packetLossRatio !== undefined &&
      dto.packetLossRatio > lossT
    ) {
      severity = dto.packetLossRatio > lossT + 0.08 ? 'critical' : 'warning';
      reason = 'high_packet_loss';
    } else if (dto.rtt !== undefined && dto.rtt > rttT) {
      severity = dto.rtt > rttT + 200 ? 'critical' : 'warning';
      reason = 'high_rtt';
    } else if (
      dto.iceRestartEvents !== undefined &&
      dto.iceRestartEvents >= iceT
    ) {
      severity = 'critical';
      reason = 'repeated_ice_restarts';
    }

    if (!severity) {
      return;
    }

    this.obs.emit('call_quality_alert', {
      type: 'CALL_QUALITY_ALERT',
      severity,
      reason,
      consultationIdMasked: maskUuid(dto.consultationId),
      callId: dto.callId,
      userId,
      metrics,
    });
  }
}
