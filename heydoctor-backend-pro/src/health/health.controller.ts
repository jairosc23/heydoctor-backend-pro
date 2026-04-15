import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@Controller()
export class HealthController {
  @SkipThrottle({ burst: true, sustain: true })
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Get('/healthz')
  healthz() {
    return 'ok';
  }
}

/**
 * GET /api/health — mismo prefijo global que el resto del API (útil para probar integración).
 */
@Controller('health')
export class HealthApiController {
  @SkipThrottle({ burst: true, sustain: true })
  @Get()
  health(): { ok: true; service: string } {
    return { ok: true, service: 'heydoctor-backend-pro' };
  }
}
