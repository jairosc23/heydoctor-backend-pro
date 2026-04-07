import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consultation } from '../consultations/consultation.entity';
import { WebrtcModule } from '../webrtc/webrtc.module';
import { WebrtcCallMetric } from '../webrtc/entities/webrtc-call-metric.entity';
import { PlatformController } from './platform.controller';
import { PlatformMetricsService } from './platform-metrics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consultation, WebrtcCallMetric]),
    WebrtcModule,
  ],
  controllers: [PlatformController],
  providers: [PlatformMetricsService],
})
export class PlatformModule {}
