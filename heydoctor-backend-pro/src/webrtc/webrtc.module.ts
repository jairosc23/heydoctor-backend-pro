import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { WebrtcCallMetric } from './entities/webrtc-call-metric.entity';
import { WebrtcApiController } from './webrtc-api.controller';
import { WebrtcCallMetricsService } from './webrtc-call-metrics.service';
import { WebrtcGateway } from './webrtc.gateway';
import { WebrtcRecordingStubService } from './webrtc-recording-stub.service';

/**
 * WebRTC signaling over Socket.IO (no media). For horizontal scale, attach a
 * Redis adapter to the Socket.IO server (see OUTPUT / Nest + socket.io-redis).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([WebrtcCallMetric]),
    AuthModule,
    UsersModule,
    ConsultationsModule,
    SubscriptionsModule,
  ],
  controllers: [WebrtcApiController],
  providers: [
    WebrtcGateway,
    WebrtcCallMetricsService,
    WebrtcRecordingStubService,
  ],
})
export class WebrtcModule {}
