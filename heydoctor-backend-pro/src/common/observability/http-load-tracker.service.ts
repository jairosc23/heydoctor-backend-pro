import { Injectable } from '@nestjs/common';
import {
  LIST_CACHE_FRESH_MS,
  LIST_CACHE_HARD_TTL_MS,
} from '../cache/entity-list-cache.helper';

const WINDOW_SEC = 5;
const MAX_BUCKETS = 128;
/** ms añadidos por cada QPS (media móvil ~5s), acotado por techo. */
const FRESH_EXTRA_PER_QPS_MS = 380;
/** Techo del TTL “soft” SWR; debe quedar por debajo del hard TTL. */
const LIST_CACHE_FRESH_CAP_MS = Math.min(120_000, LIST_CACHE_HARD_TTL_MS - 15_000);

/**
 * Estima carga HTTP reciente para alargar el umbral “fresh” del SWR de listas
 * bajo QPS alto (menos revalidaciones concurrentes a BD).
 */
@Injectable()
export class HttpLoadTrackerService {
  private readonly perSecond = new Map<number, number>();

  /** Llamar una vez por petición HTTP completada. */
  recordRequest(): void {
    const sec = Math.floor(Date.now() / 1000);
    this.perSecond.set(sec, (this.perSecond.get(sec) ?? 0) + 1);
    this.prune(sec);
  }

  private prune(nowSec: number): void {
    if (this.perSecond.size <= MAX_BUCKETS) return;
    for (const k of this.perSecond.keys()) {
      if (k < nowSec - MAX_BUCKETS) {
        this.perSecond.delete(k);
      }
    }
  }

  /** QPS aproximado (media de los últimos WINDOW_SEC segundos). */
  getSmoothedQps(): number {
    const nowSec = Math.floor(Date.now() / 1000);
    let sum = 0;
    for (let i = 0; i < WINDOW_SEC; i++) {
      sum += this.perSecond.get(nowSec - i) ?? 0;
    }
    return sum / WINDOW_SEC;
  }

  /**
   * TTL soft dinámico para listas: base {@link LIST_CACHE_FRESH_MS} + extra según QPS.
   */
  getEntityListFreshMs(): number {
    const qps = this.getSmoothedQps();
    const extra = Math.floor(qps * FRESH_EXTRA_PER_QPS_MS);
    return Math.min(LIST_CACHE_FRESH_CAP_MS, LIST_CACHE_FRESH_MS + Math.max(0, extra));
  }
}
