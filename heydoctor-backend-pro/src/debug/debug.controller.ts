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
  async db(): Promise<
    | { ok: true; patientsTableOk: boolean; consultationsTableOk: boolean }
    | { ok: false; error: string }
  > {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }

    let patientsTableOk = false;
    let consultationsTableOk = false;
    try {
      await this.dataSource.query('SELECT 1 FROM patients LIMIT 1');
      patientsTableOk = true;
    } catch {
      patientsTableOk = false;
    }
    try {
      await this.dataSource.query('SELECT 1 FROM consultations LIMIT 1');
      consultationsTableOk = true;
    } catch {
      consultationsTableOk = false;
    }

    return { ok: true, patientsTableOk, consultationsTableOk };
  }
}
