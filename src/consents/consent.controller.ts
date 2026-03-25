import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ConsentService } from './consent.service';

@Controller('consents')
@UseGuards(JwtAuthGuard)
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Post('telemedicine')
  recordTelemedicine(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.consentService.createConsent(user, req);
  }
}
