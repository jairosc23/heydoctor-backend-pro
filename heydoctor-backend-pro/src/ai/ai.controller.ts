import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ThrottleRouteCost } from '../common/throttler/throttle-route-cost.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { RequirePlan } from '../subscriptions/decorators/require-plan.decorator';
import { FeatureGuard } from '../subscriptions/guards/feature.guard';
import { SubscriptionPlan } from '../subscriptions/subscription.entity';
import type { ClinicalSummaryResult, ConsultationAssistResult } from './ai.types';
import { AiService } from './ai.service';
import { ConsultationAssistDto } from './dto/consultation-assist.dto';
import { GenerateAiDto } from './dto/generate-ai.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard, FeatureGuard)
@RequirePlan(SubscriptionPlan.PRO)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('consultation-summary')
  @ThrottleRouteCost(5)
  consultationSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateAiDto,
  ): Promise<ClinicalSummaryResult> {
    return this.aiService.generateClinicalSummary(dto, user);
  }

  /**
   * Non-blocking clinical decision support: differentials and education only.
   */
  @Post('consultation-assist')
  @ThrottleRouteCost(5)
  consultationAssist(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConsultationAssistDto,
  ): Promise<ConsultationAssistResult> {
    return this.aiService.generateConsultationAssist(dto, user);
  }
}
