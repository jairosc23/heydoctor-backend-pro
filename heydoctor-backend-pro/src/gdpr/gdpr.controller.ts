import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ConfirmDeletionDto } from './dto/confirm-deletion.dto';
import { GdprService } from './gdpr.service';

/**
 * GDPR / Ley 19.628 — Data subject rights endpoints.
 *
 * Supports:
 * - Art. 20: Data portability (GET /export)
 * - Art. 17: Right to erasure (DELETE /delete-my-data + POST /confirm-deletion)
 * - Status check (GET /deletion-status)
 *
 * HIPAA: These endpoints are compatible with PHI access rights under HIPAA §164.524.
 */
@Controller('gdpr')
@UseGuards(JwtAuthGuard)
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Get('export')
  async exportMyData(@CurrentUser() user: AuthenticatedUser) {
    return this.gdprService.exportUserData(user.sub);
  }

  /**
   * Step 1: Request data deletion (creates pending request).
   */
  @Delete('delete-my-data')
  async requestDeletion(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.gdprService.requestDataDeletion(user.sub, req);
  }

  /**
   * Step 2: Confirm deletion (triggers progressive anonymization in background).
   */
  @Post('confirm-deletion')
  async confirmDeletion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmDeletionDto,
  ) {
    return this.gdprService.confirmDeletion(user.sub, dto.confirm);
  }

  @Get('deletion-status')
  async deletionStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.gdprService.getDeletionStatus(user.sub);
  }
}
