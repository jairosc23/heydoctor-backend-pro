import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@Controller()
export class AppController {
  @SkipThrottle({ burst: true, sustain: true })
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Get('/')
  root() {
    return 'ok';
  }

  @SkipThrottle({ burst: true, sustain: true })
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Get('/health')
  health() {
    return 'ok';
  }
}
