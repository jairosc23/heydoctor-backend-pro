import { Injectable } from '@nestjs/common';

export type MitigationAlertPayload = {
  /** Suma temporal al TTL soft de listas (ms). */
  cacheFreshBoostMs?: number;
  /** Si true, ejecutar pausa de colas registrada (p. ej. webhook Alertmanager). */
  pauseQueues?: boolean;
};

/**
 * Hooks para mitigación ante alertas / presión de carga (extensible vía webhook u operador).
 */
@Injectable()
export class MitigationHooksService {
  private cacheFreshBoostMs = 0;
  private lastBoostAt = 0;
  private queuePauseFn: (() => Promise<void>) | null = null;

  /** Registrado desde QueueModule al arrancar (evita dependencia circular). */
  registerQueuePauseHandler(fn: () => Promise<void>): void {
    this.queuePauseFn = fn;
  }

  /** Llamado por load shedding progresivo (ratio 0–1+ vs umbral). */
  notifyLoadPressure(ratio: number): void {
    if (ratio < 0.72) return;
    const now = Date.now();
    const bump =
      ratio >= 1
        ? 25_000
        : ratio >= 0.9
          ? 15_000
          : 8_000;
    this.cacheFreshBoostMs = Math.min(90_000, this.cacheFreshBoostMs + bump);
    this.lastBoostAt = now;
  }

  getMitigationFreshBoostMs(): number {
    if (Date.now() - this.lastBoostAt > 180_000) {
      this.cacheFreshBoostMs = Math.max(0, this.cacheFreshBoostMs - 20_000);
    }
    return this.cacheFreshBoostMs;
  }

  /**
   * Entrada para Alertmanager / runbook: ajusta caché y opcionalmente pausa colas.
   */
  async applyAlertMitigation(payload: MitigationAlertPayload): Promise<void> {
    if (
      typeof payload.cacheFreshBoostMs === 'number' &&
      Number.isFinite(payload.cacheFreshBoostMs) &&
      payload.cacheFreshBoostMs > 0
    ) {
      this.cacheFreshBoostMs = Math.min(
        120_000,
        this.cacheFreshBoostMs + Math.floor(payload.cacheFreshBoostMs),
      );
      this.lastBoostAt = Date.now();
    }
    if (
      payload.pauseQueues &&
      process.env.MITIGATION_ALERT_PAUSE_QUEUES?.trim() === 'true' &&
      this.queuePauseFn
    ) {
      await this.queuePauseFn();
    }
  }

}
