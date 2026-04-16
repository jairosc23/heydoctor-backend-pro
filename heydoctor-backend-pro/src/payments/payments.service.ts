import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuthorizationService } from '../authorization/authorization.service';
import { EnvConfig, ENV_CONFIG_TOKEN } from '../config/env.config';
import { ConsultationsService } from '../consultations/consultations.service';
import type { CreatePaymentSessionDto } from './dto/create-payment-session.dto';
import {
  type ConsultationPriceResponse,
  toConsultationPriceResponse,
} from './consultation-payment-price';

/**
 * Payment provider integration placeholder — returns a deterministic mock session only.
 * No card data, no external API calls.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly authorizationService: AuthorizationService,
    private readonly consultationsService: ConsultationsService,
    @Inject(ENV_CONFIG_TOKEN)
    private readonly envConfig: EnvConfig,
  ) {}

  /**
   * Precio mostrado en UI y enviado a Payku (mismo origen que {@link PaykuService#createPaymentSession}).
   */
  getConsultationPrice(): ConsultationPriceResponse {
    return toConsultationPriceResponse(this.envConfig.consultationPaymentAmountClp);
  }

  async createMockSession(
    user: AuthenticatedUser,
    dto: CreatePaymentSessionDto,
  ): Promise<{
    provider: 'mock';
    sessionId: string;
    status: 'open' | 'mock_completed';
    consultationId: string;
    amount: number;
    currency: string;
    clientSecret: null;
    message: string;
  }> {
    const { clinicId } =
      await this.authorizationService.getUserWithClinic(user);
    const consultation = await this.consultationsService.findByIdForClinic(
      dto.consultationId,
      clinicId,
    );
    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    const currency = dto.currency.trim().toUpperCase().slice(0, 8);
    return {
      provider: 'mock',
      sessionId: `mock_${randomUUID()}`,
      status: 'open',
      consultationId: dto.consultationId,
      amount: dto.amount,
      currency: currency || 'USD',
      clientSecret: null,
      message:
        'Mock payment session (no charge). Wire Stripe/Mercado Pago here.',
    };
  }
}
