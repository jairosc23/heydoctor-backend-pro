import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { RecordingAccessAudit } from './entities/recording-access-audit.entity';
import { RecordingSession } from './entities/recording-session.entity';
import { WebrtcCallMetric } from './entities/webrtc-call-metric.entity';
import { WebrtcApiController } from './webrtc-api.controller';
import { WebrtcCallMetricsService } from './webrtc-call-metrics.service';
import { WebrtcCallQualityAlertService } from './webrtc-call-quality-alert.service';
import { WebrtcGateway } from './webrtc.gateway';
import { WebrtcRecordingStubService } from './webrtc-recording-stub.service';
import { WebrtcTurnHealthService } from './webrtc-turn-health.service';
import { WebrtcTurnService } from './webrtc-turn.service';

/**
 * WebRTC signaling over Socket.IO (no media). For horizontal scale, see docs/WEBRTC_SCALING.md.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebrtcCallMetric,
      RecordingSession,
      RecordingAccessAudit,
    ]),
    AuthModule,
    UsersModule,
    ConsultationsModule,
    SubscriptionsModule,
    AuthorizationModule,
    AuditModule,
  ],
  controllers: [WebrtcApiController],
  providers: [
    WebrtcGateway,
    WebrtcCallMetricsService,
    WebrtcCallQualityAlertService,
    WebrtcRecordingStubService,
    WebrtcTurnHealthService,
    WebrtcTurnService,
  ],
  exports: [WebrtcTurnHealthService],
})
export class WebrtcModule {}
