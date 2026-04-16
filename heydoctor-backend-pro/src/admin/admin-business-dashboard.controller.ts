import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UserRole } from '../users/user-role.enum';
import { AdminBusinessDashboardService } from './admin-business-dashboard.service';
import type { AdminBusinessDashboardDto } from './dto/admin-business-dashboard.dto';

@Controller('admin/metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminBusinessDashboardController {
  constructor(
    private readonly adminBusinessDashboard: AdminBusinessDashboardService,
  ) {}

  @Get('dashboard')
  getDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminBusinessDashboardDto> {
    return this.adminBusinessDashboard.getDashboard(user);
  }
}
