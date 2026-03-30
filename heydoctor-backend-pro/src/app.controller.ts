import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @SkipThrottle()
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  /** Railway / probes: sin prefijo `/api` (ver exclude en main.ts). */
  @SkipThrottle()
  @Get('_health')
  getRailwayHealth(): { status: string } {
    return { status: 'ok' };
  }
}
