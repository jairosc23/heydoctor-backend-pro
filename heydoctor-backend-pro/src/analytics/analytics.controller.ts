import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { AnalyticsCollectDto } from './dto/analytics-collect.dto';

/**
 * Ingesta de eventos desde el SPA (sin CSRF: ver {@link CsrfService#isCsrfExempt}).
 * Throttle dedicado {@link analyticsIngest} (ver AppModule).
 */
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('collect')
  @SkipThrottle({ burst: true, sustain: true })
  @Throttle({ analyticsIngest: { limit: 240, ttl: 60_000 } })
  collect(
    @Body() body: AnalyticsCollectDto,
    @Req() req: Request,
  ): Promise<{ accepted: number }> {
    return this.analytics.ingest(body, req);
  }
}
