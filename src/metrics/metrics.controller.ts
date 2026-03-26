import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UserRole } from '../users/user-role.enum';
import type { RollingMetricsDto } from './metrics-rolling.dto';
import { MetricsService } from './metrics.service';

@Controller('metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('rolling')
  getRolling(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RollingMetricsDto> {
    return this.metricsService.getRollingMetrics(user);
  }
}
