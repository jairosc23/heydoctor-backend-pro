import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ConsultationsService } from '../consultations/consultations.service';
import type { PostWebrtcMetricsDto } from './dto/post-webrtc-metrics.dto';
import { WebrtcCallMetric } from './entities/webrtc-call-metric.entity';

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
}
