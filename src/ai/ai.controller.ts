import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePlan } from '../subscriptions/decorators/require-plan.decorator';
import { FeatureGuard } from '../subscriptions/guards/feature.guard';
import { SubscriptionPlan } from '../subscriptions/subscription.entity';
import type { ClinicalSummaryResult } from './ai.types';
import { AiService } from './ai.service';
import { GenerateAiDto } from './dto/generate-ai.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard, FeatureGuard)
@RequirePlan(SubscriptionPlan.PRO)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('consultation-summary')
  consultationSummary(
    @Body() dto: GenerateAiDto,
  ): Promise<ClinicalSummaryResult> {
    return this.aiService.generateClinicalSummary(dto);
  }
}
