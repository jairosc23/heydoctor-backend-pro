import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DEFAULT_ANALYTICS_WINDOW_DAYS } from '../common/analytics/analytics-window.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/user-role.enum';
import { PlatformGlobalMetricsQueryDto } from './dto/platform-global-metrics-query.dto';
import { PlatformMetricsService } from './platform-metrics.service';

@Controller('platform')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PlatformController {
  constructor(private readonly platformMetrics: PlatformMetricsService) {}

  /** Product + operations dashboard: consultations, WebRTC quality, TURN mix, per clinic. */
  @Get('metrics/global')
  getGlobalMetrics(@Query() query: PlatformGlobalMetricsQueryDto) {
    return this.platformMetrics.getGlobalMetrics(
      query.windowDays ?? DEFAULT_ANALYTICS_WINDOW_DAYS,
    );
  }
}
