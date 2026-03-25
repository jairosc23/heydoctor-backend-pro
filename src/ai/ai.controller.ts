import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { ClinicalSummaryResult } from './ai.types';
import { AiService } from './ai.service';
import { GenerateAiDto } from './dto/generate-ai.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('consultation-summary')
  consultationSummary(
    @Body() dto: GenerateAiDto,
  ): Promise<ClinicalSummaryResult> {
    return this.aiService.generateClinicalSummary(dto);
  }
}
