import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import { APP_LOGGER } from '../logger/logger.tokens';

export type ChaosRuntimeScenario = 'redis' | 'queue' | 'replica';

function parseTruth(v: string | undefined): boolean {
  return v?.trim() === 'true';
}

/** Porcentaje de peticiones afectadas (1–5). `CHAOS_SAMPLE_PERCENT`. */
function parseSamplePercent(): number {
  const raw = process.env.CHAOS_SAMPLE_PERCENT?.trim();
  let p = raw ? Number(raw) : 2;
  if (!Number.isFinite(p)) {
    p = 2;
  }
  return Math.min(5, Math.max(1, Math.floor(p)));
}

/**
 * Caos controlado en runtime (staging/prod). Activar solo con flags explícitos;
 * cada escenario aplica a un muestreo aleatorio acotado para no tumbar el sistema.
 */
@Injectable()
export class ChaosRuntimeService {
  private readonly redisOn = parseTruth(process.env.CHAOS_REDIS_FAIL);
  private readonly queueOn = parseTruth(process.env.CHAOS_QUEUE_FAIL);
  private readonly replicaOn = parseTruth(process.env.CHAOS_REPLICA_FAIL);
  private readonly samplePct = parseSamplePercent();

  constructor(@Inject(APP_LOGGER) private readonly log: LoggerService) {}

  /**
   * Si debe inyectarse degradación para este escenario en esta invocación.
   * No lanza: solo decide muestreo + flags.
   */
  shouldSimulate(scenario: ChaosRuntimeScenario): boolean {
    const on =
      scenario === 'redis'
        ? this.redisOn
        : scenario === 'queue'
          ? this.queueOn
          : this.replicaOn;
    if (!on) {
      return false;
    }
    return Math.random() * 100 < this.samplePct;
  }

  logRuntime(
    scenario: ChaosRuntimeScenario,
    extra?: Record<string, unknown>,
  ): void {
    this.log.warn(
      JSON.stringify({
        msg: 'chaos_runtime',
        scenario,
        samplePercent: this.samplePct,
        ...extra,
      }),
    );
  }
}
