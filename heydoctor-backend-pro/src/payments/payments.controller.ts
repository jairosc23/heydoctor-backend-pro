import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreatePaymentSessionDto } from './dto/create-payment-session.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('create-session')
  createSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentSessionDto,
  ) {
    return this.payments.createMockSession(user, dto);
  }
}
