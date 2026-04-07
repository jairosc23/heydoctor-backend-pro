import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ConsultationsService } from '../consultations/consultations.service';
import { RequirePlan } from '../subscriptions/decorators/require-plan.decorator';
import { FeatureGuard } from '../subscriptions/guards/feature.guard';
import { SubscriptionPlan } from '../subscriptions/subscription.entity';
import { PostWebrtcMetricsDto } from './dto/post-webrtc-metrics.dto';
import { WebrtcIceServersQueryDto } from './dto/webrtc-ice-servers-query.dto';
import { WebrtcMetricsSummaryQueryDto } from './dto/webrtc-metrics-summary-query.dto';
import {
  WebrtcRecordingStartDto,
  WebrtcRecordingStopDto,
} from './dto/webrtc-recording.dto';
import { WebrtcCallMetricsService } from './webrtc-call-metrics.service';
import { WebrtcRecordingStubService } from './webrtc-recording-stub.service';
import { WebrtcTurnService } from './webrtc-turn.service';

@Controller('webrtc')
@UseGuards(JwtAuthGuard, FeatureGuard)
@RequirePlan(SubscriptionPlan.PRO)
export class WebrtcApiController {
  constructor(
    private readonly callMetrics: WebrtcCallMetricsService,
    private readonly recordingStub: WebrtcRecordingStubService,
    private readonly turn: WebrtcTurnService,
    private readonly consultationsService: ConsultationsService,
  ) {}

  /**
   * Regional TURN (SCL/GRU/BOG) + STUN; ephemeral HMAC credentials when TURN_REST_SECRET is set.
   */
  @Get('ice-servers')
  async getIceServers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WebrtcIceServersQueryDto,
  ) {
    await this.consultationsService.verifySignalingAccess(
      query.consultationId,
      user,
    );
    return { iceServers: this.turn.buildIceServers(user.sub) };
  }

  @Get('metrics/summary')
  getMetricsSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WebrtcMetricsSummaryQueryDto,
  ) {
    return this.callMetrics.summarize(user, query.consultationId);
  }

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
