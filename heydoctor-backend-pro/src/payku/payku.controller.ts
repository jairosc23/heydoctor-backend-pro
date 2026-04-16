import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreatePaymentSessionDto } from './dto/create-payment-session.dto';
import { PaykuService } from './payku.service';

@Controller('payku')
export class PaykuController {
  constructor(private readonly paykuService: PaykuService) {}

  @Get('consultation/:consultationId/payment-status')
  @UseGuards(JwtAuthGuard)
  async consultationPaymentStatus(
    @Param('consultationId') consultationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paykuService.getConsultationPaymentStatus(
      consultationId,
      user,
    );
  }

  @Post('create-payment-session')
  @UseGuards(JwtAuthGuard)
  async createPaymentSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentSessionDto,
  ) {
    return this.paykuService.createPaymentSession(dto.consultationId, user);
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    await this.paykuService.handleWebhook(headers, body);
    return { ok: true };
  }
}
