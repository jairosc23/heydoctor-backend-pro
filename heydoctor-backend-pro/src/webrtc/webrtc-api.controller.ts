import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { RequirePlan } from '../subscriptions/decorators/require-plan.decorator';
import { FeatureGuard } from '../subscriptions/guards/feature.guard';
import { SubscriptionPlan } from '../subscriptions/subscription.entity';
import { PostWebrtcMetricsDto } from './dto/post-webrtc-metrics.dto';
import {
  WebrtcRecordingStartDto,
  WebrtcRecordingStopDto,
} from './dto/webrtc-recording.dto';
import { WebrtcCallMetricsService } from './webrtc-call-metrics.service';
import { WebrtcRecordingStubService } from './webrtc-recording-stub.service';

@Controller('webrtc')
@UseGuards(JwtAuthGuard, FeatureGuard)
@RequirePlan(SubscriptionPlan.PRO)
export class WebrtcApiController {
  constructor(
    private readonly callMetrics: WebrtcCallMetricsService,
    private readonly recordingStub: WebrtcRecordingStubService,
  ) {}

  @Post('metrics')
  @HttpCode(HttpStatus.CREATED)
  ingestMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PostWebrtcMetricsDto,
  ) {
    return this.callMetrics.record(user, dto);
  }

  /** Placeholder — see RECORDING_ARCHITECTURE.md for the future pipeline. */
  @Post('recording/start')
  @HttpCode(HttpStatus.ACCEPTED)
  recordingStart(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WebrtcRecordingStartDto,
  ) {
    return this.recordingStub.start(user, dto);
  }

  /** Placeholder — see RECORDING_ARCHITECTURE.md. */
  @Post('recording/stop')
  @HttpCode(HttpStatus.ACCEPTED)
  recordingStop(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WebrtcRecordingStopDto,
  ) {
    return this.recordingStub.stop(user, dto);
  }
}
