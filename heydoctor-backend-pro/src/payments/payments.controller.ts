import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreatePaymentSessionDto } from './dto/create-payment-session.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Público: landing y panel pueden mostrar el mismo monto que Payku sin JWT. */
  @Get('consultation-price')
  consultationPrice() {
    return this.payments.getConsultationPrice();
  }

  @Post('create-session')
  @UseGuards(JwtAuthGuard)
  createSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentSessionDto,
  ) {
    return this.payments.createMockSession(user, dto);
  }
}
