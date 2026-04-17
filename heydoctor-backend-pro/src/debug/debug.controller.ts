import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Diagnóstico operativo (sin auth): comprobar conectividad SQL desde el runtime.
 * Ruta: GET /debug/db (excluida del prefijo `/api` en main.ts).
 */
@Controller('debug')
export class DebugController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @SkipThrottle({ burst: true, sustain: true })
  @Get('db')
  async db(): Promise<{ connected: boolean }> {
    try {
      await this.dataSource.query('SELECT 1 AS ok');
      return { connected: true };
    } catch {
      return { connected: false };
    }
  }
}
